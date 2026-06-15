import { Request, Response, NextFunction } from 'express';

/**
 * Custom Operational Error Class
 * Used to classify anticipated user-triggered errors (like invalid emails or insufficient credentials)
 * from unexpected node execution crashes.
 */
export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Flag identifying checked operational exceptions

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global Express Error Hanlder Middleware
 * Mounted at the end of the middleware pipeline to capture errors passed to next(err)
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Map database connection failures to 503 Service Unavailable
  if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
    err.statusCode = 503;
    err.status = 'error';
    console.warn('[PostgreSQL Connection Refused] Database service is currently offline or unreachable.');
  }

  // Log critical node infrastructure failures
  if (err.statusCode === 500) {
    console.error('[CRITICAL FAILURE]', err);
  }

  // Handle specific PostgreSQL error codes - absolute gold for interviews!
  let errorResponse = {
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  };

  // '23505' is the Postgres UNIQUE_VIOLATION code (e.g. email already registered)
  if (err.code === '23505') {
    errorResponse.message = 'A record with this identifier already exists.';
    res.status(409).json({
      status: 'fail',
      message: errorResponse.message
    });
    return;
  }

  // '23503' is the Postgres FOREIGN_KEY_VIOLATION code
  if (err.code === '23503') {
    errorResponse.message = 'Referenced related item does not exist in our catalog.';
    res.status(400).json({
      status: 'fail',
      message: errorResponse.message
    });
    return;
  }

  res.status(err.statusCode).json({
    status: errorResponse.status,
    message: errorResponse.message,
    ...(errorResponse.stack && { stack: errorResponse.stack })
  });
};
