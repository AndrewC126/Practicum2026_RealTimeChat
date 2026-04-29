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
 * here means we get member_count and last_message_at automatically — no extra
 * JOIN code needed in this file.
 *
 * ─── WHY FILTER ROOMS BY MEMBERSHIP (US-204) ─────────────────────────────────
 * findAllForUser() returns only rooms where the requesting user is a member,
 * rather than every public room. This satisfies:
 *
 *   US-204 AC: "The room is removed from the user's sidebar list after leaving"
 *     When the user leaves (DELETE from room_members), the next call to
 *     findAllForUser() will no longer include that room.
 *
 * The JOIN on room_members filters to "rooms I belong to." If the user has no
 * memberships, the query returns an empty array — the sidebar shows "No rooms
 * yet — create one!" which is the US-201 empty-state AC.
 *
 * ─── LEFT JOIN vs INNER JOIN ─────────────────────────────────────────────────
 * The room_summary VIEW uses LEFT JOINs internally so rooms with zero members
 * or messages still appear in the view. Our findAllForUser query then applies
 * an INNER JOIN on room_members to filter to only the user's rooms — if there
 * is no matching room_members row the room is excluded.
 */
import { pool } from '../db/pool.js';

/**
 * Returns all public rooms the given user is currently a member of.
 * Ordered by most recent activity first so the most active rooms bubble up.
 */
export async function findAllForUser(userId) {
  // JOIN with room_members filters the result to rooms where this user has a
  // membership row. Once they leave (row deleted), the room disappears from
  // this query's results.
  const { rows } = await pool.query(
    `SELECT rs.id, rs.name, rs.description, rs.is_private, rs.owner_id,
            rs.created_at, rs.member_count, rs.last_message_at
     FROM   room_summary rs
     JOIN   room_members rm ON rm.room_id = rs.id
     WHERE  rs.is_private = false
       AND  rm.user_id = $1
     ORDER  BY rs.last_message_at DESC NULLS LAST, rs.created_at DESC`,
    [userId]
  );
  return rows;
}

export async function findByName(name) {
  // Case-insensitive check — prevents "General" and "general" being treated
  // as different rooms, which would confuse users.
  const { rows } = await pool.query(
    'SELECT id FROM rooms WHERE lower(name) = lower($1)',
    [name]
  );
  return rows[0] ?? null;
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

/**
 * Adds a user to a room. Returns true if a new row was inserted, false if the
 * user was already a member (the ON CONFLICT clause prevented a duplicate).
 *
 * ─── RETURNING id ────────────────────────────────────────────────────────────
 * Adding RETURNING id to this INSERT means:
 *   • If the row is inserted (new member): rows = [{ id: '...' }], length = 1
 *   • If ON CONFLICT DO NOTHING fires (already a member): rows = [], length = 0
 *
 * This gives us a way to distinguish "first ever join" from "re-opening the
 * room" without a separate SELECT. The chat handler uses this to decide whether
 * to broadcast a "has joined the room" system message.
 */
export async function addMember(roomId, userId) {
  const { rows } = await pool.query(
    `INSERT INTO room_members (room_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (room_id, user_id) DO NOTHING
     RETURNING id`,
    [roomId, userId]
  );
  // rows.length === 1 → new row inserted → this is a new member
  // rows.length === 0 → conflict was skipped → user was already a member
  return rows.length > 0;
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
