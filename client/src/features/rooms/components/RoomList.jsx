/**
 * RoomList — Sidebar Room Navigation
 *
 * Displays all available rooms, highlights the active one, and provides
 * a button to open the CreateRoomModal.
 *
 * Data:
 *   const { rooms, isLoading } = useRooms();
 *   const activeRoomId = useSelector(state => state.rooms.activeRoomId);
 *
 * Interaction:
 *   Clicking a RoomItem dispatches setActiveRoom(room.id). The socket should
 *   also emit a 'join_room' event so the server adds the socket to that room's
 *   Socket.io room (required for receiving broadcast events):
 *     socket.emit('join_room', { roomId });
 *
 * Unread badges:
 *   Each room shows an unread count badge from Redux:
 *     const unreadCounts = useSelector(state => state.chat.unreadCounts);
 *     unreadCounts[room.id]  →  number to show on the badge
 *
 * Layout:
 *   <div className="room-list">
 *     <header>
 *       <h2>Rooms</h2>
 *       <button onClick={() => setShowModal(true)}>+ New Room</button>
 *     </header>
 *     {isLoading ? <Spinner /> : rooms.map(r => <RoomItem key={r.id} room={r} />)}
 *     {showModal && <CreateRoomModal onClose={() => setShowModal(false)} />}
 *   </div>
 *
 * Implementation checklist:
 *   - useRooms() for data
 *   - useSelector for activeRoomId and unreadCounts
 *   - useDispatch for setActiveRoom
 *   - useState for showModal
 *   - Render RoomItem for each room, passing isActive and unreadCount
 *   - Render CreateRoomModal when showModal is true
 */
export default function RoomList() {}
