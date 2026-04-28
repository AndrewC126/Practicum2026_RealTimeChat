/**
 * Rooms Repository — All SQL touching rooms and room_members tables
 *
 * ─── WHY USE THE room_summary VIEW ───────────────────────────────────────────
 * schema.sql defines a PostgreSQL VIEW called room_summary:
 *
 *   CREATE VIEW room_summary AS
 *     SELECT r.*, COUNT(rm.user_id) AS member_count, MAX(m.created_at) AS last_message_at
 *     FROM rooms r
 *     LEFT JOIN room_members rm ON rm.room_id = r.id
 *     LEFT JOIN messages     m  ON m.room_id  = r.id
 *     GROUP BY r.id;
 *
 * A VIEW is a saved query that you can SELECT from just like a table. Using it
 * here means:
 *   1. We get member_count and last_message_at "for free" — no extra JOIN code.
 *   2. If the view's definition ever changes (e.g., more columns added), this
 *      file automatically benefits without being rewritten.
 *
 * ─── LEFT JOIN vs INNER JOIN ─────────────────────────────────────────────────
 * The view uses LEFT JOINs, which means a room with zero members or zero
 * messages still appears in the result (with NULL for the aggregated columns).
 * An INNER JOIN would silently drop empty rooms — usually not what you want
 * when listing "all rooms".
 */
import { pool } from '../db/pool.js';

export async function findAllPublic() {
  // Query the view and filter to public rooms only.
  // ORDER BY: rooms with recent activity bubble up; rooms with no messages go last.
  const { rows } = await pool.query(`
    SELECT id, name, description, is_private, owner_id,
           created_at, member_count, last_message_at
    FROM   room_summary
    WHERE  is_private = false
    ORDER  BY last_message_at DESC NULLS LAST, created_at DESC
  `);
  return rows;
}

export async function findById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM rooms WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function createRoom({ name, description, isPrivate, ownerId }) {
  // RETURNING fetches the new row's auto-generated id and created_at so we
  // don't need a second SELECT after the INSERT.
  const { rows } = await pool.query(
    `INSERT INTO rooms (owner_id, name, description, is_private)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ownerId, name, description ?? null, isPrivate ?? false]
  );
  return rows[0];
}

export async function addMember(roomId, userId) {
  // ON CONFLICT DO NOTHING makes this idempotent — calling it twice (e.g., if
  // the user clicks "join" again) is a safe no-op instead of an error.
  await pool.query(
    `INSERT INTO room_members (room_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (room_id, user_id) DO NOTHING`,
    [roomId, userId]
  );
}

export async function removeMember(roomId, userId) {
  await pool.query(
    'DELETE FROM room_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
}

export async function getMembers(roomId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username
     FROM   room_members rm
     JOIN   users u ON u.id = rm.user_id
     WHERE  rm.room_id = $1
     ORDER  BY u.username`,
    [roomId]
  );
  return rows;
}
