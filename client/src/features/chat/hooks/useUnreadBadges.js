/**
 * useUnreadBadges — Real-Time Unread Badge Sync (US-602)
 *
 * Listens for 'badge_update' socket events from the server and patches the
 * React Query rooms cache so each room's badge count stays live without
 * needing a full refetch of the rooms list.
 *
 * ─── WHY A SEPARATE HOOK? ─────────────────────────────────────────────────────
 * The unread badge is global — it must update for EVERY room the user belongs
 * to, not just the one they are currently viewing. useMessages is scoped to a
 * single active room. We need a hook that is always running, regardless of
 * which room (if any) is selected.
 *
 * This hook is called once in Layout.jsx, which stays mounted for the entire
 * authenticated session. That means the badge_update listener is always active.
 *
 * ─── THE badge_update EVENT ───────────────────────────────────────────────────
 * The server emits this event to a user's private Socket.io channel
 * ('user:<uuid>') when another member sends a message to one of their rooms:
 *
 *   Payload: { roomId: string, unreadCount: number }
 *
 * 'user:<uuid>' is joined in socket/index.js on every connect, so ALL of the
 * user's tabs receive the event (multi-tab badge sync for free).
 *
 * ─── SKIPPING THE ACTIVE ROOM ─────────────────────────────────────────────────
 * If the user is currently looking at Room A and a new message arrives in
 * Room A, the server still increments their unread_count in the DB (we don't
 * track "actively viewing" server-side to keep things simple). But we should
 * NOT show a badge for a room the user can already see.
 *
 * Solution: read activeRoomId from Redux and skip badge updates for that room.
 *
 * ─── STALE CLOSURE PROBLEM ────────────────────────────────────────────────────
 * The badge_update listener is registered once inside useEffect (when the
 * socket reference changes). If we referenced `activeRoomId` directly in the
 * listener, it would capture the value from the render where the effect ran
 * and NEVER see future updates — a classic stale closure bug.
 *
 * Fix: store activeRoomId in a ref. The listener reads `activeRoomIdRef.current`,
 * which always holds the latest value because a separate useEffect keeps the
 * ref in sync with the Redux state.
 *
 * Example of the bug without the ref:
 *   - User is in no room. Effect runs, listener closes over activeRoomId = null.
 *   - User opens Room A. activeRoomId changes to 'room-a' in Redux.
 *   - A message arrives in Room A. Listener still reads null → badge shows! Wrong.
 *
 * With the ref, the listener always reads the current room ID correctly.
 *
 * ─── CACHE UPDATE PATTERN ─────────────────────────────────────────────────────
 * queryClient.setQueryData(['rooms'], updater) is a synchronous cache write.
 * No network request is made. React Query immediately re-renders any component
 * that subscribes to ['rooms'] (i.e. RoomList → RoomItem).
 *
 * The updater function receives the current rooms array and returns a new one:
 *   old.map(room => room.id === roomId ? { ...room, unread_count } : room)
 *
 * Spreading { ...room, unread_count } creates a NEW room object with the
 * updated count. React uses referential equality to detect changes — mutating
 * the existing object (room.unread_count = x) would NOT trigger a re-render.
 */
import { useEffect, useRef }       from 'react';
import { useSelector }             from 'react-redux';
import { useQueryClient }          from '@tanstack/react-query';
import { useSocket }               from '../../../shared/hooks/useSocket';
import { selectActiveRoomId }      from '../../rooms/roomsSlice';

/**
 * useUnreadBadges — must be called once in a component that stays mounted for
 * the entire authenticated session (Layout.jsx). Returns nothing; all work
 * happens as side effects.
 */
export function useUnreadBadges() {
  const socket        = useSocket();
  const queryClient   = useQueryClient();

  // Read the currently active room from Redux.
  // We use this to SKIP badge updates for the room the user is looking at —
  // they can already see those messages, so the badge should stay at 0.
  const activeRoomId  = useSelector(selectActiveRoomId);

  // ── Stale-closure fix: keep the latest activeRoomId in a ref ──────────────
  //
  // useRef creates a mutable "box": { current: value }. Unlike state, updating
  // a ref does NOT cause a re-render. But unlike a plain variable, the ref
  // object itself is stable (same reference across all renders), so the
  // socket listener can safely read `.current` any time it fires.
  const activeRoomIdRef = useRef(activeRoomId);

  // Keep the ref in sync whenever Redux state changes.
  // This effect is intentionally lightweight — no cleanup needed.
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // ── Register the badge_update socket listener ──────────────────────────────
  //
  // Dependency array: [socket, queryClient]
  //   - socket:      changes if the socket disconnects and reconnects (new ref)
  //   - queryClient: stable for the app's lifetime, but ESLint requires listing it
  //   - activeRoomId is intentionally OMITTED — we use the ref instead to avoid
  //     re-registering the listener every time the user switches rooms.
  useEffect(() => {
    // Guard: do nothing until the socket is ready.
    // This covers the brief moment between mount and authentication.
    if (!socket) return;

    function handleBadgeUpdate({ roomId, unreadCount }) {
      // Skip the room the user is currently viewing.
      // activeRoomIdRef.current is always the latest value (see above).
      if (roomId === activeRoomIdRef.current) return;

      // Patch the rooms cache to update just this one room's unread_count.
      // queryClient.setQueryData is synchronous — RoomItem re-renders immediately.
      queryClient.setQueryData(['rooms'], (old) => {
        // If the rooms cache hasn't loaded yet, do nothing.
        // This is safe because once the cache loads it will include the correct
        // unread_count from the initial server response anyway.
        if (!old) return old;

        // Map over every room. Only the room matching roomId gets a new object.
        // All other rooms are returned as-is (same reference → no re-render for them).
        return old.map(room =>
          room.id === roomId
            ? { ...room, unread_count: unreadCount } // new object → triggers re-render
            : room                                    // same reference → no re-render
        );
      });
    }

    // Register the listener on the socket.
    // socket.on(event, fn) — Socket.io calls fn whenever the server emits 'badge_update'.
    socket.on('badge_update', handleBadgeUpdate);

    // Cleanup: remove this specific listener when the socket changes or the
    // component unmounts. Without cleanup, stale listeners would pile up and
    // fire multiple times per event.
    return () => {
      socket.off('badge_update', handleBadgeUpdate);
    };
  }, [socket, queryClient]);
  // Note: activeRoomId is intentionally NOT in the dependency array.
  // The ref pattern handles updates without needing to re-register the listener.
}
