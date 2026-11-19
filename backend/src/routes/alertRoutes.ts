import { Router } from 'express';
import { createAlert, getUserAlerts, updateAlert, deleteAlert } from '../controllers/alertController.ts';
import { protect } from '../middleware/auth.ts';
import { userMutationLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

// Secure all alert endpoints under the JWT session guard
router.use(protect);
router.use(userMutationLimiter);

// GET /api/v1/alerts -> retrieves active/inactive alert milestones logged by user
// POST /api/v1/alerts -> registers a brand new price target trigger (or updates existing active alert)
router.route('/')
  .get(getUserAlerts)
  .post(createAlert);

// PUT /api/v1/alerts/:id -> updates existing alert target price
// DELETE /api/v1/alerts/:id -> drops standard alerts by specific alert database index
router.route('/:id')
  .put(updateAlert)
  .patch(updateAlert)
  .delete(deleteAlert);

export default router;


