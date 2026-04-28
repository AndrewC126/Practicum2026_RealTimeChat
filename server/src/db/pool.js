/**
 * PostgreSQL Connection Pool
 *
 * Why a pool instead of one connection?
 *   A single database connection can only execute one query at a time. A pool
 *   maintains multiple connections (default: 10 in node-postgres) and lends
 *   one out per query, returning it when done. Under concurrent load, multiple
 *   requests can query the DB simultaneously.
 *
 * node-postgres (pg) Pool API:
 *   pool.query(sql, params)
 *     Checks out a connection, runs the query, returns it. Perfect for
 *     simple one-off queries in the repository files.
 *     Example:
 *       const { rows } = await pool.query(
 *         'SELECT * FROM users WHERE id = $1',
 *         [userId]
 *       );
 *
 *   pool.connect() → client
 *     Checks out a connection and holds it. Use this for transactions where
 *     multiple queries must run atomically:
 *       const client = await pool.connect();
 *       try {
 *         await client.query('BEGIN');
 *         await client.query('INSERT INTO ...');
 *         await client.query('UPDATE ...');
 *         await client.query('COMMIT');
 *       } catch (e) {
 *         await client.query('ROLLBACK');
 *         throw e;
 *       } finally {
 *         client.release(); // return connection to pool — ALWAYS do this
 *       }
 *
 * Parameterized queries ($1, $2, ...):
 *   NEVER concatenate user input into SQL strings — that creates SQL injection
 *   vulnerabilities. Always use parameters:
 *     pool.query('SELECT * FROM users WHERE email = $1', [email])
 *   node-postgres sends the values separately from the SQL so the database
 *   treats them as data, never as SQL code.
 *
 * Configuration:
 *   The Pool reads DATABASE_URL from the environment variable set in .env.
 *   Format: postgresql://user:password@host:port/dbname
 */
import pg from 'pg';
const { Pool } = pg;
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
