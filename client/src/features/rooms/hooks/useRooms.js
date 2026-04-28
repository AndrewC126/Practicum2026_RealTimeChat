/**
 * useRooms — Room List Data Hook
 *
 * ─── WHY REACT QUERY FOR THIS ────────────────────────────────────────────────
 * The room list is "server state" — it lives in the database and changes when
 * other users create or delete rooms. React Query is designed exactly for this:
 *
 *   Without React Query (manual approach):
 *     const [rooms, setRooms]     = useState([]);
 *     const [isLoading, setLoading] = useState(true);
 *     const [error, setError]     = useState(null);
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
 * Using ['rooms'] means: "this is the cached list of all rooms". When US-202's
 * create-room mutation calls queryClient.invalidateQueries(['rooms']), React
 * Query marks this cache entry stale and refetches it — that is how the list
 * updates without a page refresh (US-201 AC).
 *
 * ─── staleTime ───────────────────────────────────────────────────────────────
 * React Query considers data "fresh" for staleTime milliseconds after it was
 * fetched. Fresh data is served from cache immediately with no network call.
 * After staleTime elapses, data is "stale" — it's still served from cache but
 * a background refetch begins.
 *
 * 30 seconds is a good starting point for a room list: it won't change every
 * second, but new rooms created by other users will appear within half a minute.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';

export function useRooms() {
  // useQueryClient() gives access to the shared React Query cache so we can
  // invalidate (mark stale + refetch) the rooms list after a mutation.
  const queryClient = useQueryClient();

  // ── Fetch rooms ────────────────────────────────────────────────────────────
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

  return { rooms, isLoading, isError, createRoom };
}
