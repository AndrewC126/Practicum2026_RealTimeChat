/**
 * Rooms Service — Business Logic for Room Management
 *
 * ─── THE SERVICE LAYER'S JOB ─────────────────────────────────────────────────
 * The service sits between the controller (HTTP layer) and the repository (SQL
 * layer). It contains rules like:
 *   "before creating a room, validate the name length"
 *   "when a user joins a room, auto-add them to room_members"
 *
 * Controllers should not write SQL, and repositories should not know about
 * business rules. Keeping these concerns in separate layers makes each layer
 * independently testable and replaceable.
 */
import * as roomsRepo  from '../repositories/rooms.repository.js';
import * as usersRepo  from '../repositories/users.repository.js';

/**
 * getRooms(userId)
 *
 * Returns only the rooms the requesting user is currently a member of.
 * Passing userId down to the repository lets the SQL JOIN filter to
 * "your rooms" — so leaving a room (removing the row) makes it disappear
 * from the sidebar automatically on the next refetch.
 */
export async function getRooms(userId) {
  return roomsRepo.findAllForUser(userId);
}

export async function createRoom({ name, description, isPrivate, ownerId }) {
  // Validate name length to match the DB CHECK constraint (1–50 chars).
  // Catching this here gives a friendly 400 error instead of a cryptic DB error.
  if (!name?.trim()) {
    const err = new Error('Room name is required');
    err.status = 400;
    throw err;
  }
  if (name.trim().length > 50) {
    const err = new Error('Room name must be 50 characters or fewer');
    err.status = 400;
    throw err;
  }

  // Check for a duplicate name before hitting the DB constraint.
  // This gives a specific 409 error message instead of a raw DB error.
  // The DB UNIQUE constraint on rooms.name is still the definitive safety net
  // for race conditions (two users creating a room with the same name at the
  // exact same millisecond), but that edge case is caught by error.middleware.
  const existing = await roomsRepo.findByName(name.trim());
  if (existing) {
    const err = new Error('Room name is already taken');
    err.status = 409;
    throw err;
  }

  const room = await roomsRepo.createRoom({
    name: name.trim(),
    description: description?.trim() || null,
    isPrivate: isPrivate ?? false,
    ownerId,
  });

  // Automatically add the creator as the first member (US-202 AC).
  // addMember is idempotent so this is safe to call even if somehow they
  // are already a member.
  await roomsRepo.addMember(room.id, ownerId);

  return room;
}

export async function leaveRoom(roomId, userId) {
  await roomsRepo.removeMember(roomId, userId);
}

/**
 * getPublicRooms(userId)
 *
 * Returns every public room with an `is_member` flag showing whether the
 * requesting user has already joined it. Used by US-205 (Browse Rooms modal).
 *
 * The service layer here is thin — it just delegates to the repository.
 * We still route through the service (instead of calling the repo directly
 * from the controller) to keep the layered architecture consistent, and to
 * leave a place for future business rules (e.g., filtering banned users).
 */
export async function getPublicRooms(userId) {
  return roomsRepo.findAllPublic(userId);
}

/**
 * checkMembership(roomId, userId)
 *
 * Returns true if `userId` is currently a member of `roomId`, false otherwise.
 * Used by the invite controller to enforce: "Only current members can invite others."
 * Wrapping isMember in a service function follows the project's layering convention
 * and keeps the controller free of direct repository imports.
 *
 * @param {string} roomId — UUID of the room
 * @param {string} userId — UUID of the user to check
 * @returns {Promise<boolean>}
 */
export async function checkMembership(roomId, userId) {
  return roomsRepo.isMember(roomId, userId);
}

/**
 * searchInvitees(query, roomId)
 *
 * Returns users whose username partially matches `query` and who are NOT
 * already members of `roomId`. Used to populate the InviteModal search results.
 *
 * Delegates directly to usersRepo — no additional business rules are needed
 * here beyond what the repository query already enforces (exclusion of existing
 * members and the result cap).
 *
 * @param {string} query  — partial username search term (at least 1 char)
 * @param {string} roomId — UUID of the room whose members should be excluded
 * @returns {Promise<Array<{ id: string, username: string }>>}
 */
export async function searchInvitees(query, roomId) {
  return usersRepo.searchUsersNotInRoom(query, roomId);
}
