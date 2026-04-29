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
