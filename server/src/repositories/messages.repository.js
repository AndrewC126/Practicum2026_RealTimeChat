/**
 * Messages Repository — All SQL Touching the messages Table
 *
 * findByRoom(roomId, limit, offset):
 *   SELECT
 *     m.id, m.body, m.created_at, m.is_system_message,
 *     m.sender_id,
 *     u.username AS sender_username
 *   FROM messages m
 *   LEFT JOIN users u ON u.id = m.sender_id
 *   WHERE m.room_id = $1
 *   ORDER BY m.created_at DESC
 *   LIMIT $2 OFFSET $3
 *
 *   Key points:
 *   - LEFT JOIN users: preserves messages whose sender was deleted (sender_id = NULL)
 *   - ORDER BY created_at DESC: newest first — the client reverses to display oldest at top
 *   - The DB index on (room_id, created_at DESC) makes this query fast
 *
 * create(data):
 *   data: { roomId, senderId, body, isSystemMessage = false }
 *   INSERT INTO messages (room_id, sender_id, body, is_system_message)
 *   VALUES ($1, $2, $3, $4)
 *   RETURNING id, room_id, sender_id, body, is_system_message, created_at
 *
 *   After insertion, the chat handler joins the returned row with the sender's
 *   username (from socket.data.user.username) before broadcasting — no need
 *   for a second SELECT.
 */

// All SQL touching the messages table
export async function findByRoom(roomId, limit, offset) {}
export async function create(data) {}
