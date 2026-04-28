/**
 * RoomItem — Single Room Row in the Sidebar
 *
 * A presentational component (it has no own data-fetching logic). Receives
 * everything it needs as props from RoomList.
 *
 * Props:
 *   room        — { id, name, description, member_count, last_message_at }
 *   isActive    — bool: true if this room matches activeRoomId in Redux
 *   unreadCount — number: unread message count for this room (0 = no badge)
 *   onClick     — function: called when the user clicks this room
 *
 * Visual design:
 *   - Apply an "active" CSS class when isActive to highlight the selected room
 *   - Show the unread count as a small badge (pill) if unreadCount > 0
 *   - Show a lock icon if room.is_private
 *   - Show member_count as secondary text
 *
 * Presentational vs. container components:
 *   RoomItem is "dumb" — it only renders what it is given. RoomList is the
 *   "smart" component that fetches data and passes it down. This separation
 *   makes RoomItem easy to test in isolation.
 *
 * Implementation checklist:
 *   - Accept the props listed above
 *   - Render a <li> or <button> that calls onClick when clicked
 *   - Conditional "active" class using isActive
 *   - Conditional badge using unreadCount
 *   - Conditional lock icon using room.is_private
 */
export default function RoomItem() {}
