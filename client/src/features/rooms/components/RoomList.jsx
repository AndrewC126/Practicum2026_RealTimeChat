/**
 * RoomList — Sidebar Room Browser (US-201)
 *
 * ─── DATA FLOW ───────────────────────────────────────────────────────────────
 * This component sits at the intersection of two state systems:
 *
 *   React Query  →  room list (server state: fetched from GET /api/rooms)
 *   Redux        →  activeRoomId (UI state: which room is selected)
 *
 * It reads from both and renders a RoomItem for each room, passing isActive
 * down as a prop derived from the Redux state.
 *
 * ─── THREE RENDER STATES ────────────────────────────────────────────────────
 * React Query's useQuery always starts in one of these states:
 *   isLoading  — first fetch in progress (no cached data yet)
 *   isError    — fetch failed
 *   success    — data is available (rooms array, possibly empty)
 *
 * We handle all three so the user always sees meaningful UI.
 *
 * ─── DISPATCHING ACTIONS ─────────────────────────────────────────────────────
 * useDispatch() gives us the Redux store's dispatch function.
 * Calling dispatch(setActiveRoom(id)) runs the setActiveRoom reducer in
 * roomsSlice, updating state.rooms.activeRoomId.
 * Every component that calls useSelector(selectActiveRoomId) re-renders
 * automatically with the new value.
 */
import { useDispatch, useSelector } from 'react-redux';
import { useRooms } from '../hooks/useRooms';
import { setActiveRoom, selectActiveRoomId } from '../roomsSlice';
import RoomItem from './RoomItem';

export default function RoomList() {
  const { rooms, isLoading, isError } = useRooms();

  const dispatch      = useDispatch();
  const activeRoomId  = useSelector(selectActiveRoomId);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return <p style={styles.status}>Loading rooms…</p>;
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError) {
    return <p style={styles.status}>Could not load rooms.</p>;
  }

  // ── Empty state (US-201 AC: show a helpful message) ───────────────────────
  if (rooms.length === 0) {
    return <p style={styles.status}>No rooms yet — create one!</p>;
  }

  // ── Normal state ───────────────────────────────────────────────────────────
  return (
    <nav aria-label="Chat rooms">
      {rooms.map(room => (
        <RoomItem
          key={room.id}        // key tells React which DOM element maps to which item
          room={room}
          isActive={room.id === activeRoomId}
          onClick={() => dispatch(setActiveRoom(room.id))}
        />
      ))}
    </nav>
  );
}

const styles = {
  status: {
    margin: 0,
    padding: '0.75rem',
    fontSize: '0.8rem',
    color: '#8b929a',
    fontStyle: 'italic',
  },
};
