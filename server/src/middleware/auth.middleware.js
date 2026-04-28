/**
 * requireAuth — Express JWT Authentication Middleware
 *
 * Protects HTTP routes by verifying the JWT sent in the Authorization header.
 * Attach this middleware to any route that requires a logged-in user:
 *   router.get('/rooms', requireAuth, listRooms)
 *
 * HTTP Authorization header format:
 *   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *
 * How JWT verification works:
 *   A JWT has three parts: header.payload.signature
 *   The server signed the token with JWT_SECRET when the user logged in.
 *   jwt.verify() checks that the signature is valid and the token hasn't expired.
 *   If valid, it returns the decoded payload (which contains user id and username).
 *
 * Implementation:
 *   export function requireAuth(req, res, next) {
 *     const authHeader = req.headers.authorization;
 *     if (!authHeader?.startsWith('Bearer ')) {
 *       return res.status(401).json({ error: 'No token provided' });
 *     }
 *     const token = authHeader.split(' ')[1];
 *     try {
 *       const payload = jwt.verify(token, process.env.JWT_SECRET);
 *       req.user = payload;   // attach to request so controllers can read it
 *       next();
 *     } catch (err) {
 *       return res.status(401).json({ error: 'Invalid or expired token' });
 *     }
 *   }
 *
 * After this middleware runs, route handlers can access req.user:
 *   async function listRooms(req, res, next) {
 *     const { id: userId } = req.user;
 *     ...
 *   }
 */

// Verifies Authorization: Bearer <token> on protected HTTP routes
export function requireAuth(req, res, next) {}
