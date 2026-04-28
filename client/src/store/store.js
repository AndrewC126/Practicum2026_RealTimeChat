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
 *
 * Implementation checklist:
 *   1. Import `configureStore` from @reduxjs/toolkit
 *   2. Import the reducer from each slice file:
 *        import authReducer     from '../features/auth/authSlice'
 *        import chatReducer     from '../features/chat/chatSlice'
 *        import roomsReducer    from '../features/rooms/roomsSlice'
 *        import presenceReducer from '../features/presence/presenceSlice'
 *   3. Call configureStore({ reducer: { auth, chat, rooms, presence } })
 *   4. Export the store as the default export
 *   5. Export the RootState and AppDispatch types if using TypeScript
 */

// Redux Toolkit store — ephemeral UI state only (ADR-004)
