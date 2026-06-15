import { Router } from 'express';
import { getAllProducts, getProductById, searchProducts } from '../controllers/productController.ts';

const router = Router();

// Retrieve list of canonical products with cheapest prices (Accepts pagination page/limit and filter queries)
// GET /api/v1/products
router.get('/', getAllProducts);

// Search product catalog (LIKE wildcards filter)
// GET /api/v1/products/search/:query
router.get('/search/:query', searchProducts);

// Retrieve detailed single product specs and all active pricing structures across partner stores
// GET /api/v1/products/:id
router.get('/:id', getProductById);

export default router;
