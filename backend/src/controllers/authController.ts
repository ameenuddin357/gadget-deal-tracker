import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { passwordResetStore } from '../services/passwordResetStore.ts';
import { EmailService } from '../services/emailService.ts';

// Helper signing JWT tokens securely
const signToken = (payload: { userId: number; username: string; email: string; role: string }) => {
  const secret = process.env.JWT_SECRET || 'your_jwt_signing_token_key_change_me_in_production';
  const expiry = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn: expiry as any });
};

/**
 * AUTHENTICATION CONTROLLER - REGISTER USER ACCOUNT
 * POST /api/auth/register
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, email, password } = req.body;

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

    // Check for existing account first by email or username
    const checkSql = 'SELECT user_id, email, username FROM users WHERE email = $1 OR username = $2;';
    const checkRes = await db.query(checkSql, [trimmedEmail, trimmedUsername]);
    if (checkRes.rows.length > 0) {
      if (checkRes.rows[0].email.toLowerCase() === trimmedEmail) {
        return next(new AppError('An account with this email already exists. Please log in.', 409));
      }
      return next(new AppError('This username is already taken. Please choose another.', 409));
    }

    // Hash the raw password securely using Blowfish bcrypt
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user credential tuple safely using Postgres parameterized queries
    const sql = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING user_id, username, email, role, created_at;
    `;
    
    const result = await db.query(sql, [trimmedUsername, trimmedEmail, hashedPassword]);
    const newUser = result.rows[0];

    // Generate authenticated JWT session Token
    const token = signToken({
      userId: newUser.user_id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    });

    res.status(201).json({
      status: 'success',
      token,
      data: {
        user: {
          userId: newUser.user_id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.created_at
        }
      }
    });
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

    // Lookup user accounts by indexed email path
    const sql = `
      SELECT user_id, username, email, password_hash, role
      FROM users
      WHERE email = $1;
    `;
    const result = await db.query(sql, [trimmedEmail]);

    if (result.rows.length === 0) {
      return next(new AppError('Account not found. Please register first.', 404));
    }

    const matchedUser = result.rows[0];

    if (!matchedUser.password_hash) {
      return next(new AppError('Account password has not been set. Please reset your password.', 400));
    }

    // Compare supplied password hash against saved hash digest using constant-time evaluation 
    const isMatched = await bcrypt.compare(password, matchedUser.password_hash);

    if (!isMatched) {
      return next(new AppError('Wrong password. Please try again.', 401));
    }

    // Sign transaction token
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
