/**
 * useInvite — Data hook for the InviteModal (US-206)
 *
 * Provides two capabilities:
 *
 *   useUserSearch(roomId, query)
 *     A React Query hook that fetches matching users for the invite search field.
 *     Results exclude users who are already room members (the server handles
 *     this exclusion via a NOT EXISTS clause in the SQL).
 *
 *   useInviteUser()
 *     Returns an `inviteUser(roomId, userId)` async function that emits the
 *     'invite_user' socket event and waits for the server's acknowledgment.
 *
 * ─── WHY TWO SEPARATE EXPORTS? ───────────────────────────────────────────────
 * useUserSearch is called with different arguments on every render (the query
 * string changes as the user types). useInviteUser has no arguments — it just
 * returns a stable function.
 *
 * Keeping them separate means the InviteModal can call useUserSearch with the
 * current debounced query and useInviteUser once for the invite action, without
 * tangling both concerns into a single hook call.
 *
 * ─── DEBOUNCE: WHY WE DON'T DO IT HERE ──────────────────────────────────────
 * Debouncing delays a value until it has stopped changing for N milliseconds.
 * We implement the debounce in the InviteModal component with a local useEffect,
 * and only pass the *already-debounced* query into useUserSearch here.
 *
 * Why in the component, not in the hook?
 *   The hook's job is: "given a query, fetch matching users." The *timing* of
 *   when to run that query is a UI concern that belongs to the component.
 *   Separating them makes each piece easier to understand and test individually.
 *
 * ─── STALE TIME ──────────────────────────────────────────────────────────────
 * staleTime: 15_000 (15 seconds) — search results can be slightly stale.
 * The invitee list changes only when someone joins the room, which is rare
 * during a search session. 15 seconds is a good balance between freshness and
 * avoiding redundant network requests as the user re-types the same query.
 *
 * ─── inviteUser FLOW ─────────────────────────────────────────────────────────
 * 1. Client emits 'invite_user' { roomId, userId } with an ack callback.
 * 2. Server (chat.handler.js):
 *    a. Verifies inviter is a member of the room
 *    b. Looks up the invitee's username from the DB (trust the server, not client)
 *    c. Calls addMember(roomId, userId) — idempotent INSERT
 *    d. Saves and broadcasts the system message to all current room members
 *    e. Emits 'room_added' to the invitee's private socket channel
 *    f. Calls ack({ ok: true })
 * 3. Client ack callback resolves the Promise → InviteModal shows "Invited ✓"
 */
import { useQuery }            from '@tanstack/react-query';
import { useQueryClient }      from '@tanstack/react-query';
import { useSocket }           from '../../../shared/hooks/useSocket';
import api                     from '../../../services/api';

/**
 * useUserSearch — Fetch users matching `query` who are not yet in the room.
 *
 * React Query is the right tool here: it handles caching, deduplication, and
 * loading/error state for us. The `enabled` flag ensures no request is made
 * while the search box is empty (which would return all users — a privacy risk).
 *
 * @param {string} roomId — UUID of the room (used to exclude existing members)
 * @param {string} query  — debounced search string (at least 1 char to enable)
 * @returns {{ users: Array<{id, username}>, isLoading: boolean, isError: boolean }}
 */
export function useUserSearch(roomId, query) {
  const {
    data: users = [],    // default to [] so callers never need a null check
    isLoading,
    isError,
  } = useQuery({
    // ── queryKey ────────────────────────────────────────────────────────────
    // Including both roomId and query means every unique combination gets its
    // own cache entry. Changing roomId OR query causes React Query to fetch fresh
    // data (different room = different member list; different query = different results).
    queryKey: ['invite-search', roomId, query],

    // ── queryFn ─────────────────────────────────────────────────────────────
    // GET /api/rooms/:id/invitees?q=<query>
    // encodeURIComponent handles special characters in usernames (spaces, etc.)
    // and is required by the URL spec — sending a raw "+" would confuse the server.
    queryFn: () =>
      api
        .get(`/rooms/${roomId}/invitees?q=${encodeURIComponent(query)}`)
        .then(r => r.data),

    // ── enabled ─────────────────────────────────────────────────────────────
    // Only fetch when:
    //   a) we have a valid room — without this, the URL would be /rooms/null/invitees
    //   b) the search box is non-empty — prevents "return ALL users" on mount
    // When disabled, useQuery immediately returns { data: undefined, isLoading: false }
    // which the default `users = []` covers.
    enabled: !!roomId && query.trim().length > 0,

    staleTime: 15_000, // 15 seconds — search results are fairly stable
  });

  return { users, isLoading, isError };
}

/**
 * useInviteUser — Returns an `inviteUser` function that wraps the socket invite flow.
 *
 * @returns {{ inviteUser: (roomId: string, userId: string) => Promise<void> }}
 */
export function useInviteUser() {
  const socket      = useSocket();
  const queryClient = useQueryClient();

  /**
   * inviteUser(roomId, userId)
   *
   * Emits the 'invite_user' socket event and waits for the server's ack.
   * Resolves when the server confirms the invite was processed successfully.
   * Rejects with an Error when the server returns ok: false or the socket
   * is not connected.
   *
   * On success, we invalidate the invite-search cache for this room so that
   * the newly added member no longer appears in future search results.
   *
   * We do NOT invalidate ['rooms'] here — that is the invited USER's concern.
   * The server emits 'room_added' to the invitee, and their useRoomInvites hook
   * invalidates their own ['rooms'] cache. The inviter's sidebar is unchanged
   * (they were already a member of the room).
   *
   * ─── SOCKET ACK PATTERN ──────────────────────────────────────────────────
   * socket.emit(event, payload, callbackFn) — the callback fires when the SERVER
   * calls ack(response). We wrap this in a Promise so the component can use
   * async/await instead of nested callbacks:
   *
   *   await inviteUser(roomId, userId)   ← waits for ack({ ok: true })
   *   // or throws if ack({ ok: false }) or socket is unavailable
   */
  function inviteUser(roomId, userId) {
    return new Promise((resolve, reject) => {
      if (!socket) {
        // Socket not ready — shouldn't happen while logged in, but guard anyway
        reject(new Error('Not connected. Please refresh and try again.'));
        return;
      }

      // Emit the event. The server handler verifies membership, writes to DB,
      // broadcasts the system message, notifies the invitee, then calls ack.
      socket.emit('invite_user', { roomId, userId }, (response) => {
        if (response?.ok) {
          // Invalidate the search cache for this room so the invited user is
          // excluded from future searches (they are now a member).
          // We pass just ['invite-search', roomId] — React Query invalidates ALL
          // cache entries whose key starts with this prefix (any query string).
          queryClient.invalidateQueries({ queryKey: ['invite-search', roomId] });
          resolve();
        } else {
          // Server returned an error — propagate it so the component can display it
          reject(new Error(response?.message ?? 'Could not invite user'));
        }
      });
    });
  }

  return { inviteUser };
}
