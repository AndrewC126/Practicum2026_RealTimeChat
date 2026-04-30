/**
 * Sessions Repository — All SQL Touching the sessions Table
 *
 * The sessions table tracks every Socket.io connection. Each row represents
 * one browser tab / device connection. A user can have multiple rows if they
 * have multiple tabs open simultaneously.
 *
 * ─── WHY TRACK SESSIONS IN THE DATABASE? ─────────────────────────────────────
 * Storing sessions in Postgres (rather than only in memory) gives us two things:
 *
 *   1. Multi-server support: if the app ever scales to multiple Node processes,
 *      each process shares the same Postgres database, so presence is consistent
 *      across all of them.
 *
 *   2. "Last seen" accuracy: even after a server restart, we know when each
 *      user was last online (via disconnected_at / users.last_seen_at).
 *
 * ─── SCHEMA REMINDER ─────────────────────────────────────────────────────────
 * sessions columns (from schema.sql):
 *   id              UUID    PK
 *   user_id         UUID    FK → users.id
 *   socket_id       TEXT    UNIQUE  (the Socket.io connection identifier)
 *   is_online       BOOLEAN DEFAULT TRUE
 *   connected_at    TIMESTAMPTZ
 *   disconnected_at TIMESTAMPTZ  (NULL while still connected)
 *
 * The database also has an active_sessions VIEW which returns the MOST RECENT
 * session row per user — useful for a quick "is this user online?" check.
 */
import { pool } from '../db/pool.js';

/**
 * createSession — record a new socket connection on connect.
 *
 * Called by registerPresenceHandlers at the start of every new connection.
 * If the same socket_id already exists (extremely unlikely but theoretically
 * possible on reconnect), the ON CONFLICT clause prevents a crash — we just
 * update the is_online flag to be safe.
 *
 * ─── ON CONFLICT ─────────────────────────────────────────────────────────────
 * ON CONFLICT (socket_id) DO UPDATE means: if a row with this socket_id
 * already exists, UPDATE it instead of throwing a duplicate-key error.
 * This makes the INSERT idempotent — safe to call even if the socket somehow
 * reconnects with the same ID.
 *
 * @param {string} userId   — UUID of the connecting user
 * @param {string} socketId — Socket.io's unique ID for this connection
 */
export async function createSession(userId, socketId) {
  await pool.query(
    `INSERT INTO sessions (user_id, socket_id, is_online)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (socket_id) DO UPDATE SET is_online = TRUE, disconnected_at = NULL`,
    [userId, socketId]
  );
}

/**
 * closeSession — mark a specific socket connection as offline on disconnect.
 *
 * Called by the 'disconnect' event handler with the socket's ID. We do NOT
 * delete the row — keeping it lets us track when the user was last online
 * (via disconnected_at) and compute the "last seen X minutes ago" display.
 *
 * ─── WHY socket_id (NOT user_id)? ────────────────────────────────────────────
 * A user can have MULTIPLE open sessions (multiple tabs). We only close the
 * specific socket that just disconnected — other sessions should stay online.
 * Using socket_id uniquely identifies this one connection.
 *
 * @param {string} socketId — the disconnecting socket's ID
 */
export async function closeSession(socketId) {
  await pool.query(
    `UPDATE sessions
     SET is_online = FALSE, disconnected_at = NOW()
     WHERE socket_id = $1`,
    [socketId]
  );
}

/**
 * hasActiveSessions — check if a user still has any other connected tabs.
 *
 * Called after closeSession to decide whether to broadcast 'user_offline'.
 * If the user has 3 tabs open and closes 1, we should NOT broadcast 'user_offline'
 * because they are still connected via the other 2 tabs. We only broadcast when
 * closing their LAST active session.
 *
 * ─── HOW IT WORKS ────────────────────────────────────────────────────────────
 * SELECT 1 … LIMIT 1 is the most efficient existence check in SQL:
 *   - Stops scanning as soon as it finds ONE matching row
 *   - Only returns 1 column (the constant 1) — no row data needed
 *   - rows.length > 0 → user still has an active session somewhere
 *
 * We exclude the socket that just disconnected ($2) because closeSession may
 * have already set it to FALSE or it might still be in the process of updating.
 * To avoid a race condition, we filter WHERE socket_id != $2 so we are asking:
 * "does ANY OTHER session for this user still have is_online = TRUE?"
 *
 * @param {string} userId   — UUID of the user who just disconnected
 * @param {string} socketId — the socket that just closed (excluded from search)
 * @returns {Promise<boolean>} — true if the user is still online via another session
 */
export async function hasActiveSessions(userId, socketId) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM   sessions
     WHERE  user_id   = $1
       AND  socket_id != $2
       AND  is_online  = TRUE
     LIMIT  1`,
    [userId, socketId]
  );
  return rows.length > 0;
}

/**
 * getOnlineUsers — fetch all users who currently have at least one active session.
 *
 * Used to build the 'presence_snapshot' event that the server sends to every
 * newly connected socket. The snapshot lets the client immediately show correct
 * online/offline status for every user without waiting for individual events.
 *
 * ─── DISTINCT ON (user_id) ───────────────────────────────────────────────────
 * A user might have multiple rows in the sessions table (one per tab). We only
 * want ONE entry per user. DISTINCT ON (user_id) keeps the first row per user
 * group — combined with ORDER BY user_id, connected_at DESC, this gives us
 * their MOST RECENT session (which is the one we care about).
 *
 * The JOIN on users gets us the username — sessions only stores user_id.
 *
 * ─── ALIAS NAMES ("userId", "isOnline") ─────────────────────────────────────
 * We alias the columns to camelCase so the JavaScript objects the driver returns
 * have camelCase keys (userId, isOnline) instead of snake_case (user_id, is_online).
 * This matches the naming convention used in the frontend.
 *
 * @returns {Promise<Array<{ userId: string, username: string, isOnline: boolean }>>}
 */
export async function getOnlineUsers() {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (s.user_id)
            s.user_id    AS "userId",
            u.username,
            s.is_online  AS "isOnline"
     FROM   sessions s
     JOIN   users u ON u.id = s.user_id
     WHERE  s.is_online = TRUE
     ORDER  BY s.user_id, s.connected_at DESC`
  );
  return rows;
}
