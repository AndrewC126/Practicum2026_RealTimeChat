/**
 * Messages Controller — HTTP Request Handler for Message History
 *
 * ─── CONTROLLER RESPONSIBILITIES ─────────────────────────────────────────────
 * 1. Read data from the request  (req.params, req.query, req.user)
 * 2. Call the service layer
 * 3. Send the HTTP response
 * 4. Forward any errors to next(err) — the central error handler converts
 *    them into JSON responses with the right status code
 *
 * ─── PAGINATION WITH LIMIT / OFFSET ─────────────────────────────────────────
 * The client requests a page of messages using two query parameters:
 *
 *   limit   — how many messages to return (default: 50, capped at 100)
 *   offset  — how many messages to skip from the newest end (default: 0)
 *
 * Example: GET /api/rooms/abc-123/messages?limit=50&offset=0
 *   → Returns messages 1–50  (the 50 most recent, in chronological order)
 *
 * Example: GET /api/rooms/abc-123/messages?limit=50&offset=50
 *   → Returns messages 51–100 (the next 50 older messages)
 *
 * The client detects the last page by checking if fewer messages than
 * `limit` were returned: if messages.length < limit → no more pages.
 *
 * ─── parseInt and safe defaults ──────────────────────────────────────────────
 * Query parameters always arrive as strings ("50"), not numbers (50).
 * parseInt("50") → 50.  parseInt(undefined) → NaN.
 * The || operator replaces NaN with a default: parseInt(undefined) || 50 → 50.
 *
 * Math.min(…, 100) caps the limit so a client can't request 10,000 messages
 * in one call and overwhelm the database.
 *
 * Math.max(…, 0) ensures offset can't be negative (which would be invalid SQL).
 *
 * ─── Why no POST /messages here? ─────────────────────────────────────────────
 * New messages are created via Socket.io, not REST. The socket handler calls
 * messagesService.saveMessage() directly. This endpoint is GET-only — loading
 * history when a user opens a room or scrolls up for older messages.
 */
import * as messagesService from '../services/messages.service.js';

export async function getMessages(req, res, next) {
  try {
    // :id in the route pattern /:id/messages sets req.params.id
    const roomId = req.params.id;

    // Parse query params from strings to integers, with safe defaults.
    // parseInt('abc') → NaN, so the || fallback kicks in.
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 100); // max 100
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);   // min 0

    const messages = await messagesService.getMessageHistory(roomId, limit, offset);

    // 200 OK with the messages array.
    // The client (useMessages) uses messages.length < limit to detect end-of-history.
    res.status(200).json(messages);
  } catch (err) {
    next(err);
  }
}
