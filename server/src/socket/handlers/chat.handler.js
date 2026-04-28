/**
 * Chat Socket Handler — Message Send & Broadcast (US-301, US-302)
 *
 * Registered once per connection in socket/index.js. Handles the 'send_message'
 * event: persists the message to the database and broadcasts it to the room.
 *
 * Event flow for sending a message:
 *   1. Client emits:  socket.emit('send_message', { roomId, body })
 *   2. This handler receives the event
 *   3. Validate: body must be 1–1000 characters, roomId must exist
 *   4. Persist: call messagesService.saveMessage({ roomId, senderId, body })
 *   5. Broadcast: io.to(roomId).emit('new_message', savedMessage)
 *      io.to(roomId) sends to ALL sockets in that Socket.io room,
 *      including the sender (so their message appears immediately).
 *
 * Error handling for socket events:
 *   Unlike HTTP handlers there is no res.status(400). Instead, emit an error
 *   event back to the sender only:
 *     socket.emit('error', { message: 'Message body is required' });
 *
 * Implementation:
 *   export function registerChatHandlers(io, socket) {
 *     socket.on('send_message', async ({ roomId, body }) => {
 *       try {
 *         const { id: senderId, username } = socket.data.user;
 *         // validate, save, broadcast
 *       } catch (err) {
 *         socket.emit('error', { message: err.message });
 *       }
 *     });
 *   }
 */

// send_message event → persist to DB → broadcast to room (US-301, US-302)
export function registerChatHandlers(io, socket) {}
