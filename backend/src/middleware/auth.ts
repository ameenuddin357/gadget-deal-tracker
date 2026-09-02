import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.ts';
import db from '../config/db.ts';

// Extend the Express Request type declaration to support custom 'user' fields
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        username: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Authentication Gate Middleware
 * Restricts route access to bearer-certified visitors only
 */
export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Retrieve authentication token from Bearer prefix in HTTP headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('You are not logged in. Please sign in to request this page.', 401)
      );
    }

    // Decode and verify token signature authenticity
    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_signing_token_key_change_me_in_production';
    
    if (!jwtSecret) {
      return next(new AppError('Server configuration error: JWT_SECRET is required.', 500));
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: number;
      username: string;
      email: string;
      role: string;
    };

    // VERIFY USER STILL EXISTS IN DATABASE
    const userRes = await db.query(
      'SELECT user_id, username, email, role FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // Attach verified user account data to current Express Request execution thread
    req.user = {
      userId: userRes.rows[0].user_id,
      username: userRes.rows[0].username,
      email: userRes.rows[0].email,
      role: userRes.rows[0].role
    };

    next();
  } catch (err: any) {
    if (
      err.name === 'JsonWebTokenError' ||
      err.name === 'TokenExpiredError' ||
      err.name === 'NotBeforeError' ||
      err instanceof SyntaxError ||
      err.message?.includes('JSON') ||
      err.message?.includes('jwt')
    ) {
      return next(new AppError('Invalid or expired authentication token. Please sign in again.', 401));
    }
    next(err);
  }
};

/**
 * Role authorization guard
 * Restricts backend actions (such as product creation or crawling parameters) to specific user roles
 */
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('Permission Denied. You do not hold permissions to operate this action.', 403)
      );
    }
    next();
  };
};
