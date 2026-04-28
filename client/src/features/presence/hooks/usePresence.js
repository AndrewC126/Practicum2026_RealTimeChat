/**
 * usePresence — Presence Socket Event Subscriber (US-401, US-402)
 *
 * Listens to Socket.io presence events from the server and keeps the Redux
 * presenceSlice in sync. This hook should be called once at a high level
 * (e.g., inside Layout) so it is active for the entire authenticated session.
 *
 * Events to subscribe to:
 *   'presence_snapshot'
 *     The server emits this once right after the socket connects.
 *     payload: [{ userId, username, isOnline }, ...]
 *     → dispatch(setInitialPresence({ users: payload }))
 *
 *   'user_online'
 *     payload: { userId, username }
 *     → dispatch(setUserOnline({ userId, username }))
 *
 *   'user_offline'
 *     payload: { userId }
 *     → dispatch(setUserOffline({ userId }))
 *
 * Cleanup:
 *   Always remove listeners in the useEffect cleanup function to avoid
 *   duplicate handlers if the component re-mounts:
 *     return () => {
 *       socket.off('presence_snapshot');
 *       socket.off('user_online');
 *       socket.off('user_offline');
 *     };
 *
 * Implementation checklist:
 *   - useSocket() to get the socket
 *   - useDispatch() for dispatching presence actions
 *   - One useEffect with all three socket.on() calls
 *   - Cleanup in the return function
 *   - This hook returns nothing (it's purely a side-effect hook)
 */

// Subscribes to presence socket events (US-401, US-402)
export function usePresence() {}
