import { Router } from 'express';
import { 
  getSearchHistory, 
  recordSearch, 
  deleteSearchQuery, 
  clearSearchHistory 
} from '../controllers/historyController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

// Protect all history actions with JWT security middleware
router.use(protect);

// GET /api/history -> List recent search queries
// POST /api/history -> Record a new search term
// DELETE /api/history -> Clear search history completely
router.route('/')
  .get(getSearchHistory)
  .post(recordSearch)
  .delete(clearSearchHistory);

// DELETE /api/history/item -> Remove a specific search query term
router.delete('/item', deleteSearchQuery);

export default router;
