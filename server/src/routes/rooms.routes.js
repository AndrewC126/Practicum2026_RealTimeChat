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
import { listRooms, createRoom, leaveRoom } from '../controllers/rooms.controller.js';

const router = Router();

// GET /api/rooms — list all public rooms
router.get('/', requireAuth, listRooms);

// POST /api/rooms — create a new room
router.post('/', requireAuth, createRoom);

// DELETE /api/rooms/:id/members — leave a room
router.delete('/:id/members', requireAuth, leaveRoom);

export default router;
