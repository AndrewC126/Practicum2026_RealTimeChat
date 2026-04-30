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
 *
 * US-602: rm.unread_count is now included in every row so the client can
 * render a badge without a separate query. The value comes directly from
 * the room_members row for THIS user — each user has their own counter.
 */
export async function findAllForUser(userId) {
  // JOIN with room_members filters the result to rooms where this user has a
  // membership row. Once they leave (row deleted), the room disappears from
  // this query's results.
  //
  // rm.unread_count — the per-user unread counter for this room. It is
  // incremented by incrementUnread() when a message arrives and reset to 0
  // by resetUnread() when the user opens the room.
  const { rows } = await pool.query(
    `SELECT rs.id, rs.name, rs.description, rs.is_private, rs.owner_id,
            rs.created_at, rs.member_count, rs.last_message_at,
            rm.unread_count
     FROM   room_summary rs
     JOIN   room_members rm ON rm.room_id = rs.id
     WHERE  rs.is_private = false
       AND  rm.user_id = $1
     ORDER  BY rs.last_message_at DESC NULLS LAST, rs.created_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Increments unread_count by 1 for every member of the room EXCEPT the
 * user who sent the message.
 *
 * Called by chat.handler.js after a message is saved so that absent members
 * know there is new content they haven't seen.
 *
 * Returns an array of { user_id, unread_count } rows — one for every member
 * whose counter was incremented. The chat handler uses these to push a
 * badge_update socket event to each affected user's socket(s).
 *
 * ─── HOW THE SQL WORKS ────────────────────────────────────────────────────────
 * UPDATE ... SET unread_count = unread_count + 1
 *   Adds 1 to the current value. The schema enforces unread_count >= 0, so
 *   this can never go negative.
 *
 * WHERE room_id = $1 AND user_id != $2
 *   Targets all members of the room EXCEPT the sender. The sender can see
 *   their own message immediately — they don't need an unread badge.
 *
 * RETURNING user_id, unread_count
 *   Returns the updated rows so we know which users to notify and what their
 *   new count is. Without RETURNING we'd need a second SELECT.
 *
 * @param {string} roomId       — UUID of the room where the message was sent
 * @param {string} exceptUserId — UUID of the sender (excluded from increment)
 * @returns {Promise<Array<{ user_id: string, unread_count: number }>>}
 */
export async function incrementUnread(roomId, exceptUserId) {
  const { rows } = await pool.query(
    `UPDATE room_members
     SET    unread_count = unread_count + 1
     WHERE  room_id = $1
       AND  user_id != $2
     RETURNING user_id, unread_count`,
    [roomId, exceptUserId]
  );
  return rows;
}

/**
 * Resets unread_count to 0 for a specific user in a specific room.
 *
 * Called by chat.handler.js when the user emits 'join_room' (i.e., when
 * they open and start viewing the room). The user can now see all messages,
 * so there is nothing left unread.
 *
 * ─── WHY UPDATE INSTEAD OF SELECT + CONDITIONAL UPDATE ───────────────────────
 * A single UPDATE is atomic and does not require a separate round-trip to
 * check the current value first. If unread_count is already 0, Postgres
 * still runs the UPDATE but changes nothing — no harm done.
 *
 * @param {string} roomId — UUID of the room being opened
 * @param {string} userId — UUID of the user opening the room
 */
export async function resetUnread(roomId, userId) {
  await pool.query(
    `UPDATE room_members
     SET    unread_count = 0
     WHERE  room_id = $1
       AND  user_id = $2`,
    [roomId, userId]
  );
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

/**
 * Returns every public room in the application, along with a boolean
 * `is_member` indicating whether the requesting user has already joined it.
 *
 * Used by US-205 (Browse & join public rooms) to populate the browse modal.
 * Unlike findAllForUser(), this query is NOT filtered to "rooms the user joined"
 * — it shows ALL public rooms so users can discover ones they haven't joined yet.
 *
 * ─── HOW THE LEFT JOIN WORKS ──────────────────────────────────────────────────
 * A LEFT JOIN keeps every row from the LEFT table (room_summary) even when
 * there is NO matching row in the RIGHT table (room_members).
 *
 * The trick is placing the user-filter condition in the JOIN's ON clause rather
 * than in WHERE:
 *
 *   LEFT JOIN room_members rm
 *     ON  rm.room_id = rs.id    ← match the room
 *     AND rm.user_id = $1       ← only consider THIS user's membership row
 *
 * Result:
 *   • Room user has joined → rm.user_id IS NOT NULL → is_member = true
 *   • Room user has NOT joined → no matching rm row → rm.user_id IS NULL → is_member = false
 *
 * If we put `AND rm.user_id = $1` in a WHERE clause instead, any room where
 * the user is NOT a member would be filtered OUT — behaving like an INNER JOIN.
 *
 * ─── (rm.user_id IS NOT NULL) AS is_member ───────────────────────────────────
 * This is a SQL boolean expression:
 *   - When there IS a matching room_members row, rm.user_id has a value → true
 *   - When there is NO matching row (LEFT JOIN produced NULLs), rm.user_id IS NULL → false
 *
 * Postgres casts the boolean to a JS-compatible true/false in the result rows.
 *
 * @param {string} userId — UUID of the requesting user (used for the is_member flag)
 * @returns {Promise<Array<{ id, name, description, member_count, is_member, created_at }>>}
 */
export async function findAllPublic(userId) {
  const { rows } = await pool.query(
    `SELECT rs.id,
            rs.name,
            rs.description,
            rs.member_count,
            rs.created_at,
            -- Cast the LEFT JOIN result to a boolean:
            --   joined room  → rm.user_id has a value  → true
            --   not joined   → rm.user_id is NULL       → false
            (rm.user_id IS NOT NULL) AS is_member
     FROM   room_summary rs
     -- LEFT JOIN so we keep ALL public rooms regardless of membership.
     -- The AND clause in ON restricts the join to only this user's row —
     -- rooms with no match get NULL columns (is_member → false).
     LEFT JOIN room_members rm
       ON  rm.room_id = rs.id
       AND rm.user_id = $1
     WHERE  rs.is_private = false
     ORDER  BY rs.name ASC`,
    [userId]
  );
  return rows;
}
