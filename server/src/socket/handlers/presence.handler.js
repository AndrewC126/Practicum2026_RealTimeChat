/**
 * Presence Handler — Online/Offline Tracking (US-401, US-402)
 *
 * Runs on every socket connection. Handles the 'disconnect' event
 * and emits presence snapshots and updates to the room.
 *
 * On connect (inside registerPresenceHandlers, executed for each new socket):
 *   1. Read user from socket.data.user (set by socketAuth)
 *   2. Insert a session record into the sessions table:
 *        INSERT INTO sessions (user_id, socket_id) VALUES ($1, $2)
 *   3. Update users.last_seen_at to NOW()
 *   4. Broadcast to all other sockets that this user is now online:
 *        socket.broadcast.emit('user_online', { userId, username })
 *        (socket.broadcast sends to everyone EXCEPT this socket)
 *   5. Emit a 'presence_snapshot' to THIS socket with current online users:
 *        socket.emit('presence_snapshot', [...onlineUsersList])
 *
 * On disconnect:
 *   socket.on('disconnect', async () => {
 *     1. Update the session record: SET is_online = false, disconnected_at = NOW()
 *     2. Check if the user has any other active sessions (they may be connected
 *        from multiple tabs). Only broadcast 'user_offline' if ALL sessions
 *        for this user are offline.
 *     3. io.emit('user_offline', { userId })
 *   });
 *
 * Implementation:
 *   export function registerPresenceHandlers(io, socket) {
 *     const { id: userId, username } = socket.data.user;
 *     // run the connect logic above (async IIFE or helper function)
 *     socket.on('disconnect', async () => { ... });
 *   }
 */

// connect/disconnect → update sessions table → broadcast presence (US-401, US-402)
export function registerPresenceHandlers(io, socket) {}
