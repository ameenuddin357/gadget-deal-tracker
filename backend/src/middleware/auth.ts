import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.ts';

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
    
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: number;
      username: string;
      email: string;
      role: string;
    };

    // Attach verified user account data to current Express Request execution thread
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid authentication token signature.', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session login has expired. Please sign in again.', 401));
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
