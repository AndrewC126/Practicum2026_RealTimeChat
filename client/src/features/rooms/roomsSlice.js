/**
 * Rooms Redux Slice — Ephemeral Room UI State
 *
 * Tracks which room the user is currently viewing. The room LIST itself is
 * server data and lives in React Query's cache (see useRooms). Only the
 * "which room is active right now" piece belongs in Redux.
 *
 * State shape:
 *   {
 *     activeRoomId: string | null   // UUID of the room the user is looking at
 *   }
 *
 * Why this belongs in Redux and not local state:
 *   Multiple unrelated components need to react to the active room:
 *   - ChatPanel fetches messages for the active room
 *   - MemberList shows members of the active room
 *   - RoomItem highlights the currently active room in the sidebar
 *   Lifting this into Redux makes it accessible everywhere without prop drilling.
 *
 * Reducers to implement:
 *   setActiveRoom(state, action)
 *     payload: roomId (string) | null
 *     Sets state.activeRoomId = action.payload.
 *     Also dispatches clearUnread({ roomId }) from chatSlice so unread count
 *     resets when the user opens the room. (Dispatch that from the component,
 *     not from this reducer, to keep slices independent.)
 *
 * Implementation checklist:
 *   1. import { createSlice } from '@reduxjs/toolkit'
 *   2. initialState: { activeRoomId: null }
 *   3. setActiveRoom reducer
 *   4. Export action creators and reducer
 *   5. Export selector: export const selectActiveRoomId = state => state.rooms.activeRoomId
 */

// Redux slice for ephemeral rooms state (active room)
