/**
 * useRoomInvites — Real-Time "Added to Room" Listener (US-206)
 *
 * Listens for the 'room_added' socket event that the server emits to a user's
 * private channel when they are invited into a room by another member.
 *
 * When the event arrives, this hook invalidates the ['rooms'] React Query cache
 * so the invited user's sidebar automatically refetches and shows the new room —
 * satisfying US-206 AC: "The room appears in the invited user's sidebar
 * immediately upon being invited, without requiring a page refresh."
 *
 * ─── WHERE IS THIS CALLED? ────────────────────────────────────────────────────
 * Layout.jsx — right alongside useUnreadBadges().
 *
 * Layout stays mounted for the ENTIRE authenticated session, which means this
 * listener is always active. If this hook were called inside ChatPanel instead,
 * the listener would only exist when the user has a room open. A user who is
 * sitting at the "Select a room" empty state would never see their sidebar update
 * when they get invited.
 *
 * By putting it in Layout (which is always rendered for logged-in users), the
 * listener is guaranteed to be active regardless of what the user is doing.
 *
 * ─── HOW THE INVITE FLOW ENDS HERE ──────────────────────────────────────────
 *
 *   (Inviter clicks "Invite" in InviteModal)
 *        ↓
 *   socket.emit('invite_user', { roomId, userId })
 *        ↓ server-side in chat.handler.js:
 *   io.to('user:<inviteeId>').emit('room_added', { roomId })
 *        ↓
 *   This hook receives 'room_added'
 *        ↓
 *   queryClient.invalidateQueries(['rooms'])
 *        ↓
 *   React Query refetches GET /api/rooms
 *        ↓
 *   RoomList re-renders with the new room in the sidebar ✓
 *
 * ─── 'user:<uuid>' CHANNEL ────────────────────────────────────────────────────
 * The server emits 'room_added' to 'user:<inviteeId>' — a per-user private
 * Socket.io channel. Every socket that connects for this user joins this channel
 * (see socket/index.js: socket.join(`user:${socket.data.user.id}`)).
 *
 * This means:
 *   • If the user has ONE tab open → that socket receives the event
 *   • If the user has THREE tabs open → all THREE sockets receive it
 *     → all three sidebars update simultaneously (multi-tab sync for free!)
 *
 * ─── WHY NOT INVALIDATE ['rooms','public'] TOO? ──────────────────────────────
 * The invited user's public rooms browse list ('rooms','public') would also show
 * this room as `is_member: true` after the invite. But since the BrowseRoomsModal
 * refetches with staleTime: 0 every time it opens, it will always be accurate
 * when the user opens it. There is no need to proactively invalidate it here.
 *
 * ─── STALE CLOSURE ────────────────────────────────────────────────────────────
 * Unlike useUnreadBadges, this listener does NOT need the activeRoomId to decide
 * whether to skip an update — we ALWAYS want to add the new room to the sidebar.
 * So we do NOT need the ref pattern that useUnreadBadges uses. The dependency
 * array [socket, queryClient] is sufficient.
 */
import { useEffect }       from 'react';
import { useQueryClient }  from '@tanstack/react-query';
import { useSocket }       from './useSocket';

/**
 * useRoomInvites — call once in Layout.jsx.
 * Returns nothing; all work happens as side effects.
 */
export function useRoomInvites() {
  const socket      = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Guard: do nothing until the socket connection is established.
    // This covers the brief moment between page load and authentication.
    if (!socket) return;

    /**
     * handleRoomAdded — called when the server emits 'room_added' to this
     * user's private channel ('user:<uuid>').
     *
     * Payload: { roomId: string }
     *   roomId — the UUID of the room the current user was just added to
     *
     * We ignore the roomId here (we don't need to do anything specific with
     * the individual room) — we just invalidate the whole rooms list so React
     * Query refetches GET /api/rooms. The refetch will include the new room
     * because addMember() has already committed to the database by the time
     * the server emits this event.
     */
    function handleRoomAdded() {
      // invalidateQueries marks ['rooms'] as stale and immediately triggers
      // a background refetch. The sidebar (RoomList) will re-render with the
      // new room as soon as the response arrives — typically < 100ms on a
      // local network.
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    }

    // Register the listener on the socket singleton.
    // Socket.io calls handleRoomAdded every time the server emits 'room_added'
    // to this socket (which happens when this user is invited to a room).
    socket.on('room_added', handleRoomAdded);

    // Cleanup: remove the listener when the socket changes (e.g. reconnect)
    // or when Layout unmounts (login → logout flow).
    // Without cleanup, stale listeners would stack up and fire multiple times.
    return () => {
      socket.off('room_added', handleRoomAdded);
    };
  }, [socket, queryClient]);
  // Dependency array:
  //   socket      — re-run if the socket disconnects and reconnects (new reference)
  //   queryClient — stable for the app's lifetime, but listed to satisfy ESLint
}
