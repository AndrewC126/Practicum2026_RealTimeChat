/**
 * Rooms Service — Business Logic for Room Management
 *
 * getRooms(userId):
 *   Returns all rooms the user can see:
 *   - All public rooms (is_private = false)
 *   - Private rooms where the user is a member
 *   Call roomsRepository.findAllPublic() and merge with the user's private rooms.
 *   Alternatively, write a single SQL query with a LEFT JOIN on room_members.
 *
 * createRoom(data):
 *   data: { name, description, isPrivate, ownerId }
 *   1. Validate name length (1–50 chars) — matches DB constraint
 *   2. Call roomsRepository.createRoom(data) to insert the room
 *   3. Call roomsRepository.addMember(room.id, ownerId) to add the owner
 *      as the first member automatically
 *   4. Return the created room object
 *
 * leaveRoom(roomId, userId):
 *   1. Call roomsRepository.removeMember(roomId, userId)
 *   2. Optional: if the leaving user was the owner and no members remain,
 *      delete the room. Or transfer ownership to the next member.
 *   3. Return void
 *
 * joinRoom(roomId, userId):
 *   Called from the socket handler when a user joins a room via Socket.io.
 *   1. Verify the room exists (findById)
 *   2. Verify it is not private (or the user already has access)
 *   3. Call roomsRepository.addMember(roomId, userId)
 *      addMember should be idempotent (INSERT ... ON CONFLICT DO NOTHING)
 *      so calling it twice doesn't error
 */
export async function getRooms() {}
export async function createRoom(data) {}
export async function joinRoom(roomId, userId) {}
export async function leaveRoom(roomId, userId) {}
