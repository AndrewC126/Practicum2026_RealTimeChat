/**
 * Rooms Routes — GET /api/rooms, POST /api/rooms, DELETE /api/rooms/:id/members
 *
 * Mounted in app.js as: app.use('/api/rooms', roomsRouter)
 * All routes here are prefixed with /api/rooms.
 *
 * Routes to register:
 *   GET /
 *     List all public rooms (plus rooms the user is a member of if private)
 *     Requires auth (need to know which private rooms to include)
 *     → calls listRooms controller
 *
 *   POST /
 *     Create a new room
 *     Body: { name, description, isPrivate }
 *     Requires auth (the creator becomes the owner)
 *     → calls createRoom controller
 *
 *   DELETE /:id/members
 *     Leave a room (remove the current user from room_members)
 *     Requires auth
 *     → calls leaveRoom controller
 *
 * Implementation:
 *   import { requireAuth } from '../middleware/auth.middleware.js';
 *   import { listRooms, createRoom, leaveRoom } from '../controllers/rooms.controller.js';
 *   router.get('/',                requireAuth, listRooms);
 *   router.post('/',               requireAuth, createRoom);
 *   router.delete('/:id/members',  requireAuth, leaveRoom);
 */
import { Router } from 'express';
const router = Router();
export default router;
