/**
 * Auth Routes — POST /api/auth/register, POST /api/auth/login
 *
 * Express Router lets you group related routes together and mount them as a
 * unit in app.js: app.use('/api/auth', authRouter)
 * All routes defined here are automatically prefixed with /api/auth.
 *
 * Routes to register:
 *   POST /register
 *     Body: { username, email, password }
 *     No auth required (the user doesn't have a token yet)
 *     → calls register controller
 *
 *   POST /login
 *     Body: { email, password }
 *     No auth required
 *     → calls login controller
 *
 * Implementation:
 *   import { register, login } from '../controllers/auth.controller.js';
 *   router.post('/register', register);
 *   router.post('/login', login);
 *
 * Note: No requireAuth middleware here — these are public endpoints.
 * Every other route file will use requireAuth.
 */
import { Router } from 'express';
const router = Router();
export default router;
