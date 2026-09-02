import { Router } from 'express';
import { getDashboardStats, getBestDeals, getPriceDrops } from '../controllers/dashboardController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/best-deals', getBestDeals);
router.get('/price-drops', getPriceDrops);

export default router;
