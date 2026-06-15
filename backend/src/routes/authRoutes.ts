import { Router } from 'express';
import { register, login } from '../controllers/authController.ts';

const router = Router();

// Endpoint routes mapped to respective controller methods
// POST /api/v1/auth/register -> creates user profiles
router.post('/register', register);

// POST /api/v1/auth/login -> logs users in
router.post('/login', login);

export default router;
