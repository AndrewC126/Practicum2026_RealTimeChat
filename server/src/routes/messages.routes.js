/**
 * Messages Routes — GET /api/rooms/:id/messages
 *
 * ─── HOW THIS ROUTE IS MOUNTED ───────────────────────────────────────────────
 * In app.js:
 *   app.use('/api/rooms', messagesRouter);
 *
 * So a request to GET /api/rooms/abc-123/messages is matched like this:
 *   app.use('/api/rooms', ...)       → strips '/api/rooms', leaves '/abc-123/messages'
 *   router.get('/:id/messages', ...) → :id captures 'abc-123'
 *   req.params.id === 'abc-123'
 *
 * Both rooms.routes.js and messages.routes.js share the '/api/rooms' prefix.
 * Express runs them independently — having two routers on the same prefix is
 * perfectly fine; Express tries each in the order they were registered.
 *
 * ─── PAGINATION ──────────────────────────────────────────────────────────────
 * Query parameters control how many messages are returned and where to start:
 *   GET /api/rooms/:id/messages              → 50 most recent messages
 *   GET /api/rooms/:id/messages?limit=20     → 20 most recent messages
 *   GET /api/rooms/:id/messages?offset=50    → 50 most recent, skip the newest 50
 *
 * The controller parses and validates these values; this route file just wires
 * the path to the middleware chain.
 *
 * ─── AUTHENTICATION ──────────────────────────────────────────────────────────
 * requireAuth runs BEFORE getMessages. If the JWT is missing or invalid,
 * requireAuth sends a 401 and getMessages never runs. This prevents
 * unauthenticated users from reading private message history.
 */
import { Router }     from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getMessages } from '../controllers/messages.controller.js';

const router = Router();

// GET /api/rooms/:id/messages — load historical messages for a room
router.get('/:id/messages', requireAuth, getMessages);

export default router;
