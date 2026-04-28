/**
 * Rooms Repository — All SQL Touching rooms and room_members Tables
 *
 * findAllPublic():
 *   SELECT r.*, COUNT(rm.user_id) AS member_count, MAX(m.created_at) AS last_message_at
 *   FROM rooms r
 *   LEFT JOIN room_members rm ON rm.room_id = r.id
 *   LEFT JOIN messages m ON m.room_id = r.id
 *   WHERE r.is_private = false
 *   GROUP BY r.id
 *   ORDER BY last_message_at DESC NULLS LAST
 *   (Alternatively, query the room_summary view defined in schema.sql)
 *
 * findById(id):
 *   SELECT * FROM rooms WHERE id = $1
 *   Returns one room or null.
 *
 * createRoom(data):
 *   data: { name, description, isPrivate, ownerId }
 *   INSERT INTO rooms (owner_id, name, description, is_private)
 *   VALUES ($1, $2, $3, $4)
 *   RETURNING *
 *
 * addMember(roomId, userId):
 *   INSERT INTO room_members (room_id, user_id)
 *   VALUES ($1, $2)
 *   ON CONFLICT (room_id, user_id) DO NOTHING
 *   The ON CONFLICT clause makes this idempotent — joining a room the user
 *   is already in is a no-op, not an error.
 *
 * removeMember(roomId, userId):
 *   DELETE FROM room_members WHERE room_id = $1 AND user_id = $2
 *
 * getMembers(roomId):
 *   SELECT u.id, u.username
 *   FROM room_members rm
 *   JOIN users u ON u.id = rm.user_id
 *   WHERE rm.room_id = $1
 *   ORDER BY u.username
 *   Used by the presence panel to list who is in the room.
 */

// All SQL touching rooms and room_members tables
export async function findAllPublic() {}
export async function findById(id) {}
export async function createRoom(data) {}
export async function addMember(roomId, userId) {}
export async function removeMember(roomId, userId) {}
export async function getMembers(roomId) {}
