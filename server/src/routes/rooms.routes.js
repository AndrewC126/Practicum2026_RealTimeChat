/**
 * Rooms Routes — GET /api/rooms, POST /api/rooms, DELETE /api/rooms/:id/members
 *
 * ─── HOW EXPRESS ROUTER WORKS ────────────────────────────────────────────────
 * Router() creates a mini Express app. You define routes on it, then mount
 * it in app.js with app.use('/api/rooms', roomsRouter). Every path here is
 * automatically prefixed with /api/rooms.
 *
 * Route parameters use a colon prefix:
 *   router.delete('/:id/members', ...)
 *   A request to DELETE /api/rooms/abc-123/members sets req.params.id = 'abc-123'
 *
 * ─── MIDDLEWARE CHAINING ─────────────────────────────────────────────────────
 * router.get('/', requireAuth, listRooms)
 *                ↑             ↑
 *          runs first      runs if requireAuth calls next()
 *
 * You can chain as many middleware functions as you need before the final handler.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { listRooms, createRoom, leaveRoom, listPublicRooms } from '../controllers/rooms.controller.js';

const router = Router();

// GET /api/rooms — list rooms the authenticated user is a member of
router.get('/', requireAuth, listRooms);

// GET /api/rooms/public — list ALL public rooms (with is_member flag) for US-205.
//
// ─── WHY THIS MUST COME BEFORE /:id ROUTES ───────────────────────────────────
// Express matches routes in the order they are registered. If a wildcard route
// like  router.get('/:id', ...)  were registered first, a request to
// GET /api/rooms/public would match it with req.params.id === 'public' — a UUID
// lookup that would fail or return a wrong result.
//
// By registering '/public' BEFORE any '/:id' routes, Express matches the literal
// path first and never reaches the wildcard.
router.get('/public', requireAuth, listPublicRooms);

// POST /api/rooms — create a new room
router.post('/', requireAuth, createRoom);

// DELETE /api/rooms/:id/members — leave a room
router.delete('/:id/members', requireAuth, leaveRoom);

export default router;
