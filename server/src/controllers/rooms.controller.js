/**
 * Rooms Controller — HTTP Request Handlers for Room Management
 *
 * listRooms(req, res, next):
 *   - Read req.user.id (set by requireAuth)
 *   - Call roomsService.getRooms(userId) to get public rooms + user's private rooms
 *   - Respond with 200 and the rooms array
 *
 * createRoom(req, res, next):
 *   - Read { name, description, isPrivate } from req.body
 *   - Read req.user.id as the owner
 *   - Validate name is present and within length limits
 *   - Call roomsService.createRoom({ name, description, isPrivate, ownerId })
 *   - Respond with 201 and the created room object
 *
 * leaveRoom(req, res, next):
 *   - Read req.params.id as the roomId
 *   - Read req.user.id as the userId
 *   - Call roomsService.leaveRoom(roomId, userId)
 *   - Handle edge case: if the user is the room owner, should the room be
 *     deleted or transferred to another member? (design decision for you to make)
 *   - Respond with 204 No Content on success
 *
 * See auth.controller.js for notes on the try/catch async pattern.
 */
export async function listRooms(req, res, next) {}
export async function createRoom(req, res, next) {}
export async function leaveRoom(req, res, next) {}
