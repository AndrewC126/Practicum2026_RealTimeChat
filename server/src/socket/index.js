/**
 * Socket.io Initialization — Middleware + Handler Wiring (US-501)
 *
 * `initSocket(io)` is called ONCE in app.js after the Express routes are set
 * up. It does two things:
 *
 *   1. Attaches socketAuth as Socket.io middleware so every incoming connection
 *      is authenticated before any event handlers run.
 *
 *   2. Registers event handlers on each new socket inside io.on('connection').
 *      The `socket` object inside the callback represents ONE specific client's
 *      persistent connection. Multiple clients → multiple 'connection' events →
 *      multiple `socket` objects, each with their own handlers.
 *
 * ─── SOCKET.IO MIDDLEWARE vs EXPRESS MIDDLEWARE ───────────────────────────────
 * They look similar (both use (req/socket, next) pattern) but run differently:
 *
 *   Express middleware:
 *     Runs on every HTTP request before the route handler.
 *
 *   Socket.io middleware (io.use):
 *     Runs ONCE per connection during the WebSocket handshake.
 *     If it calls next(error), the connection is rejected entirely.
 *     If it calls next(), the connection proceeds and 'connection' fires.
 *
 * ─── HANDLER ORGANIZATION ────────────────────────────────────────────────────
 * Each feature's socket events live in their own handler file:
 *
 *   registerPresenceHandlers — 'connect', 'disconnect' (online/offline — US-401)
 *   registerChatHandlers     — 'join_room', 'leave_room', 'send_message',
 *                              'typing_start', 'typing_stop' (US-203/204/301/303)
 *
 * Splitting handlers by feature keeps each file focused and easy to test.
 * They all receive the same `io` and `socket` arguments so they can both listen
 * for events (socket.on) and broadcast to rooms (io.to(roomId).emit / socket.to).
 *
 * ─── SOCKET LIFECYCLE ────────────────────────────────────────────────────────
 * From the server's perspective:
 *
 *   1. Client calls io('/', { auth: { token } }) — starts HTTP handshake
 *   2. socketAuth middleware runs — verifies JWT, sets socket.data.user
 *   3. io.on('connection', socket => { ... }) fires — handlers are registered
 *   4. Client and server can now send events back and forth
 *   5. Client disconnects (tab closed, network drop) → 'disconnect' event fires
 *
 * ─── WHY NOT REGISTER HANDLERS IN app.js DIRECTLY? ──────────────────────────
 * Keeping socket wiring in this file means app.js stays focused on HTTP
 * concerns (REST routes, middleware, error handler). One file = one concern.
 * app.js calls initSocket(io) and delegates all socket setup to this file.
 */
import { socketAuth }               from './middleware/socketAuth.js';
import { registerPresenceHandlers } from './handlers/presence.handler.js';
import { registerChatHandlers }     from './handlers/chat.handler.js';

/**
 * Wire up Socket.io authentication and per-connection event handlers.
 *
 * @param {Server} io — the Socket.io Server instance from app.js
 */
export function initSocket(io) {
  // ── Step 1: Authentication middleware ──────────────────────────────────────
  // io.use() runs socketAuth for EVERY incoming connection attempt.
  // socketAuth verifies the JWT and either:
  //   - Sets socket.data.user and calls next() → connection allowed
  //   - Calls next(error) → connection refused, client sees connect_error
  //
  // This guard means NO event handler below ever runs for an unauthenticated client.
  io.use(socketAuth);

  // ── Step 2: Register per-socket handlers on each new connection ────────────
  // io.on('connection', cb) fires every time a NEW authenticated client connects.
  // The `socket` argument is a unique object for THAT client's connection.
  //
  // Why register handlers inside the callback?
  //   socket.on('join_room', handler) attaches the handler to THAT socket only.
  //   If we registered outside, all sockets would share one handler — impossible.
  io.on('connection', socket => {
    console.log(`[socket] connected — user: ${socket.data.user?.username}, id: ${socket.id}`);

    // ── US-602: Join a user-private Socket.io channel ───────────────────────
    // Socket.io supports "rooms" (named channels) as a way to broadcast to a
    // specific group of sockets. We use one room per user: 'user:<uuid>'.
    //
    // Why do we need this?
    //   When a message is sent to Room X, the server increments unread_count for
    //   all OTHER members and needs to push a 'badge_update' event to each of
    //   them. To reach a specific user, we emit to their personal channel:
    //
    //     io.to('user:<userId>').emit('badge_update', { roomId, unreadCount })
    //
    //   If the user has multiple tabs open (multiple sockets), ALL of them join
    //   'user:<userId>' here, so all tabs receive the badge update. This keeps
    //   the badge in sync across tabs automatically.
    //
    // Why not use socket.id directly?
    //   socket.id changes on every reconnect and is unknown to the server-side
    //   business logic (the chat handler only knows user IDs from the JWT).
    //   A stable 'user:<uuid>' channel is much easier to target.
    //
    // socket.join() is safe to call immediately after authentication because
    // socketAuth has already set socket.data.user before 'connection' fires.
    socket.join(`user:${socket.data.user.id}`);

    // registerPresenceHandlers: tracks online/offline state (US-401 — stub for now).
    // Calling a stub is a safe no-op; it will start doing work once implemented.
    registerPresenceHandlers(io, socket);

    // registerChatHandlers: wires up all chat-related events for this socket:
    //   'join_room'    → subscribe socket to room broadcasts, log membership
    //   'leave_room'   → unsubscribe, remove from DB, broadcast system message
    //   'send_message' → validate, save to DB, broadcast to room
    //   'typing_start' → relay to room (excluding sender)
    //   'typing_stop'  → relay to room (excluding sender)
    registerChatHandlers(io, socket);
  });
}
