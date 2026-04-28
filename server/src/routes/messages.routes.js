/**
 * Messages Routes — GET /api/rooms/:id/messages
 *
 * Mounted in app.js as: app.use('/api/rooms', messagesRouter)
 * (Shares the /api/rooms prefix with rooms.routes.js because the messages
 * resource is nested under rooms.)
 *
 * Routes to register:
 *   GET /:id/messages
 *     Fetch paginated message history for a room (US-501, US-502)
 *     Query params: limit (default 50), offset (default 0)
 *     Example: GET /api/rooms/abc-123/messages?limit=50&offset=100
 *     Requires auth (can't read messages for rooms you haven't joined)
 *     → calls getMessages controller
 *
 * Implementation:
 *   import { requireAuth } from '../middleware/auth.middleware.js';
 *   import { getMessages } from '../controllers/messages.controller.js';
 *   router.get('/:id/messages', requireAuth, getMessages);
 *
 * Pagination pattern (LIMIT / OFFSET):
 *   The client sends the offset of the oldest message it has loaded.
 *   The server queries: SELECT ... ORDER BY created_at DESC LIMIT $1 OFFSET $2
 *   The client calls fetchNextPage() when scrolling up, incrementing the offset.
 */
import { Router } from 'express';
const router = Router();
export default router;
