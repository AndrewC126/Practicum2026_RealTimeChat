/**
 * useRooms — Room List Data Hook (US-201, US-202, US-204)
 *
 * Owns all data operations for the rooms list:
 *   1. Fetching the list of rooms the user belongs to   (useQuery)
 *   2. Creating a new room                              (useMutation)
 *   3. Leaving a room                                   (socket emit + ack)
 *
 * ─── WHY REACT QUERY FOR THIS ────────────────────────────────────────────────
 * The room list is "server state" — it lives in the database and changes when
 * other users create or delete rooms. React Query is designed exactly for this:
 *
 *   Without React Query (manual approach):
 *     const [rooms, setRooms]       = useState([]);
 *     const [isLoading, setLoading] = useState(true);
 *     const [error, setError]       = useState(null);
 *     useEffect(() => {
 *       api.get('/rooms').then(r => setRooms(r.data)).catch(setError).finally(...)
 *     }, []);
 *     // + you'd also have to manually handle re-fetching, caching, deduplication...
 *
 *   With React Query:
 *     const { data, isLoading, isError } = useQuery({ queryKey, queryFn })
 *     // React Query handles caching, background refetching, deduplication,
 *     // and stale-data management automatically.
 *
 * ─── QUERY KEY ───────────────────────────────────────────────────────────────
 * The queryKey is like a cache key. React Query uses it to:
 *   • Identify which cached data belongs to which query
 *   • Know when to refetch (if the key changes, it fetches fresh data)
 *
 * Using ['rooms'] means: "this is the cached list of the user's rooms". When
 * create-room's onSuccess calls queryClient.invalidateQueries(['rooms']),
 * React Query marks this cache entry stale and refetches it — that is how the
 * list updates without a page reload (US-201 AC).
 *
 * ─── staleTime ───────────────────────────────────────────────────────────────
 * React Query considers data "fresh" for staleTime milliseconds after it was
 * fetched. Fresh data is served from cache immediately with no network call.
 * After staleTime elapses, data is "stale" — it's still served from cache but
 * a background refetch begins.
 *
 * 30 seconds is a good starting point for a room list: it won't change every
 * second, but rooms the user joined (or left) in another tab will appear within
 * half a minute.
 *
 * ─── LEAVE ROOM VIA SOCKET ACKNOWLEDGMENT ────────────────────────────────────
 * Leaving is handled through the Socket.io layer rather than REST because:
 *   1. The socket must call socket.leave(roomId) on the server to unsubscribe
 *      this client from future broadcasts — only the socket layer can do that.
 *   2. The server needs to broadcast a system message ("Alex has left the room")
 *      to everyone still in the room — only the socket layer has access to io.
 *
 * Socket.io supports "acknowledgments" — a callback the server calls to signal
 * that an async operation completed:
 *
 *   Client:  socket.emit('leave_room', { roomId }, function callback(response) {
 *              // response = { ok: true } on success, { ok: false } on error
 *              // called AFTER the server has finished its async DB work
 *            })
 *
 *   Server:  socket.on('leave_room', async ({ roomId }, ack) => {
 *              await removeMember(roomId, userId); // DB update
 *              ack({ ok: true });                  // fires the client callback
 *            })
 *
 * Why wait for the ack before invalidating?
 *   If we called invalidateQueries() immediately, the REST refetch might run
 *   before the DB DELETE commits. The user would still see the room in the
 *   sidebar, even though they just left. Waiting for ack({ ok: true }) ensures
 *   the DB is updated before we ask for a fresh list.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDispatch }  from 'react-redux';
import api              from '../../../services/api';
import { useSocket }    from '../../../shared/hooks/useSocket';
import { setActiveRoom } from '../roomsSlice';

export function useRooms() {
  const socket      = useSocket();
  const queryClient = useQueryClient();
  const dispatch    = useDispatch();

  // ── Fetch rooms ────────────────────────────────────────────────────────────
  // GET /api/rooms now returns only rooms the user is a member of (US-204).
  // An empty array is returned if the user hasn't joined any rooms yet.
  const {
    data: rooms = [], // default to [] so callers don't need a null check
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['rooms'],
    queryFn:  () => api.get('/rooms').then(r => r.data),
    staleTime: 30_000, // 30 s — underscore separators are valid JS for readability
  });

  // ── Create room mutation ───────────────────────────────────────────────────
  // useMutation is for write operations (POST, PUT, DELETE).
  // mutateAsync returns a Promise, so callers can await it and handle errors.
  const { mutateAsync: createRoom } = useMutation({
    mutationFn: ({ name, description, isPrivate }) =>
      api.post('/rooms', { name, description, isPrivate }).then(r => r.data),

    onSuccess: () => {
      // Tell React Query the rooms cache is now stale.
      // This triggers a background refetch, so the new room appears in the
      // sidebar without a page reload — satisfying the US-201 "no refresh" AC.
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });

  // ── Leave room ─────────────────────────────────────────────────────────────
  // Returns a Promise so ChatPanel can await it and show errors if needed.
  //
  // Why not use useMutation here?
  //   useMutation wraps a promisified function. We could wrap the socket emit
  //   in a Promise and pass it to useMutation — both approaches work. We use
  //   a plain async function here to keep the socket acknowledgment pattern
  //   explicit and easy to follow without the extra useMutation abstraction.
  function leaveRoom(roomId) {
    return new Promise((resolve, reject) => {
      if (!socket) {
        // If the socket isn't connected (very unlikely while logged in), fall back
        // to a REST call so the user can still leave without the system message.
        api.delete(`/rooms/${roomId}/members`)
          .then(() => {
            dispatch(setActiveRoom(null));
            queryClient.invalidateQueries({ queryKey: ['rooms'] });
            resolve();
          })
          .catch(reject);
        return;
      }

      // Emit the 'leave_room' event with an acknowledgment callback.
      // The server's leave_room handler will:
      //   1. DELETE the room_members row
      //   2. Broadcast the system message to the room
      //   3. Call socket.leave(roomId) to unsubscribe from Socket.io broadcasts
      //   4. Call ack({ ok: true }) which triggers this callback
      socket.emit('leave_room', { roomId }, (response) => {
        if (response?.ok) {
          // Server confirmed the DB operation is done. Now it's safe to:
          //   a) Clear the active room (return to empty state — US-204 AC)
          //   b) Invalidate the cache so the sidebar refetches without this room
          dispatch(setActiveRoom(null));
          queryClient.invalidateQueries({ queryKey: ['rooms'] });
          resolve();
        } else {
          // The server returned an error. Propagate it so ChatPanel can display
          // an error message to the user instead of silently failing.
          reject(new Error(response?.message ?? 'Could not leave room'));
        }
      });
    });
  }

  return { rooms, isLoading, isError, createRoom, leaveRoom };
}

/**
 * useBrowseRooms — Data hook for the Browse Rooms modal (US-205)
 *
 * Provides:
 *   publicRooms    — all public rooms, each with an `is_member` boolean flag
 *   isLoading      — true while the first fetch is in flight
 *   isError        — true if the fetch failed
 *   joinPublicRoom — async function(roomId): joins a room, updates the sidebar,
 *                    and navigates the user into it
 *
 * ─── SEPARATE QUERY KEY ──────────────────────────────────────────────────────
 * The sidebar uses ['rooms'] (rooms the user HAS joined).
 * The browse modal uses ['rooms', 'public'] (ALL public rooms).
 * Keeping them separate means they can be independently cached and invalidated.
 *
 * When joinPublicRoom succeeds we invalidate BOTH:
 *   ['rooms']         → sidebar refetches and shows the newly joined room
 *   ['rooms','public'] → browse modal refetches so the room shows "Joined"
 *
 * ─── staleTime: 0 ────────────────────────────────────────────────────────────
 * Unlike the sidebar (staleTime: 30s), the browse list should always be fresh
 * when the modal opens so the user sees accurate member counts. staleTime: 0
 * means React Query will refetch every time the modal mounts.
 *
 * ─── joinPublicRoom FLOW ─────────────────────────────────────────────────────
 * When the user clicks "Join" on a room they haven't joined:
 *
 *   1. Emit 'join_room' with an ack callback via Socket.io.
 *      The server (chat.handler.js) will:
 *        a) call socket.join(roomId)   — subscribe this socket to broadcasts
 *        b) call addMember(roomId, userId) — idempotent DB insert
 *        c) broadcast the system message ("Alex has joined the room")
 *        d) call ack({ ok: true })     — signals the DB work is done
 *
 *   2. Wait for ack({ ok: true }) before touching local state.
 *      Waiting ensures the DB is updated before we refetch the rooms list —
 *      otherwise the new room might not appear in GET /api/rooms yet.
 *
 *   3. Invalidate ['rooms'] and ['rooms','public'] — React Query refetches both.
 *
 *   4. Dispatch setActiveRoom(roomId) — switches the chat panel to the new room.
 *
 *   5. The BrowseRoomsModal calls onClose() once this resolves.
 *
 * Why socket.emit instead of a REST POST /api/rooms/:id/members?
 *   The socket event does everything in one round trip: it subscribes the socket,
 *   persists the membership, AND broadcasts the system message. A REST call could
 *   only do the DB insert — we'd still need a separate socket event for the
 *   subscription and message. The socket approach is simpler and more consistent
 *   with how join_room already works elsewhere in the app.
 */
