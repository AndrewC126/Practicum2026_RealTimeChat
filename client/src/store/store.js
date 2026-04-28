/**
 * Redux Toolkit Store
 *
 * Redux is a predictable state container. The "store" is the single object
 * that holds all shared UI state. Components read from it via `useSelector`
 * and write to it by dispatching "actions" via `useDispatch`.
 *
 * Why Redux Toolkit (RTK) instead of plain Redux?
 *   RTK is the official, modern way to use Redux. It removes most of the
 *   boilerplate (action type strings, switch statements, immutable spread
 *   patterns) and includes Immer so you can write mutations directly in
 *   reducers (RTK converts them to immutable updates under the hood).
 *
 * What goes in Redux? (ADR-004: ephemeral UI state only)
 *   - auth: { user, token }           — current logged-in user
 *   - chat: { typingUsers, unread }   — real-time typing/unread state
 *   - rooms: { activeRoomId }         — which room the user is looking at
 *   - presence: { onlineUsers }       — map of userId → online status
 *
 * What does NOT go in Redux?
 *   - Message history, room lists — these are server data and belong in
 *     React Query's cache (see useMessages, useRooms hooks).
 */
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';

// Redux Toolkit store — ephemeral UI state only (ADR-004)
export const store = configureStore({
  reducer: {
    auth: authReducer,
    // chat, rooms, presence reducers will be added as those features are built
  },
});
