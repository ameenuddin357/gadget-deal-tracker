import { Router } from 'express';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../controllers/watchlistController.ts';
import { protect } from '../middleware/auth.ts';
import { userMutationLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

// Protect all watchlist actions with JWT security middleware
router.use(protect);
router.use(userMutationLimiter);

// GET /api/v1/watchlist -> lists current bookmarked items for authenticated account
// POST /api/v1/watchlist -> bookmarks a new catalog product
router.route('/')
  .get(getWatchlist)
  .post(addToWatchlist);

// DELETE /api/v1/watchlist/:id -> removes bookmark by watchlist index parameter
router.delete('/:id', removeFromWatchlist);

export default router;

