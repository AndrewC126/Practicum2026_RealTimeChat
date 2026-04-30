// All SQL touching the users table
import { pool } from '../db/pool.js';

export async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );
  return rows[0] ?? null;
}

export async function findByUsername(username) {
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );
  return rows[0] ?? null;
}

export async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, username, email, created_at, last_seen_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

export async function createUser({ username, email, passwordHash }) {
  // RETURNING sends back the generated id and created_at without a second SELECT
  const { rows } = await pool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email, created_at`,
    [username, email, passwordHash]
  );
  return rows[0];
}

/**
 * searchUsersNotInRoom — Invite-user search (US-206)
 *
 * Returns users whose username contains `query` (case-insensitive) and who are
 * NOT already members of `roomId`. Used by GET /api/rooms/:id/invitees to
 * populate the InviteModal search results.
 *
 * ─── ILIKE ────────────────────────────────────────────────────────────────────
 * ILIKE is PostgreSQL's case-insensitive version of LIKE.
 *   LIKE  'gen%'  → matches "general" but NOT "General" or "GENERAL"
 *   ILIKE 'gen%'  → matches all three
 *
 * The pattern '%' || $1 || '%' wraps the query with wildcards so it matches
 * the username anywhere (prefix, suffix, or middle):
 *   query = "li" → pattern = "%li%"
 *   "alice" ✓   "cliff" ✓   "li" ✓   "bob" ✗
 *
 * ─── NOT EXISTS ───────────────────────────────────────────────────────────────
 * NOT EXISTS (subquery) returns true when the subquery finds ZERO rows.
 * Here the subquery looks for a room_members row for this user + room pair:
 *   • If a row is found → user IS a member → NOT EXISTS = false → exclude user
 *   • If no row → user is NOT a member → NOT EXISTS = true  → include user
 *
 * This is more efficient than a LEFT JOIN + WHERE rm.user_id IS NULL approach
 * because Postgres can short-circuit as soon as it finds ONE matching row.
 *
 * ─── LIMIT ────────────────────────────────────────────────────────────────────
 * We cap results at `limit` (default 10). The invite modal shows a short list;
 * if there are more matches the user can type a more specific query to narrow
 * down. A small LIMIT keeps the response fast on large user tables.
 *
 * @param {string} query   — partial username to search for
 * @param {string} roomId  — UUID of the room (members of this room are excluded)
 * @param {number} limit   — maximum rows to return (default 10)
 * @returns {Promise<Array<{ id: string, username: string }>>}
 */
export async function searchUsersNotInRoom(query, roomId, limit = 10) {
  const { rows } = await pool.query(
    `SELECT u.id, u.username
     FROM   users u
     WHERE  u.username ILIKE '%' || $1 || '%'
       AND  NOT EXISTS (
              -- Exclude users who already have a room_members row for this room
              SELECT 1
              FROM   room_members rm
              WHERE  rm.room_id = $2
                AND  rm.user_id = u.id
            )
     ORDER  BY u.username
     LIMIT  $3`,
    [query, roomId, limit]
  );
  return rows;
}
