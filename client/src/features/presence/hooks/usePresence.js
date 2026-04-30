/**
 * usePresence — Presence Socket Event Subscriber (US-401, US-402)
 *
 * Listens to three Socket.io events emitted by presence.handler.js and keeps
 * the Redux presenceSlice in sync. Called once in Layout.jsx so the listener
 * is active for the entire authenticated session.
 *
 * ─── EVENTS HANDLED ───────────────────────────────────────────────────────────
 *
 *   'presence_snapshot'
 *     Emitted by the server ONCE, immediately after a socket connects.
 *     payload: [{ userId, username, isOnline }, ...]
 *     → Replaces the entire Redux onlineUsers map with the server's current truth.
 *     Why a full snapshot and not incremental updates?
 *       The client may have been offline for a while. Rather than try to
 *       reconcile stale local state, the server just sends the definitive
 *       "here is who is online right now" list. Clean and simple.
 *
 *   'user_online'
 *     Emitted when another user's socket connects (presence.handler broadcasts it).
 *     payload: { userId, username }
 *     → Adds/updates that user's entry: onlineUsers[userId] = { username, isOnline: true }
 *
 *   'user_offline'
 *     Emitted when a user's LAST active session disconnects.
 *     payload: { userId }
 *     → Flips onlineUsers[userId].isOnline to false (keeps entry for the offline section)
 *
 * ─── WHY LAYOUT.JSX? ──────────────────────────────────────────────────────────
 * Layout stays mounted for the ENTIRE authenticated session. That means these
 * listeners are always active — even when the user has no room open, or is on
 * a different page. If we put this in ChatPanel or MemberList, the listeners
 * would only exist when those components are rendered, and we'd miss events
 * that arrive while they are not on screen.
 *
 * ─── WHY NAMED HANDLER FUNCTIONS? ────────────────────────────────────────────
 * We define handleSnapshot, handleOnline, handleOffline as named functions
 * INSIDE the useEffect, then pass those exact references to both socket.on()
 * and socket.off(). This matters for cleanup:
 *
 *   socket.off('user_online', handleOnline)
 *
 * socket.off requires the SAME function reference that was passed to socket.on.
 * An inline arrow function would create a different object each time, making
 * socket.off unable to find and remove the right handler.
 *
 * ─── RETURNS ──────────────────────────────────────────────────────────────────
 * Nothing — this is a "side-effect only" hook. All its work is updating Redux.
 */
import { useEffect }  from 'react';
import { useDispatch } from 'react-redux';
import { useSocket }   from '../../../shared/hooks/useSocket';
import {
  setInitialPresence,
  setUserOnline,
  setUserOffline,
} from '../presenceSlice';

export function usePresence() {
  const socket   = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    // Guard: do nothing until the socket is ready.
    // This covers the brief moment between page load and successful authentication.
    if (!socket) return;

    // ── Handler: full presence snapshot on connect ─────────────────────────────
    // `users` is an array: [{ userId, username, isOnline }, ...]
    // We wrap it in { users } because setInitialPresence expects that shape
    // (matching the presenceSlice reducer's action.payload.users).
    function handleSnapshot(users) {
      dispatch(setInitialPresence({ users }));
    }

    // ── Handler: a user just came online ──────────────────────────────────────
    // The server only broadcasts this when a user's FIRST session connects
    // (i.e., they weren't already online via another tab).
    function handleOnline({ userId, username }) {
      dispatch(setUserOnline({ userId, username }));
    }

    // ── Handler: a user just went offline ─────────────────────────────────────
    // The server only broadcasts this when a user's LAST session disconnects.
    function handleOffline({ userId }) {
      dispatch(setUserOffline({ userId }));
    }

    // Register all three listeners on the socket.
    // Socket.io calls the corresponding function whenever the server emits the event.
    socket.on('presence_snapshot', handleSnapshot);
    socket.on('user_online',       handleOnline);
    socket.on('user_offline',      handleOffline);

    // ── Cleanup ────────────────────────────────────────────────────────────────
    // React runs this cleanup function:
    //   a) Before the next effect execution (when `socket` changes — e.g. reconnect)
    //   b) When the component unmounts (user logs out)
    //
    // Without cleanup, every reconnect would add ANOTHER set of listeners on top
    // of the existing ones — causing every event to fire multiple times and
    // dispatching duplicate Redux actions.
    return () => {
      socket.off('presence_snapshot', handleSnapshot);
      socket.off('user_online',       handleOnline);
      socket.off('user_offline',      handleOffline);
    };
  }, [socket, dispatch]);
  // Dependency array:
  //   socket  — re-register if the socket reference changes (reconnect)
  //   dispatch — stable (same function for the app's lifetime), listed for ESLint
}
