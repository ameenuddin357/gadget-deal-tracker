import { Router } from 'express';
import authRouter from './authRoutes.ts';
import productRouter from './productRoutes.ts';
import watchlistRouter from './watchlistRoutes.ts';
import alertRouter from './alertRoutes.ts';
import historyRouter from './historyRoutes.ts';

const router = Router();

// Namespace all functional sub-routers under standard REST API resource paths
router.use('/auth', authRouter);
router.use('/products', productRouter);
router.use('/watchlist', watchlistRouter);
router.use('/alerts', alertRouter);
router.use('/history', historyRouter);

// Base resource health check path
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'E-Commerce Gadget Deal Tracker REST APIs are fully active and healthy.',
    timestamp: new Date().toISOString()
  });
});

export default router;
