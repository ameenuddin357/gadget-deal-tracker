import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { passwordResetStore } from '../services/passwordResetStore.ts';
import { EmailService } from '../services/emailService.ts';

// Helper signing JWT tokens securely
const signToken = (payload: { userId: number; username: string; email: string; role: string }) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Server configuration error: JWT_SECRET environment variable is missing.');
  }
  const expiry = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn: expiry as any });
};

// Dedicated Helper signing short-lived email verification tokens (60 minutes)
const signVerificationToken = (payload: { userId: number; email: string }) => {
  const secret = process.env.EMAIL_VERIFICATION_SECRET;
  if (!secret) {
    throw new Error('Server configuration error: EMAIL_VERIFICATION_SECRET environment variable is missing.');
  }
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      purpose: 'email_verification'
    },
    secret,
    { expiresIn: '60m' }
  );
};

// Safe helper to resolve canonical application URL for links
const getAppBaseUrl = (req: Request): string => {
  if (process.env.APP_URL && process.env.APP_URL.trim() !== '') {
    return process.env.APP_URL.replace(/\/+$/, '');
  }
  const origin = req.get('origin');
  if (origin && origin.trim() !== '') {
    return origin.replace(/\/+$/, '');
  }
  return `${req.protocol}://${req.get('host')}`;
};

// Check whether mandatory email verification is enabled (defaults to false)
export const isEmailVerificationEnabled = (): boolean => {
  return process.env.EMAIL_VERIFICATION_ENABLED === 'true';
};

