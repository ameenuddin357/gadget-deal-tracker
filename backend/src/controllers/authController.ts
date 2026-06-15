import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

// Helper signing JWT tokens securely
const signToken = (payload: { userId: number; username: string; email: string; role: string }) => {
  const secret = process.env.JWT_SECRET || 'your_jwt_signing_token_key_change_me_in_production';
  const expiry = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn: expiry as any });
};

/**
 * AUTHENTICATION CONTROLLERS - REGISTER USER ACCOUNT
 * POST /api/v1/auth/register
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    // Simple Request Payload Validations
    if (!username || !email || !password) {
      return next(new AppError('Please provide registration details: username, email, password.', 400));
    }

    if (password.length < 6) {
      return next(new AppError('Password must contain at least 6 characters for safety.', 400));
    }

    // Hash the raw password securely using Blowfish bcrypt
    // A salt rounds count of 12 represents an excellent balance of CPU delay vs protection
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user credential tuple safely using Postgres parameterized queries (precludes SQL Injections)
    const sql = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING user_id, username, email, role, created_at;
    `;
    
    const result = await db.query(sql, [username.trim(), email.toLowerCase().trim(), hashedPassword]);
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
    next(err); // Relies on the global PostgreSQL UNIQUE checks handled in errorHandler
  }
};

/**
 * AUTHENTICATION CONTROLLERS - LOGIN PROVIDER
 * POST /api/v1/auth/login
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please enter email and account password.', 400));
    }

    // Lookup user accounts by indexed email path
    const sql = `
      SELECT user_id, username, email, password_hash, role
      FROM users
      WHERE email = $1;
    `;
    const result = await db.query(sql, [email.toLowerCase().trim()]);

    if (result.rows.length === 0) {
      return next(new AppError('Incorrect email or account password.', 401));
    }

    const matchedUser = result.rows[0];

    // Compare supplied password hash against saved hash digest using constant-time evaluation 
    const isMatched = await bcrypt.compare(password, matchedUser.password_hash);

    if (!isMatched) {
      return next(new AppError('Incorrect email or account password.', 401));
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
