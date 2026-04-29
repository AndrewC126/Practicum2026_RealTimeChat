/**
 * Messages Service — Business Logic for Messages
 *
 * ─── WHY A SERVICE LAYER HERE? ───────────────────────────────────────────────
 * The controller (HTTP layer) should not write SQL, and the repository should
 * not enforce business rules. The service layer is the boundary:
 *
 *   Controller  → reads HTTP request, calls service, sends HTTP response
 *   Service     → validates inputs, enforces business rules, calls repository
 *   Repository  → executes SQL, returns raw DB rows
 *
 * Even when the logic is "thin" (just delegating), the layer exists so that
 * rules added later (membership checks, rate limits, profanity filters, etc.)
 * have a clear home without touching the controller or repository.
 *
 * ─── getMessageHistory ───────────────────────────────────────────────────────
 * Pure delegation for now. In a future story (US-501) we might add:
 *   - Membership check: is this user allowed to read this room's messages?
 *   - Cursor-based pagination instead of OFFSET
 *   - Message decryption if E2E encryption is added
 * All of that lives here, not in the controller.
 *
 * ─── saveMessage ─────────────────────────────────────────────────────────────
 * Called by the Socket.io chat handler (NOT the REST controller) when a user
 * emits a 'send_message' event. The socket handler already validated on the
 * client side, but we validate again here because:
 *   1. Defense in depth — the server can never trust the client
 *   2. Someone could send a raw socket event without the client-side checks
 *   3. The DB CHECK constraint (1–1000 chars) is the last line of defense,
 *      but a friendly error message from here is better than a raw DB error
 */
import * as messagesRepo from '../repositories/messages.repository.js';

/**
 * getMessageHistory — fetch paginated messages for a room.
 * The repository handles ordering (oldest-first after reversing DESC results).
 */
export async function getMessageHistory(roomId, limit = 50, offset = 0) {
  return messagesRepo.findByRoom(roomId, limit, offset);
}

/**
 * saveMessage — validate and persist a user-typed message.
 *
 * Returns the full saved message row (with DB-generated id and created_at).
 * The socket handler attaches sender_username from socket.data.user before
 * broadcasting, so we don't need to JOIN users here.
 */
export async function saveMessage({ roomId, senderId, body }) {
  const trimmed = body?.trim() ?? '';

  // Validate body — mirrors the DB CHECK constraint so the error is caught
  // here with a friendly message rather than as a cryptic constraint violation.
  if (!trimmed) {
    const err = new Error('Message body cannot be empty');
    err.status = 400;
    throw err;
  }
  if (trimmed.length > 1000) {
    const err = new Error('Message must be 1,000 characters or fewer');
    err.status = 400;
    throw err;
  }

  return messagesRepo.create({ roomId, senderId, body: trimmed });
}
