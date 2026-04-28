/**
 * Messages Service — Business Logic for Messages
 *
 * getMessageHistory(roomId, limit, offset):
 *   1. Call messagesRepository.findByRoom(roomId, limit, offset)
 *   2. Return the result (the repository does the actual SQL)
 *   This service is thin here because there is no extra business logic.
 *   It exists to keep the controller from calling the repository directly,
 *   preserving the layered architecture for when logic is added later
 *   (e.g., checking room membership before returning messages).
 *
 * saveMessage(data):
 *   data: { roomId, senderId, body }
 *   1. Validate body length: 1–1000 characters
 *   2. Call messagesRepository.create(data)
 *   3. Optionally: increment unread_count for all room members except the sender
 *        UPDATE room_members
 *        SET unread_count = unread_count + 1
 *        WHERE room_id = $1 AND user_id != $2
 *      This requires a direct pool.query here or a method on the repository.
 *   4. Return the saved message object (with id, created_at from the DB)
 *
 * Called from: chat.handler.js (via Socket.io, not HTTP)
 */

// Paginated history (LIMIT/OFFSET) and message persistence
export async function getMessageHistory(roomId, limit, offset) {}
export async function saveMessage(data) {}
