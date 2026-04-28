/**
 * Users Repository — All SQL Touching the users Table
 *
 * Repositories are the only layer that writes SQL. They receive plain data,
 * run a query, and return plain data. No business rules here.
 *
 * findByEmail(email):
 *   SELECT * FROM users WHERE email = $1
 *   Returns a user row or undefined/null.
 *   Used by loginUser and registerUser to check for duplicates.
 *
 * findById(id):
 *   SELECT id, username, email, created_at, last_seen_at
 *   FROM users WHERE id = $1
 *   Excludes password_hash — never return it unless needed for comparison.
 *
 * createUser(data):
 *   data: { username, email, passwordHash }
 *   INSERT INTO users (username, email, password_hash)
 *   VALUES ($1, $2, $3)
 *   RETURNING id, username, email, created_at
 *   RETURNING tells PostgreSQL to send back the new row, including the
 *   auto-generated UUID and timestamp — no need for a second SELECT.
 *
 * updateLastSeen(id):
 *   UPDATE users SET last_seen_at = NOW() WHERE id = $1
 *   Called by the presence handler on socket connect/disconnect.
 *
 * All queries use parameterized values (pool.query(sql, [params])) —
 * see db/pool.js for an explanation of why this prevents SQL injection.
 */

// All SQL touching the users table
export async function findByEmail(email) {}
export async function findById(id) {}
export async function createUser(data) {}
