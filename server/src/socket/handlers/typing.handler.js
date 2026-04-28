/**
 * Typing Handler — Typing Indicator Relay (US-303)
 *
 * The server acts as a relay for typing events: it receives start/stop from
 * one client and forwards them to the room (excluding the sender).
 *
 * Unlike chat messages, typing events are NOT stored in the database —
 * they are ephemeral (fire-and-forget).
 *
 * Events handled:
 *
 *   'typing_start'  payload: { roomId }
 *     socket.on('typing_start', ({ roomId }) => {
 *       socket.to(roomId).emit('typing_update', {
 *         username: socket.data.user.username,
 *         isTyping: true,
 *       });
 *     });
 *     socket.to(roomId) sends to everyone in the room EXCEPT this socket.
 *
 *   'typing_stop'  payload: { roomId }
 *     Same as above but isTyping: false.
 *
 * Rate limiting consideration:
 *   The client already debounces these events (only emits once every ~2 seconds),
 *   but you could add server-side rate limiting here if needed using a simple
 *   Map<socketId, lastEmitTime> check.
 *
 * Implementation:
 *   export function registerTypingHandlers(io, socket) {
 *     socket.on('typing_start', ({ roomId }) => {
 *       socket.to(roomId).emit('typing_update', {
 *         username: socket.data.user.username,
 *         isTyping: true,
 *       });
 *     });
 *     socket.on('typing_stop', ({ roomId }) => {
 *       socket.to(roomId).emit('typing_update', {
 *         username: socket.data.user.username,
 *         isTyping: false,
 *       });
 *     });
 *   }
 */

// typing_start / typing_stop events → broadcast to room (US-303)
export function registerTypingHandlers(io, socket) {}
