import { Router } from 'express';
import { createAlert, getUserAlerts, deleteAlert } from '../controllers/alertController.ts';
import { protect } from '../middleware/auth.ts';

const router = Router();

// Secure all alert endpoints under the JWT session guard
router.use(protect);

// GET /api/v1/alerts -> retrieves active/inactive alert milestones logged by user
// POST /api/v1/alerts -> registers a brand new price target trigger
router.route('/')
  .get(getUserAlerts)
  .post(createAlert);

// DELETE /api/v1/alerts/:id -> drops standard alerts by specific alert database index
router.delete('/:id', deleteAlert);

export default router;
