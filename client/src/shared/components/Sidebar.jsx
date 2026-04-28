/**
 * Sidebar — Navigation Panel
 *
 * The sidebar is always visible and contains:
 *   1. RoomList — the list of rooms the user can join/view
 *   2. MemberList — online members of the currently active room
 *
 * The active room ID is stored in Redux (roomsSlice.activeRoomId).
 * When the user clicks a room in RoomList, dispatch setActiveRoom(id),
 * which causes ChatPanel to re-fetch and display that room's messages.
 *
 * Implementation checklist:
 *   - Import RoomList from features/rooms/components/RoomList
 *   - Import MemberList from features/presence/components/MemberList
 *   - Render both, separated visually (e.g., a divider between them)
 *   - Keep this component thin — it just composes the two sub-components
 */
export default function Sidebar() {}
