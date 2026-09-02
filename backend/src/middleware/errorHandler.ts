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
 * Global Express Error Handler Middleware
 * Mounted at the end of the middleware pipeline to capture errors passed to next(err)
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // 1. Handle JSON Body Parser Syntax Errors
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    res.status(400).json({
      status: 'fail',
      message: 'Malformed JSON payload in request body.'
    });
    return;
  }

  // 1b. Handle JWT verification and parsing errors
  if (err.name === 'JsonWebTokenError' || err.message?.includes('jwt') || err.message?.includes('signature')) {
    res.status(401).json({
      status: 'fail',
      message: 'Invalid authentication token signature.'
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      status: 'fail',
      message: 'Your session login has expired. Please sign in again.'
    });
    return;
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // 2. Map database connection failures to 503 Service Unavailable
  if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
    err.statusCode = 503;
    err.status = 'error';
    console.warn('[PostgreSQL Connection Refused] Database service is currently offline or unreachable.');
    res.status(503).json({
      status: 'error',
      message: 'Service is temporarily unavailable. Please try again shortly.'
    });
    return;
  }

  // 3. PostgreSQL Specific Constraint Handlers
  // '23505' is the Postgres UNIQUE_VIOLATION code (e.g. email already registered)
  if (err.code === '23505') {
    res.status(409).json({
      status: 'fail',
      message: 'A record with this identifier already exists.'
    });
    return;
  }

  // '23503' is the Postgres FOREIGN_KEY_VIOLATION code
  if (err.code === '23503') {
    res.status(400).json({
      status: 'fail',
      message: 'Referenced related item does not exist in our catalog.'
    });
    return;
  }

  // '22P02' is the Postgres INVALID_TEXT_REPRESENTATION (e.g., text passed for integer ID)
  if (err.code === '22P02') {
    res.status(400).json({
      status: 'fail',
      message: 'Invalid parameter format supplied.'
    });
    return;
  }

  // 4. Log critical server errors server-side only
  if (err.statusCode === 500) {
    console.error('[SERVER ERROR]', err.message || err);
  }

  // 5. Sanitize message for clients
  const isProduction = process.env.NODE_ENV === 'production';
  let clientMessage = err.message || 'An unexpected error occurred.';

  // If 500 internal error in production, hide internals (SQL, file paths, DB names)
  if (err.statusCode === 500 && !err.isOperational) {
    clientMessage = 'An internal server error occurred. Please try again later.';
  }

  // Never expose raw stack traces to HTTP clients in API responses
  res.status(err.statusCode).json({
    status: err.status,
    message: clientMessage
  });
};