export function useBrowseRooms() {
  const socket      = useSocket();
  const queryClient = useQueryClient();
  const dispatch    = useDispatch();

  // ── Fetch all public rooms ─────────────────────────────────────────────────
  // Each room object looks like:
  //   { id, name, description, member_count, created_at, is_member: true|false }
  const {
    data: publicRooms = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['rooms', 'public'],
    queryFn:  () => api.get('/rooms/public').then(r => r.data),
    staleTime: 0, // always refetch when modal opens so member counts are current
  });

  // ── Join a public room ─────────────────────────────────────────────────────
  // Returns a Promise so BrowseRoomsModal can await it before closing.
  //
  // The function wraps the Socket.io acknowledgment pattern in a Promise
  // (the same technique used by leaveRoom above).
  function joinPublicRoom(roomId) {
    return new Promise((resolve, reject) => {
      if (!socket) {
        // Socket not ready — extremely unlikely while logged in, but handle it
        // gracefully so the user isn't left in a broken state.
        reject(new Error('Not connected — please refresh and try again'));
        return;
      }

      // Emit 'join_room' WITH an ack callback.
      // The server checks `if (typeof ack === 'function') ack({ ok: true })` —
      // the ack only fires when we provide this callback function.
      socket.emit('join_room', { roomId }, (response) => {
        if (response?.ok) {
          // DB is updated, socket is subscribed, system message is broadcast.
          // Now it's safe to sync local state:

          // Refresh the sidebar room list — the joined room should now appear.
          queryClient.invalidateQueries({ queryKey: ['rooms'] });

          // Refresh the public rooms list — the joined room should now show
          // is_member: true so the "Joined" label appears if the modal stays open.
          queryClient.invalidateQueries({ queryKey: ['rooms', 'public'] });

          // Navigate the user into the room — ChatPanel will mount and
          // useMessages will emit 'join_room' again (server's addMember is
          // idempotent — DO NOTHING on conflict — so no duplicate system message).
          dispatch(setActiveRoom(roomId));

          resolve();
        } else {
          reject(new Error(response?.message ?? 'Could not join room'));
        }
      });
    });
  }

  return { publicRooms, isLoading, isError, joinPublicRoom };
}