/**
 * AUTHENTICATION CONTROLLER - REGISTER USER ACCOUNT
 * POST /api/auth/register
 * 
 * SECURITY NOTE: Public registration MUST ALWAYS assign role='user' and is_verified=FALSE.
 * Any client-provided 'role' field is strictly stripped and ignored.
 * Does NOT return an authentication token.
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Only extract expected fields; never accept or trust client-provided role
    const { username, email, password } = req.body;

    // Log security alert if client attempted to pass a privileged role parameter
    if (req.body && req.body.role) {
      console.warn(`[Security Alert] Client attempted to specify role="${req.body.role}" during public registration. Ignoring input and forcing role="user".`);
    }

    // Request Payload Validations
    if (!username || !email || !password || typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return next(new AppError('Please provide registration details: username, email, password.', 400));
    }

    const trimmedUsername = username.trim().slice(0, 50);
    const trimmedEmail = email.toLowerCase().trim().slice(0, 100);

    if (trimmedUsername.length < 2) {
      return next(new AppError('Username must contain at least 2 characters.', 400));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    if (password.length < 6 || password.length > 128) {
      return next(new AppError('Password must contain between 6 and 128 characters.', 400));
    }

    // Check for existing account by email only (multiple users may share the same full name/username)
    const checkSql = 'SELECT user_id, email FROM users WHERE email = $1;';
    const checkRes = await db.query(checkSql, [trimmedEmail]);
    if (checkRes.rows.length > 0) {
      return next(new AppError('An account with this email already exists.', 409));
    }

    // Hash the raw password securely using Blowfish bcrypt (12 rounds)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verificationEnabled = isEmailVerificationEnabled();

    // Insert user credential tuple safely; explicitly enforce role = 'user'
    // When verification is disabled: is_verified = TRUE
    // When verification is enabled: is_verified = FALSE
    const sql = `
      INSERT INTO users (username, email, password_hash, role, is_verified)
      VALUES ($1, $2, $3, 'user', $4)
      RETURNING user_id, username, email, role, created_at, is_verified;
    `;
    
    let newUser;
    try {
      const result = await db.query(sql, [trimmedUsername, trimmedEmail, hashedPassword, !verificationEnabled]);
      newUser = result.rows[0];
    } catch (dbErr: any) {
      if (dbErr.code === '23505') {
        if (dbErr.constraint === 'users_email_key' || dbErr.detail?.includes('email')) {
          return next(new AppError('An account with this email already exists.', 409));
        }
        if (dbErr.constraint === 'users_username_key' || dbErr.detail?.includes('username')) {
          console.error('[Database Migration Required] Legacy unique constraint "users_username_key" rejected registration with duplicate full name. An administrative migration (ALTER TABLE users DROP CONSTRAINT users_username_key;) is required.');
          return next(new AppError('Registration with this name is currently unavailable. Please try again or contact support.', 409));
        }
        return next(new AppError('An account with this identifier already exists.', 409));
      }
      throw dbErr;
    }

    // When email verification is disabled:
    // - create account with is_verified = TRUE
    // - issue normal authentication JWT
    // - auto-login behavior works normally
    // - DO NOT generate verification token
    // - DO NOT send verification email
    // - DO NOT require verification before login
    if (!verificationEnabled) {
      const token = signToken({
        userId: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      });

      res.status(201).json({
        status: 'success',
        message: 'Account created successfully.',
        verificationRequired: false,
        token,
        data: {
          user: {
            userId: newUser.user_id,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role
          }
        }
      });
      return;
    }

    // Generate 60-minute email verification token
    const verificationToken = signVerificationToken({
      userId: newUser.user_id,
      email: newUser.email
    });
    const appBaseUrl = getAppBaseUrl(req);
    const verificationLink = `${appBaseUrl}/verify-email?token=${verificationToken}`;

    // Dispatch verification email safely
    let emailDispatched = false;
    try {
      emailDispatched = await EmailService.sendVerificationEmail(
        newUser.email,
        verificationLink,
        newUser.username
      );
    } catch (emailErr: any) {
      console.warn(`[Registration] Verification email dispatch issue for user ${newUser.user_id}:`, emailErr.message);
    }

    // Notice: Do NOT return an auth token. Return clean verification instruction.
    if (emailDispatched) {
      res.status(201).json({
        status: 'success',
        message: 'Account created. Please check your email to verify your account.',
        verificationRequired: true,
        data: {
          email: newUser.email
        }
      });
    } else {
      // Account is created in DB (is_verified = FALSE), but initial delivery failed
      res.status(201).json({
        status: 'success',
        message: 'Account created, but the verification email could not be delivered immediately. Please use Resend Verification to receive a new link.',
        verificationRequired: true,
        emailDeliveryFailed: true,
        data: {
          email: newUser.email
        }
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * AUTHENTICATION CONTROLLER - LOGIN PROVIDER
 * POST /api/auth/login
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return next(new AppError('Please enter email and account password.', 400));
    }

    const trimmedEmail = email.toLowerCase().trim().slice(0, 100);

    // Lookup user accounts by indexed email path (include is_verified)
    const sql = `
      SELECT user_id, username, email, password_hash, role, is_verified
      FROM users
      WHERE email = $1;
    `;
    const result = await db.query(sql, [trimmedEmail]);

    if (result.rows.length === 0) {
      return next(new AppError('Invalid email or password.', 401));
    }

    const matchedUser = result.rows[0];

    if (!matchedUser.password_hash) {
      return next(new AppError('Invalid email or password.', 401));
    }

    // Compare supplied password hash against saved hash digest using constant-time evaluation 
    const isMatched = await bcrypt.compare(password, matchedUser.password_hash);

    if (!isMatched) {
      return next(new AppError('Invalid email or password.', 401));
    }

    // Mandatory Email Verification Gating:
    // Only enforced when EMAIL_VERIFICATION_ENABLED=true
    // When disabled, do NOT block users because of is_verified
    if (isEmailVerificationEnabled() && matchedUser.is_verified !== true) {
      res.status(403).json({
        status: 'fail',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before signing in.'
      });
      return;
    }

    // Sign transaction token for verified accounts
    const token = signToken({
      userId: matchedUser.user_id,
      username: matchedUser.username,
      email: matchedUser.email,
      role: matchedUser.role
    });

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          userId: matchedUser.user_id,
          username: matchedUser.username,
          email: matchedUser.email,
          role: matchedUser.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * EMAIL VERIFICATION CONTROLLER - VERIFY TOKEN
 * POST /api/auth/verify-email
 * Body: { token: string }
 */
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // When email verification is disabled, return safe status without mutating database
    if (!isEmailVerificationEnabled()) {
      res.status(200).json({
        status: 'success',
        message: 'Email verification is currently disabled.'
      });
      return;
    }

    const { token } = req.body;
    if (!token || typeof token !== 'string' || token.trim() === '') {
      return next(new AppError('Verification token is missing or invalid.', 400));
    }

    const secret = process.env.EMAIL_VERIFICATION_SECRET;
    if (!secret) {
      return next(new AppError('Server configuration error: EMAIL_VERIFICATION_SECRET is missing.', 500));
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token.trim(), secret);
    } catch (jwtErr: any) {
      if (jwtErr.name === 'TokenExpiredError') {
        return next(new AppError('Verification link has expired. Please request a new verification email.', 400));
      }
      return next(new AppError('Verification link is invalid or corrupted. Please request a new verification email.', 400));
    }

    if (!decoded || decoded.purpose !== 'email_verification' || !decoded.userId || !decoded.email) {
      return next(new AppError('Invalid verification token purpose or payload.', 400));
    }

    // Query database user
    const userRes = await db.query(
      'SELECT user_id, username, email, is_verified FROM users WHERE user_id = $1;',
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      return next(new AppError('User account associated with this token was not found.', 404));
    }

    const user = userRes.rows[0];

    // Confirm email identity matches
    if (user.email.toLowerCase() !== String(decoded.email).toLowerCase()) {
      return next(new AppError('Verification token does not match the registered email for this account.', 400));
    }

    // Idempotent success if already verified
    if (user.is_verified === true) {
      res.status(200).json({
        status: 'success',
        message: 'Email is already verified. You can now sign in.',
        alreadyVerified: true
      });
      return;
    }

    // Set is_verified = TRUE
    await db.query('UPDATE users SET is_verified = TRUE WHERE user_id = $1;', [user.user_id]);

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully. You can now sign in.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * EMAIL VERIFICATION CONTROLLER - RESEND VERIFICATION
 * POST /api/auth/resend-verification
 * Body: { email: string }
 */
