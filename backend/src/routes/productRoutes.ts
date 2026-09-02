import { Router } from 'express';
import { getAllProducts, getProductById, searchProducts, getProductPriceHistory, getProductAiRecommendation, handleProductAiChat } from '../controllers/productController.ts';
import { protect } from '../middleware/auth.ts';
import { aiRateLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

// Retrieve list of canonical products with cheapest prices (Accepts pagination page/limit and filter queries)
// GET /api/v1/products
router.get('/', getAllProducts);

// Search product catalog (LIKE wildcards filter)
// GET /api/v1/products/search/:query
router.get('/search/:query', searchProducts);

// GET /api/v1/products/:id/ai-recommendation - Requires Auth
router.get('/:id/ai-recommendation', protect, aiRateLimiter, getProductAiRecommendation);

// POST /api/v1/products/:id/ai-chat - Requires Auth
router.post('/:id/ai-chat', protect, aiRateLimiter, handleProductAiChat);

// Retrieve detailed single product specs and all active pricing structures across partner stores
// GET /api/v1/products/:id
router.get('/:id', getProductById);

router.get('/:id/history', getProductPriceHistory);
export default router;

