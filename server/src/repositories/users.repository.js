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
