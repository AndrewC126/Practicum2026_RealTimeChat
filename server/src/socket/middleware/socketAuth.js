/**
 * socketAuth — Socket.io Authentication Middleware (US-501)
 *
 * Socket.io middleware runs BEFORE the 'connection' event fires on the server.
 * It works similarly to Express middleware:
 *   - Receives (socket, next)
 *   - Calls next() to allow the connection
 *   - Calls next(new Error(...)) to reject it
 *
 * ─── WHY AUTHENTICATE SOCKETS? ───────────────────────────────────────────────
 * Without this middleware, ANYONE — including unauthenticated users — could open
 * a WebSocket connection and emit events like 'join_room' or 'send_message'.
 * This middleware ensures every connected socket belongs to a verified user.
 *
 * ─── WHERE THE TOKEN COMES FROM ──────────────────────────────────────────────
 * The client passes the JWT during the initial Socket.io handshake:
 *
 *   // Client (useSocket.js):
 *   io('/', { auth: { token: jwtToken } })
 *
 * Socket.io sends this `auth` object along with the connection request.
 * On the server, it's available on:
 *   socket.handshake.auth.token
 *
 * ─── WHY socket.data.user? ───────────────────────────────────────────────────
 * Once we verify the JWT, we decode its payload (which contains id, username,
 * email — whatever the auth controller signed into it). We attach that payload
 * to `socket.data.user` so every event handler can read it:
 *
 *   // In any handler (e.g., chat.handler.js):
 *   const { id: userId, username } = socket.data.user;
 *
 * `socket.data` persists for the entire lifetime of the connection.
 * Re-verifying the token on every single event would be wasteful — we do it
 * once here and then trust socket.data.user in all handlers.
 *
 * ─── JWT VERIFICATION ────────────────────────────────────────────────────────
 * jwt.verify(token, secret) does two things:
 *   1. Checks the signature — was this token signed by OUR server's secret?
 *      If someone tampered with the payload, the signature won't match.
 *   2. Checks `exp` (expiry) — has the token's expiry timestamp passed?
 *      If so, it throws even if the signature is valid.
 *
 * If either check fails, verify throws. We catch it and call next(error),
 * which tells Socket.io to refuse this connection.
 *
 * ─── ERROR FLOW ──────────────────────────────────────────────────────────────
 * When next(new Error('...')) is called, Socket.io:
 *   1. Does NOT emit the 'connection' event — no handler runs
 *   2. Sends an error back to the client
 *   3. The client's socket.on('connect_error', handler) fires with that error
 */
import jwt from 'jsonwebtoken';

/**
 * socketAuth — validates the JWT from the handshake before allowing connection.
 *
 * @param {Socket} socket — the incoming socket (not yet connected)
 * @param {Function} next — call next() to allow, next(err) to reject
 */
export function socketAuth(socket, next) {
  // The token was sent by the client in the `auth` option of io():
  //   io('/', { auth: { token: '...' } })
  // Socket.io makes it available at socket.handshake.auth.token.
  const token = socket.handshake.auth.token;

  // No token = unauthenticated client. Reject immediately.
  if (!token) {
    return next(new Error('No authentication token provided'));
  }

  try {
    // jwt.verify throws if the token is expired, malformed, or signed with a
    // different secret. On success it returns the decoded payload object.
    //
    // process.env.JWT_SECRET must match the secret used in auth.controller.js
    // when the token was originally signed with jwt.sign().
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the decoded payload to the socket so every event handler can
    // identify which user this socket belongs to — no re-verification needed.
    // Payload shape (from auth.controller.js): { id, username, email, iat, exp }
    socket.data.user = payload;

    // Call next() with no arguments = "this connection is allowed, proceed."
    next();
  } catch (err) {
    // jwt.verify threw — token is expired, tampered with, or invalid.
    // next(error) rejects the connection before the 'connection' event fires.
    next(new Error('Invalid or expired token'));
  }
}
