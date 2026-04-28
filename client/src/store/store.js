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
 * ─── WHAT GOES IN REDUX ──────────────────────────────────────────────────────
 * Only ephemeral UI state that multiple components share:
 *   auth   → { user, token }        — who is logged in
 *   rooms  → { activeRoomId }       — which room the user is viewing
 *
 * ─── WHAT DOES NOT GO IN REDUX ───────────────────────────────────────────────
 * Server data (room lists, message history) belongs in React Query's cache.
 * React Query handles fetching, caching, and re-fetching automatically —
 * replicating that in Redux would mean writing a lot of loading/error/data
 * state by hand.
 */
import { configureStore } from '@reduxjs/toolkit';
import authReducer  from '../features/auth/authSlice';
import roomsReducer from '../features/rooms/roomsSlice';

// Redux Toolkit store — ephemeral UI state only (ADR-004)
export const store = configureStore({
  reducer: {
    auth:  authReducer,
    rooms: roomsReducer,
    // chat and presence reducers will be added as those features are built
  },
});