export const resendVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // When email verification is disabled, do not send email
    if (!isEmailVerificationEnabled()) {
      res.status(200).json({
        status: 'success',
        message: 'Email verification is currently disabled.'
      });
      return;
    }

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    const trimmedEmail = email.toLowerCase().trim().slice(0, 100);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    // Generic anti-enumeration response
    const genericResponse = {
      status: 'success',
      message: 'If an unverified account exists for this email, a verification link has been sent.'
    };

    // Query database user
    const userRes = await db.query(
      'SELECT user_id, username, email, is_verified FROM users WHERE email = $1;',
      [trimmedEmail]
    );

    if (userRes.rows.length === 0) {
      res.status(200).json(genericResponse);
      return;
    }

    const user = userRes.rows[0];

    // If already verified, do NOT send another email and do NOT modify anything
    if (user.is_verified === true) {
      res.status(200).json(genericResponse);
      return;
    }

    // User exists and is unverified: create fresh 60-minute token
    const verificationToken = signVerificationToken({
      userId: user.user_id,
      email: user.email
    });
    const appBaseUrl = getAppBaseUrl(req);
    const verificationLink = `${appBaseUrl}/verify-email?token=${verificationToken}`;

    try {
      await EmailService.sendVerificationEmail(
        user.email,
        verificationLink,
        user.username
      );
    } catch (emailErr: any) {
      console.warn(`[ResendVerification] Email dispatch issue for user ${user.user_id}:`, emailErr.message);
    }

    res.status(200).json(genericResponse);
  } catch (err) {
    next(err);
  }
};

/**
 * FORGOT PASSWORD - REQUEST RESET LINK
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    const trimmedEmail = email.toLowerCase().trim().slice(0, 100);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return next(new AppError('Please provide a valid email address.', 400));
    }

    // Lookup user in PostgreSQL
    const userRes = await db.query('SELECT user_id, username, email FROM users WHERE email = $1;', [trimmedEmail]);

    // Constant-time behavior / anti-enumeration: always return same generic success response
    if (userRes.rows.length === 0) {
      res.status(200).json({
        status: 'success',
        message: 'If an account exists for this email, a password reset link has been sent.'
      });
      return;
    }

    const user = userRes.rows[0];

    // Generate single-use cryptographically secure reset token (1 hour validity)
    const rawToken = await passwordResetStore.createResetToken(user.user_id, user.email);

    // Determine application base URL
    const appUrl = process.env.APP_URL || req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    // Dispatch email
    await EmailService.sendPasswordResetEmail(user.email, resetUrl, user.username);

    res.status(200).json({
      status: 'success',
      message: 'If an account exists for this email, a password reset link has been sent.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * VALIDATE RESET TOKEN (Pre-flight check)
 * GET /api/auth/reset-password/validate
 */
export const validateResetToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, email } = req.query;

    if (!token || typeof token !== 'string') {
      return next(new AppError('Reset token is required.', 400));
    }

    const validation = passwordResetStore.validateToken(
      token, 
      typeof email === 'string' ? email : undefined
    );

    if (!validation.valid) {
      return next(new AppError(validation.message || 'Password reset link is invalid or expired.', 400));
    }

    res.status(200).json({
      status: 'success',
      data: {
        valid: true,
        email: validation.email
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * RESET PASSWORD - CONSUME TOKEN & SET NEW PASSWORD
 * POST /api/auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, email, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return next(new AppError('Reset token is required.', 400));
    }

    if (!email || typeof email !== 'string') {
      return next(new AppError('Email is required.', 400));
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
      return next(new AppError('New password must contain between 6 and 128 characters.', 400));
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Consume and invalidate token
    const tokenData = await passwordResetStore.consumeToken(token, trimmedEmail);
    if (!tokenData) {
      return next(new AppError('This password reset link is invalid or has expired. Please request a new one.', 400));
    }

    // Hash new password securely with bcrypt (12 rounds)
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in canonical PostgreSQL database
    const updateRes = await db.query(
      'UPDATE users SET password_hash = $1 WHERE user_id = $2 RETURNING user_id, username, email;',
      [hashedPassword, tokenData.userId]
    );

    if (updateRes.rows.length === 0) {
      return next(new AppError('User not found. Password reset failed.', 404));
    }

    res.status(200).json({
      status: 'success',
      message: 'Your password has been reset successfully. Please log in with your new password.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * AUTHENTICATED USER PROFILE CONTROLLER
 * GET /api/auth/me
 * Returns database-verified current user information
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('You are not logged in. Please sign in.', 401));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          userId: req.user.userId,
          username: req.user.username,
          email: req.user.email,
          role: req.user.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
