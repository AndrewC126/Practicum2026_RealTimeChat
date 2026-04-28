/**
 * useSocket — Singleton Socket.io Client Hook
 *
 * Socket.io enables real-time, bidirectional communication between the browser
 * and the server. Unlike HTTP (request → response), a WebSocket connection
 * stays open so the server can push events to the client at any time.
 *
 * Why a singleton?
 *   We only want ONE socket connection per browser tab. If every component
 *   that needs real-time data created its own socket, we would have multiple
 *   parallel connections all receiving duplicate events. This module creates
 *   the socket once and reuses it.
 *
 * How Socket.io works:
 *   Client emits:  socket.emit('send_message', { roomId, body })
 *   Server hears:  socket.on('send_message', handler)
 *   Server emits:  io.to(roomId).emit('new_message', savedMessage)
 *   Client hears:  socket.on('new_message', handler)
 *
 * Authentication:
 *   Socket.io lets you pass data during the handshake (before any events):
 *     io(SERVER_URL, { auth: { token: jwtToken } })
 *   The server's socketAuth middleware reads this token and rejects the
 *   connection if it is invalid (see server/src/socket/middleware/socketAuth.js).
 *
 * Implementation checklist:
 *   1. import { io } from 'socket.io-client'
 *   2. Create the socket lazily (only after the user is logged in):
 *        let socket = null;
 *        export function getSocket(token) {
 *          if (!socket) socket = io('/', { auth: { token } });
 *          return socket;
 *        }
 *        export function disconnectSocket() {
 *          socket?.disconnect();
 *          socket = null;
 *        }
 *   3. Expose useSocket() as a React hook that reads the token from Redux
 *      (useSelector) and returns the socket instance, or null if not authed.
 *   4. Call disconnectSocket() in the logout action so the connection is
 *      cleaned up when the user signs out.
 */

// Singleton socket.io-client instance shared across features
export function useSocket() {}
