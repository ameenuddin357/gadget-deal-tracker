import express from 'express';
import dotenv from 'dotenv';
import apiRouter from './routes/api.ts';
import shoppingApiRouter from './routes/shoppingApiRoutes.ts';
import { errorHandler, AppError } from './middleware/errorHandler.ts';
import { initializeDatabase } from './config/initDb.ts';

// Load environmental variables
dotenv.config();

// Auto-initialize PostgreSQL Database schemas on start
initializeDatabase().catch((err: any) => {
  console.warn('[PostgreSQL Warn] Database schema initialization deferred or failed:', err.message);
});

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Basic Request Pre-processing Middlewares
app.use(express.json()); // Parses incoming applications/json payload bodies on req.body

// Mount consolidated REST gateways
app.use('/api', shoppingApiRouter);
app.use('/api/v1', apiRouter);

// Handle unknown route endpoints gracefully by forwarding a custom 404 block to the error handler
app.all('*', (req, res, next) => {
  next(new AppError(`Cannot find the requested endpoint: [${req.method}] ${req.originalUrl} on this server.`, 404));
});

// Mount the global JSON error handler wrapper (MUST be placed last in the middleware stack!)
app.use(errorHandler);

// Launch HTTP server listening for container ingress traffic
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================================`);
  console.log(`🚀 SENIOR ARCHITECT EXPENDITURE PORTAL - LIVE AND READY`);
  console.log(`📡 Backend listening at: http://0.0.0.0:${PORT}`);
  console.log(`🔧 Run Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`================================================================`);
});

// Handle unhandled asynchronous promise rejections safely to dodge container crash downs
process.on('unhandledRejection', (err: any) => {
  console.error('[UNHANDLED REJECTION] Shutting down server gracefully...', err);
  server.close(() => {
    process.exit(1);
  });
});
