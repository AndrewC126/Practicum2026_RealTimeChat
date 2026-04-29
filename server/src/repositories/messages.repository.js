/**
 * Messages Repository — All SQL Touching the messages Table
 *
 * ─── findByRoom ───────────────────────────────────────────────────────────────
 * Fetches paginated message history for one room.
 *
 * Key design decisions:
 *
 *   LEFT JOIN users
 *     A regular (INNER) JOIN would silently drop messages whose sender was
 *     deleted — the foreign key is set to ON DELETE SET NULL, so sender_id
 *     becomes NULL when a user is deleted but their messages are kept.
 *     LEFT JOIN preserves those messages; sender_username just shows NULL.
 *
 *   ORDER BY created_at DESC
 *     We fetch newest-first so LIMIT/OFFSET gives us the most recent N
 *     messages. If we ordered ASC and used OFFSET to paginate backwards
 *     (loading older messages), the offset would change as new messages
 *     arrive — causing items to be skipped or repeated.
 *
 *   rows.reverse()
 *     The DB returns [newest … oldest]. The client wants [oldest … newest]
 *     so messages render top-to-bottom in chronological order. We reverse
 *     on the server so the client never has to think about it.
 *
 * ─── create ───────────────────────────────────────────────────────────────────
 * Inserts one message row and immediately returns the saved row via RETURNING.
 * We rely on RETURNING so we get the server-generated `id` and `created_at`
 * values without doing a separate SELECT.
 *
 * Why NOT auto-generate the id on the client?
 *   Generating UUIDs on the client is possible (crypto.randomUUID()), but the
 *   DB's gen_random_uuid() is the authoritative source of truth. Using the
 *   DB id means we never have a mismatch between what the client thinks the id
 *   is and what the database actually stored.
 *
 * ─── Parameterized queries ($1, $2, …) ────────────────────────────────────────
 * NEVER interpolate variables directly into SQL strings:
 *   BAD:  `SELECT … WHERE room_id = '${roomId}'`   ← SQL injection risk
 *   GOOD: pool.query('SELECT … WHERE room_id = $1', [roomId])
 *
 * node-postgres sends the values as separate data to the DB engine, which
 * treats them as literals, never as SQL code — injection is impossible.
 */
import { pool } from '../db/pool.js';

/**
 * Returns the last `limit` messages for a room, oldest-first.
 * `offset` skips that many messages from the newest end — used for pagination
 * (loading older messages when the user scrolls up).
 */
export async function findByRoom(roomId, limit = 50, offset = 0) {
  const { rows } = await pool.query(
    `SELECT m.id,
            m.room_id,
            m.sender_id,
            u.username  AS sender_username,
            m.body,
            m.is_system_message,
            m.created_at
     FROM   messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE  m.room_id = $1
     ORDER  BY m.created_at DESC
     LIMIT  $2 OFFSET $3`,
    [roomId, limit, offset]
  );

  // DB returned newest-first; reverse so the array is oldest-first.
  // MessageList renders index 0 at the top of the chat — oldest message
  // should be at the top, newest at the bottom.
  return rows.reverse();
}

/**
 * Inserts a new message and returns the full saved row.
 * `isSystemMessage` defaults to false for user-typed messages; join/leave
 * handlers pass true for their system event messages.
 */
export async function create({ roomId, senderId, body, isSystemMessage = false }) {
  const { rows } = await pool.query(
    `INSERT INTO messages (room_id, sender_id, body, is_system_message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, room_id, sender_id, body, is_system_message, created_at`,
    [roomId, senderId, body, isSystemMessage]
  );
  // rows[0] is the inserted row with its DB-generated id and created_at.
  // The caller (socket handler) will attach sender_username from the socket
  // identity before broadcasting — no need for a second SELECT.
  return rows[0];
}
