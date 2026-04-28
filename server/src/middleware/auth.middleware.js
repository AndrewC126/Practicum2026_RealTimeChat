/**
 * requireAuth — Express JWT Authentication Middleware
 *
 * ─── WHAT MIDDLEWARE IS ──────────────────────────────────────────────────────
 * In Express, "middleware" is any function with the signature (req, res, next).
 * Express runs middleware functions in order for every request. When your code
 * calls next(), Express moves on to the next middleware or route handler.
 * If you call next(error) it skips straight to the error handler.
 *
 * You attach middleware to specific routes:
 *   router.get('/rooms', requireAuth, listRooms)
 *   ↑ requireAuth runs first; if the token is valid it calls next() and
 *     listRooms runs; if not, requireAuth sends a 401 and never calls next().
 *
 * ─── WHAT A JWT IS ───────────────────────────────────────────────────────────
 * A JSON Web Token is a compact, URL-safe string in three Base64-encoded parts:
 *   HEADER.PAYLOAD.SIGNATURE
 *
 * The server created this token when the user logged in (auth.service.js) and
 * signed it with JWT_SECRET. To verify the token is genuine, we sign the
 * header+payload again with the same secret and compare — if the signatures
 * match, the payload hasn't been tampered with.
 *
 * The payload contains: { id, username, iat (issued at), exp (expiry) }
 * We attach it to req.user so route handlers can read the current user's id.
 *
 * ─── THE AUTHORIZATION HEADER ────────────────────────────────────────────────
 * HTTP has a standard header for sending credentials:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 * "Bearer" is the scheme name; the token follows after the space.
 * The Axios interceptor in api.js attaches this header to every request.
 */
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // The header must exist and start with "Bearer " (note the space)
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Split "Bearer <token>" and take the second part
  const token = authHeader.split(' ')[1];

  try {
    // jwt.verify() checks the signature AND the expiry date.
    // If either fails it throws, jumping to the catch block.
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded payload to the request object so any downstream
    // handler can read req.user.id or req.user.username without re-verifying.
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
