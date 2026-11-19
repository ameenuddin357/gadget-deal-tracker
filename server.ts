import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Centralized Environment Architecture:
// - Runtime / AI Studio Secrets (process.env.JWT_SECRET, etc.) have highest priority.
// - In development (NODE_ENV !== 'production'): .env.local is an optional local fallback only.
//   It does NOT override runtime environment variables (override: false).
// - In production (NODE_ENV === 'production'): .env.local is NOT loaded; configuration is supplied strictly by hosting platform environment variables.
// - validateEnvironment() validates that JWT_SECRET is present and secure (>= 32 chars).
if (process.env.NODE_ENV !== 'production') {
  if (fs.existsSync('.env.local')) {
    dotenv.config({ path: '.env.local', override: false });
  }
}

// Run startup environment configuration checks
import { validateEnvironment } from './backend/src/config/validateEnv.ts';
validateEnvironment();

// Import central controllers & sub-routers from MVC Backend
import authRouter from './backend/src/routes/authRoutes.ts';
import productRouter from './backend/src/routes/productRoutes.ts';
import watchlistRouter from './backend/src/routes/watchlistRoutes.ts';
import alertRouter from './backend/src/routes/alertRoutes.ts';
import historyRouter from './backend/src/routes/historyRoutes.ts';
import shoppingApiRouter from './backend/src/routes/shoppingApiRoutes.ts';
import adminRouter from './backend/src/routes/adminRoutes.ts';
import dashboardRouter from './backend/src/routes/dashboardRoutes.ts';
import { errorHandler, AppError } from './backend/src/middleware/errorHandler.ts';
import { globalApiLimiter } from './backend/src/middleware/rateLimiter.ts';
import { verifyDatabaseSchema } from './backend/src/config/initDb.ts';
import { startScheduler } from './backend/src/services/scheduler.ts';
import helmet from 'helmet';

async function startServer() {
  console.log('[Full-Stack Server] Initializing process context...');

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  // Explicitly disable Express framework fingerprinting
  app.disable('x-powered-by');

  // Configure reverse-proxy trust policy conservatively via TRUST_PROXY_HOPS
  const rawHops = process.env.TRUST_PROXY_HOPS;
  if (rawHops !== undefined && rawHops.trim() !== '') {
    const parsedHops = parseInt(rawHops.trim(), 10);
    if (!isNaN(parsedHops) && parsedHops >= 0 && parsedHops <= 10) {
      if (parsedHops > 0) {
        app.set('trust proxy', parsedHops);
        console.log(`[Security] Reverse proxy trust enabled for ${parsedHops} hop(s).`);
      } else {
        app.set('trust proxy', false);
        console.log('[Security] Reverse proxy trust explicitly disabled (0 hops).');
      }
    } else {
      console.warn(`[Security] Invalid TRUST_PROXY_HOPS value "${rawHops}". Must be an integer between 0 and 10. Leaving trust proxy disabled.`);
      app.set('trust proxy', false);
    }
  } else {
    // Default: disabled in local development / direct environments
    app.set('trust proxy', false);
  }

  // Mount Helmet with conservative baseline headers preserving development, preview iframe, and external asset compatibility
  app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Verify database schema readiness (strictly read-only)
  try {
    await verifyDatabaseSchema();
    startScheduler();
  } catch (err: any) {
    console.error('[PostgreSQL Error] Database schema readiness check failed:', err?.message || 'Unknown database error');
    process.exit(1);
  }

  // 1. Core Request Middlewares: Body parser with 100kb limit & rate limiting
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use('/api', globalApiLimiter);

  // 2. REST API Resource Route Maps (Eliminates Route Prefix Mismatches!)
  app.use('/api/auth', authRouter);
  app.use('/api/products', productRouter);
  app.use('/api/watchlist', watchlistRouter);
  app.use('/api/alerts', alertRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/stores', shoppingApiRouter);
  app.use('/api', shoppingApiRouter);



  // Root level API health probe
  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'success',
      message: 'Unifed Full-Stack E-Commerce Portal is live and connected!',
      timestamp: new Date().toISOString()
    });
  });

  // Catch-all 404 for unmatched /api routes before Vite middleware / static asset serving
  app.all('/api/*', (req, res, next) => {
    next(new AppError(`Cannot find requested API endpoint: [${req.method}] ${req.originalUrl}`, 404));
  });

  // Explicitly deny public access to backend bundle, source maps, and server build directory
  app.all(['/dist-server', '/dist-server/*', '/server.cjs', '/server.cjs.map', '/*.cjs', '/*.cjs.map'], (req, res) => {
    res.status(404).send('Not Found');
  });

  // 3. Vite Development Middleware Integration vs static production bundle serving
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Vite Middleware] Coupling active React HMR server...');
    const viteInstance = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    
    // Couple Vite asset compilation middlewares
    app.use(viteInstance.middlewares);
  } else {
    console.log('[Static Server] Mounting production web assets in /dist...');
    const distPath = path.resolve(process.cwd(), 'dist');
    
    // Serve static files generated by Vite build phase
    app.use(express.static(distPath));
    
    // Route unmatched paths to spa index to ensure client-side routers work beautifully on refresh
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 4. Global Express JSON exception handler (MUST be mounted after routes/middlewares!)
  app.use(errorHandler);

  // 5. Fire up Server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`🚀 SENIOR ARCHITECT UNIFIED PORTAL - DEPLOYMENT READY`);
    console.log(`📡 Server running at: http://0.0.0.0:${PORT}`);
    console.log(`🔧 Run Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`================================================================`);
  });

  // Gracefully handle unhandled async promise rejections to dodge abrupt crashes
  process.on('unhandledRejection', (err: any) => {
    console.error('[UNHANDLED REJECTION] Graceful shutdown in progress...', err);
    server.close(() => {
      process.exit(1);
    });
  });
}

startServer();
