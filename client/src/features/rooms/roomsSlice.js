/**
 * Rooms Redux Slice — Active Room UI State
 *
 * ─── WHY THIS IS IN REDUX ────────────────────────────────────────────────────
 * Multiple unrelated components all need to react to which room is currently
 * active:
 *   • RoomItem   — highlight the selected room in the sidebar
 *   • ChatPanel  — fetch and display messages for the active room
 *   • MemberList — show the members of the active room
 *
 * If we stored activeRoomId in one component's local state (useState), we'd
 * have to "lift" it up through multiple levels of props — messy and fragile.
 * Putting it in Redux lets every component read it directly with useSelector.
 *
 * ─── WHAT DOES NOT GO HERE ───────────────────────────────────────────────────
 * The room LIST (names, descriptions, member counts) is server data. It belongs
 * in React Query's cache (see useRooms.js), not in Redux. Redux only holds the
 * one piece of UI state that can't be derived from the server: "which room is
 * the user looking at right now?"
 *
 * ─── HOW createSlice WORKS ───────────────────────────────────────────────────
 * Redux Toolkit's createSlice() generates three things at once from one config:
 *   1. The reducer function (handles state transitions)
 *   2. Action creator functions (e.g., setActiveRoom('abc-123'))
 *   3. Action type strings (e.g., 'rooms/setActiveRoom') — used internally
 *
 * You only export and use the action creators; Redux Toolkit handles the rest.
 */
import { createSlice } from '@reduxjs/toolkit';

const roomsSlice = createSlice({
  name: 'rooms',
  initialState: {
    activeRoomId: null, // null = no room selected (the default landing state)
  },
  reducers: {
    /**
     * setActiveRoom — change which room is currently active.
     *
     * Redux Toolkit uses Immer under the hood, so even though this looks like
     * a mutation (state.activeRoomId = ...), Immer intercepts it and produces
     * a new immutable state object. You never mutate state directly in plain Redux.
     */
    setActiveRoom(state, action) {
      state.activeRoomId = action.payload; // payload is a roomId string or null
    },
  },
});

export const { setActiveRoom } = roomsSlice.actions;

// Selector — a function that reads a slice of state.
// Components call: const activeRoomId = useSelector(selectActiveRoomId)
// instead of: useSelector(state => state.rooms.activeRoomId)
// This keeps the shape of the state in one place — if we rename the key
// we only update the selector, not every component that uses it.
export const selectActiveRoomId = state => state.rooms.activeRoomId;

export default roomsSlice.reducer;
