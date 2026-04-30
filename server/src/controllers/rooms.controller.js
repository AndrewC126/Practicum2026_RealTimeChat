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

/**
 * searchInvitees — GET /api/rooms/:id/invitees?q=<username>
 *
 * Returns users whose username matches the search query and who are NOT
 * already members of the room. Used by the InviteModal to populate live
 * search results as the user types.
 *
 * ─── AUTHORIZATION ───────────────────────────────────────────────────────────
 * AC: "Only current members of the room can invite others."
 * We verify the requesting user is a member BEFORE running the search.
 * If they are not, we respond with 403 Forbidden — the same error the socket
 * handler returns for the same violation. Two entry points, same rule.
 *
 * ─── QUERY PARAMETER VALIDATION ──────────────────────────────────────────────
 * req.query.q is the `?q=...` part of the URL (provided by the search input).
 * We require at least 1 character so we don't accidentally return all users
 * when the search box is empty (which would be a privacy concern on a large
 * deployment). The limit defaults to 10 results.
 */
/**
 * getRoomMembers — GET /api/rooms/:id/members
 *
 * Returns all members of a room with profile data needed for the MemberList
 * panel and the profile popover:
 *   { id, username, joinedAt, userCreatedAt }
 *
 * No membership check required here — any authenticated user who knows a
 * roomId can list its members. This matches real-world chat apps (Discord,
 * Slack) where member lists are visible to anyone who can access the room.
 * Access to the room itself is already gated by join/invite flows.
 */
export async function getRoomMembers(req, res, next) {
  try {
    const members = await roomsService.getRoomMembers(req.params.id);
    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}

export async function searchInvitees(req, res, next) {
  try {
    const roomId = req.params.id;      // :id segment from the URL
    const userId = req.user.id;        // from the JWT (requireAuth middleware)
    const query  = req.query.q ?? ''; // ?q= search string

    // Require a non-empty search query so we don't return the whole user table
    if (!query.trim()) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Enforce membership — only room members may use the invite feature
    const membershipOk = await roomsService.checkMembership(roomId, userId);
    if (!membershipOk) {
      return res.status(403).json({ error: 'You must be a member of this room to invite others' });
    }

    const users = await roomsService.searchInvitees(query.trim(), roomId);
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
}
