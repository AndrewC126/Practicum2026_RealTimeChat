/**
 * Rooms Controller — HTTP Request Handlers
 *
 * ─── CONTROLLER RESPONSIBILITIES ─────────────────────────────────────────────
 * 1. Read data from the request  (req.body, req.params, req.query, req.user)
 * 2. Call the service layer
 * 3. Send the HTTP response
 * 4. Forward errors to next(err) — the central error handler in error.middleware
 *    converts the error into a JSON response with the right status code.
 *
 * Controllers never write SQL and never contain business rules — those belong
 * in the service and repository layers respectively.
 *
 * ─── req.user ────────────────────────────────────────────────────────────────
 * req.user is attached by the requireAuth middleware BEFORE this function runs.
 * It contains the decoded JWT payload: { id, username }.
 * We use req.user.id wherever we need to know which user made the request.
 */
import * as roomsService from '../services/rooms.service.js';

export async function listRooms(req, res, next) {
  try {
    // Pass the requesting user's ID so the service/repo can filter the room
    // list to only rooms this user is a member of (US-204: leaving a room
    // removes it from the user's sidebar after the next fetch).
    const rooms = await roomsService.getRooms(req.user.id);
    res.status(200).json(rooms);
  } catch (err) {
    next(err);
  }
}

export async function createRoom(req, res, next) {
  try {
    const { name, description, isPrivate } = req.body;
    const ownerId = req.user.id; // set by requireAuth

    const room = await roomsService.createRoom({ name, description, isPrivate, ownerId });
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
}

export async function leaveRoom(req, res, next) {
  try {
    // req.params.id is the :id segment from the URL: DELETE /api/rooms/:id/members
    const roomId = req.params.id;
    const userId = req.user.id;

    await roomsService.leaveRoom(roomId, userId);

    // 204 No Content: success, but nothing to send back
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

/**
 * listPublicRooms — GET /api/rooms/public
 *
 * Returns every public room in the application, each annotated with an
 * `is_member` boolean so the client can visually distinguish rooms the
 * user has already joined (US-205 AC: "Joined" label).
 *
 * We pass req.user.id so the repository can compute is_member per-user
 * via its LEFT JOIN on room_members.
 */
export async function listPublicRooms(req, res, next) {
  try {
    const rooms = await roomsService.getPublicRooms(req.user.id);
    res.status(200).json(rooms);
  } catch (err) {
    next(err);
  }
}
