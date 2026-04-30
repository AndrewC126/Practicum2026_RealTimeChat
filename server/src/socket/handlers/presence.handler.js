/**
 * Presence Handler — Online/Offline Tracking (US-401, US-402)
 *
 * Called once per new socket connection inside socket/index.js:
 *   registerPresenceHandlers(io, socket)
 *
 * This handler does two things:
 *
 *   ON CONNECT (runs immediately when registerPresenceHandlers is called):
 *     1. Write a row to the sessions table so we have a DB record of this connection.
 *     2. Update users.last_seen_at so the profile card shows a fresh timestamp.
 *     3. Broadcast 'user_online' to everyone ELSE so their UI marks this user green.
 *     4. Send a 'presence_snapshot' to THIS socket so it immediately knows who is
 *        currently online without waiting for future events.
 *
 *   ON DISCONNECT (socket.on('disconnect', ...)):
 *     1. Mark the session as offline in the DB (is_online = false).
 *     2. Update users.last_seen_at again (their "last seen" timestamp).
 *     3. Check whether the user still has OTHER active sockets (multiple tabs).
 *        If yes → do nothing (they are still online via another tab).
 *        If no  → broadcast 'user_offline' to everyone so their UI marks them gray.
 *
 * ─── SOCKET EVENTS EMITTED ────────────────────────────────────────────────────
 *
 *   'user_online'        → socket.broadcast.emit(...)
 *     Sent to ALL other sockets (every user who is connected).
 *     Payload: { userId, username }
 *     Why broadcast and not io.emit?
 *       socket.broadcast excludes the sender. The connecting user doesn't need to
 *       hear that they themselves just came online — they already know.
 *
 *   'presence_snapshot'  → socket.emit(...)
 *     Sent to THIS socket ONLY (the one that just connected).
 *     Payload: [{ userId, username, isOnline }, ...]
 *     This is the initial "here is everyone who is online right now" dump so the
 *     new client can populate the presence Redux state without waiting for events.
 *
 *   'user_offline'       → io.emit(...)
 *     Sent to ALL sockets including the one that disconnected.
 *     Wait — the disconnected socket can't receive events any more! That's true,
 *     but io.emit is simpler than building an exclusion list, and Socket.io silently
 *     drops any emission to a closed socket. It's a harmless no-op.
 *     Payload: { userId }
 *
 * ─── ASYNC IIFE PATTERN ───────────────────────────────────────────────────────
 * The connect logic (steps 1–4) is async (it hits the database).
 * registerPresenceHandlers itself is NOT async — socket/index.js calls it without
 * awaiting. So we wrap the async connect code in an immediately-invoked async
 * function expression (IIFE):
 *
 *   (async () => {
 *     await doAsyncThing();
 *     ...
 *   })();
 *
 * The IIFE starts running immediately and its result (a Promise) is discarded.
 * If it throws, we catch and log — we must not let an error in presence logic
 * crash the whole socket connection.
 */
import * as sessionsRepo from '../../repositories/sessions.repository.js';
import * as usersRepo    from '../../repositories/users.repository.js';

/**
 * registerPresenceHandlers — wire up presence events for one socket connection.
 *
 * @param {Server} io     — the Socket.io server (needed for io.emit to broadcast to ALL)
 * @param {Socket} socket — this specific client's socket (set by socketAuth)
 */
export function registerPresenceHandlers(io, socket) {
  // socket.data.user was set by socketAuth middleware during the handshake.
  // It contains { id, username, email, iat, exp } from the decoded JWT.
  const { id: userId, username } = socket.data.user;

  // ── Connect logic (async IIFE) ─────────────────────────────────────────────
  // We wrap in an IIFE because registerPresenceHandlers is synchronous.
  // Errors are caught and logged so a DB hiccup doesn't crash the connection.
  (async () => {
    try {
      // ── Step 1: Record this session in the database ─────────────────────────
      // Creates a row: (user_id, socket_id, is_online=true, connected_at=NOW()).
      // If the socket_id already exists (reconnect edge case), the ON CONFLICT
      // clause in createSession resets it to online — idempotent and safe.
      await sessionsRepo.createSession(userId, socket.id);

      // ── Step 2: Refresh the user's last_seen_at timestamp ──────────────────
      // "NOW() in the DB" is slightly more accurate than a JS Date sent across
      // the network, and it avoids clock-skew between Node and Postgres.
      await usersRepo.updateLastSeen(userId);

      // ── Step 3: Tell everyone else this user just came online ───────────────
      // socket.broadcast.emit sends to ALL connected sockets EXCEPT this one.
      // Every other client's usePresence hook will receive 'user_online' and
      // dispatch setUserOnline({ userId, username }) to their Redux store,
      // turning the user's dot green in their member list.
      socket.broadcast.emit('user_online', { userId, username });

      // ── Step 4: Send the current online user list to THIS socket ───────────
      // The newly connecting client has no presence state yet. Without this
      // snapshot they would only start tracking presence AFTER they connect —
      // missing everyone who came online before them.
      //
      // getOnlineUsers() returns rows for all users with is_online = TRUE.
      // We emit it directly to this socket (not broadcast) because only this
      // new client needs it; everyone else already has up-to-date presence.
      const onlineUsers = await sessionsRepo.getOnlineUsers();
      socket.emit('presence_snapshot', onlineUsers);

    } catch (err) {
      // Log but don't crash — a presence error should never kill the socket
      console.error('[presence] connect error:', err);
    }
  })();

  // ── Disconnect handler ─────────────────────────────────────────────────────
  // socket.on('disconnect') fires when this particular socket closes.
  // This happens when:
  //   - The user closes the browser tab
  //   - The user navigates away
  //   - The user loses internet connection
  //   - The server calls socket.disconnect()
  socket.on('disconnect', async () => {
    try {
      // ── Step 1: Mark this specific session as offline ───────────────────────
      // We mark is_online = FALSE and record disconnected_at = NOW().
      // We do NOT delete the row — keeping it allows "last seen" tracking.
      await sessionsRepo.closeSession(socket.id);

      // ── Step 2: Update last_seen_at again ──────────────────────────────────
      // This gives an accurate "last seen X minutes ago" timestamp for the
      // profile card the next time someone views this user.
      await usersRepo.updateLastSeen(userId);

      // ── Step 3: Check if the user is STILL online via another tab ──────────
      // A user with 3 open tabs has 3 session rows. Closing one tab sets
      // is_online = FALSE for that row, but the other two rows still have
      // is_online = TRUE. We should NOT broadcast 'user_offline' in that case —
      // the user is still present via the other tabs.
      //
      // hasActiveSessions checks: "does this user have ANY other is_online=TRUE
      // session besides the one we just closed?"
      const stillOnline = await sessionsRepo.hasActiveSessions(userId, socket.id);

      if (!stillOnline) {
        // ── Step 4: Broadcast that the user is now offline ──────────────────
        // io.emit sends to ALL currently-connected sockets (the disconnecting
        // socket can no longer receive, but io.emit handles that silently).
        //
        // Every other client's usePresence hook receives 'user_offline' and
        // dispatches setUserOffline({ userId }), turning the dot gray.
        io.emit('user_offline', { userId });
      }

    } catch (err) {
      console.error('[presence] disconnect error:', err);
    }
  });
}
