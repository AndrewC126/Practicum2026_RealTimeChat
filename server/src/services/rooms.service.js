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
import * as roomsRepo from '../repositories/rooms.repository.js';

export async function getRooms() {
  // No business logic needed here yet — just delegate to the repository.
  // The service layer still exists so that if we later need to add logic
  // (e.g., filter rooms by user permissions), it goes here, not in the controller.
  return roomsRepo.findAllPublic();
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
