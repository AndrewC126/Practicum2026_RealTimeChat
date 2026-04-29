/**
 * useMessages — Paginated Message History Hook (US-501, US-502)
 *
 * Uses React Query's useInfiniteQuery to fetch and cache message history for
 * the active room, and uses the Socket.io connection to append live incoming
 * messages to that cache without re-fetching from the server.
 *
 * ─── WHY useInfiniteQuery INSTEAD OF useQuery ────────────────────────────────
 * useQuery is designed for a single page of data.
 * useInfiniteQuery is designed for paginated data where the user can request
 * more pages over time — perfect for "load older messages" (US-502).
 *
 * Instead of a single `data` object, useInfiniteQuery gives you:
 *   data.pages       — an array of arrays, one inner array per fetched page
 *   data.pageParams  — the offset values used to fetch each page
 *
 * ─── PAGINATION DIRECTION ───────────────────────────────────────────────────
 * The server returns the N most-recent messages for offset=0. Loading "older"
 * messages means fetching a higher offset (skipping the recent ones).
 *
 *   pages[0] = [msg51..msg100]  ← first fetch, offset=0, newest batch
 *   pages[1] = [msg1..msg50]    ← second fetch, offset=50, older batch
 *
 * React Query appends new pages to the END of `data.pages`. To display
 * messages in chronological order (oldest at top), we reverse the pages
 * array before flattening it into the `messages` array.
 *
 * ─── REAL-TIME UPDATES ───────────────────────────────────────────────────────
 * When a new message arrives via Socket.io, we do NOT refetch from the server.
 * Instead, we use queryClient.setQueryData() to directly insert the new message
 * into the last page of the React Query cache. This is faster (no network round
 * trip) and avoids the "flash" of re-fetching.
 *
 * ─── join_room ────────────────────────────────────────────────────────────────
 * Emitting 'join_room' subscribes this socket to the server's broadcast channel
 * for the room. Without this, the socket would never receive 'new_message'.
 * The REST fetch (queryFn) and the socket subscription are independent — both
 * are needed for the full US-501 experience.
 */
import { useEffect }                        from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket }                        from '../../../shared/hooks/useSocket';
import api                                  from '../../../services/api';

/**
 * useMessages — the single source of truth for one room's message list.
 *
 * Called by ChatPanel every render. When activeRoomId is null (no room
 * selected), the `enabled: !!roomId` guard ensures nothing runs.
 *
 * @param {string|null} roomId — UUID of the active room, or null
 * @returns {{ messages, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage }}
 */
export function useMessages(roomId) {
  // Get the Socket.io singleton — or null when not logged in.
  // Hooks that use socket guard every usage with `if (!socket || !roomId) return`.
  const socket = useSocket();

  // queryClient is the React Query cache manager.
  // We use it in the 'new_message' handler to write directly into the cache
  // instead of triggering a new network request.
  const queryClient = useQueryClient();

  // ── Fetch paginated message history ───────────────────────────────────────
  const {
    data,
    isLoading,          // true only during the FIRST fetch for this room
    isError,            // true if the initial fetch failed
    fetchNextPage,      // call this to load the next older batch (US-502)
    hasNextPage,        // true when more history exists above the oldest loaded message
    isFetchingNextPage, // true while the "load older" fetch is in flight (US-502)
  } = useInfiniteQuery({
    // ── queryKey ────────────────────────────────────────────────────────────
    // React Query uses this array as a cache key.
    // Including roomId means each room gets its own isolated cache entry.
    // Switching rooms changes the key → React Query fetches the new room
    // and keeps the old room's data in cache (with default gcTime of 5 min).
    queryKey: ['messages', roomId],

    // ── queryFn ─────────────────────────────────────────────────────────────
    // Called by React Query whenever it needs fresh data.
    //
    // { pageParam } is injected by React Query:
    //   - First call:    pageParam === initialPageParam (0 below) → offset=0
    //   - After fetchNextPage(): pageParam === whatever getNextPageParam returned
    //
    // The server endpoint:
    //   GET /api/rooms/:roomId/messages?offset=N&limit=50
    //   → Returns up to 50 messages, already sorted oldest-first (server reverses)
    queryFn: ({ pageParam }) =>
      api
        .get(`/rooms/${roomId}/messages?offset=${pageParam}&limit=50`)
        .then(r => r.data),

    // ── initialPageParam (required in React Query v5) ─────────────────────
    // The value of pageParam for the very first queryFn call.
    // offset=0 means "start from the most recent messages."
    initialPageParam: 0,

    // ── getNextPageParam ──────────────────────────────────────────────────
    // Called after every successful page fetch.
    // Tells React Query:
    //   • What offset to use for the NEXT older batch (return a number), OR
    //   • That there are no more pages (return undefined → hasNextPage=false)
    //
    // Logic:
    //   We requested 50 messages. If we got exactly 50, there MIGHT be older
    //   ones to load. The next batch starts where this one left off:
    //     allPages.length = how many batches we've fetched so far
    //     allPages.length * 50 = total messages fetched = offset for the next batch
    //
    //   If we got fewer than 50, we've hit the beginning of history — return
    //   undefined to set hasNextPage=false and hide the "Load older" button.
    //
    // Example with 120 total messages:
    //   Fetch 1: offset=0,  returns 50 msgs → next offset = 1*50 = 50
    //   Fetch 2: offset=50, returns 50 msgs → next offset = 2*50 = 100
    //   Fetch 3: offset=100, returns 20 msgs → 20 < 50 → undefined → done
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === 50 ? allPages.length * 50 : undefined,

    // ── enabled ────────────────────────────────────────────────────────────
    // Prevents any fetch when roomId is null (no room selected).
    // Without this guard, React Query would request:
    //   GET /api/rooms/null/messages  ← invalid URL
    enabled: !!roomId,
  });

  // ── Subscribe to room and listen for new messages ─────────────────────────
  //
  // This effect has two jobs:
  //   1. Emit 'join_room' so the server adds this socket to the room's
  //      broadcast channel (needed to receive 'new_message' events).
  //   2. Register a 'new_message' listener that appends incoming messages
  //      directly to the React Query cache (no REST refetch needed).
  //
  // The effect re-runs whenever socket or roomId changes:
  //   - Room switch: cleanup removes the old listener; new effect joins new room
  //   - Socket reconnect: cleanup removes the stale listener; new effect re-joins
  useEffect(() => {
    // Guard: do nothing until both the socket is ready and a room is selected.
    // This covers the initial render (no token yet) and the empty state (no room).
    if (!socket || !roomId) return;

    // ── Step 1: Subscribe this socket to the room's broadcast channel ─────
    // 'join_room' tells the server to call socket.join(roomId) for THIS socket.
    // After this, io.to(roomId).emit('new_message', msg) on the server will
    // reach us. Without this, we'd load history from REST but never see new msgs.
    //
    // The server handler (chat.handler.js) also:
    //   - Inserts a room_members row if this is the user's first time joining
    //   - Broadcasts a "has joined" system message to all room members (first join only)
    socket.emit('join_room', { roomId });

    // ── Step 2: Handle incoming real-time messages ─────────────────────────
    // This function is called every time the server emits 'new_message' to
    // this socket. We receive the full message object:
    //   { id, room_id, sender_id, sender_username, body, is_system_message, created_at }
    function handleNewMessage(message) {
      // Safety check: if the user switches rooms quickly, a 'new_message' event
      // for the OLD room might arrive before the cleanup function runs.
      // We ignore it here — the old room's cache is unaffected, and when the
      // user navigates back, React Query will refetch fresh data anyway.
      if (message.room_id !== roomId) return;

      // Directly update the React Query cache instead of refetching.
      //
      // queryClient.setQueryData(key, updater):
      //   - key     → identifies which query to update (['messages', roomId])
      //   - updater → receives the current cache value (old) and returns the new value
      //
      // The cache shape for useInfiniteQuery is:
      //   { pages: [ [msg, msg, ...], [msg, ...] ], pageParams: [0, 50, ...] }
      //
      // New messages always belong at the END of the LAST page, because the last
      // page holds the most recent messages and new ones are even more recent.
      queryClient.setQueryData(['messages', roomId], (old) => {
        // Edge case: socket message arrived before the REST fetch resolved.
        // Create a minimal valid cache structure to hold this first message.
        if (!old) {
          return { pages: [[message]], pageParams: [0] };
        }

        // Build a new last page with the incoming message appended.
        const lastPageIndex   = old.pages.length - 1;
        const updatedLastPage = [...old.pages[lastPageIndex], message];

        // Return a new cache object.
        // { ...old } preserves pageParams and any other React Query metadata.
        // We only replace the last page; all older pages stay exactly as they were.
        return {
          ...old,
          pages: [
            ...old.pages.slice(0, lastPageIndex), // all pages except the last (unchanged)
            updatedLastPage,                       // the last page with the new message appended
          ],
        };
      });
    }

    // Register the listener. Socket.io will call handleNewMessage every time
    // the server emits 'new_message' to this socket.
    socket.on('new_message', handleNewMessage);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    // React runs this cleanup function BEFORE the next effect execution and
    // when the component unmounts.
    //
    // When does the next execution happen?
    //   - User switches to a different room (roomId changes)
    //   - Socket reconnects (socket reference changes)
    //
    // Without cleanup: every room switch would ADD a new listener on top of
    // the existing one. After 3 room switches, 3 handlers would fire for each
    // message — causing duplicates and processing messages for wrong rooms.
    return () => {
      // socket.off(event, fn) removes ONLY this specific handler function.
      // Passing the named function reference is important: it means we don't
      // accidentally remove listeners registered by other hooks (like useTyping).
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, roomId, queryClient]);
  // Dependency array explanation:
  //   socket      — re-run if the socket disconnects and reconnects (new reference)
  //   roomId      — re-run when the user switches to a different room
  //   queryClient — stable reference (same object for the app's lifetime), but
  //                 ESLint's exhaustive-deps rule requires it to be listed

  // ── Flatten pages into a single array for rendering ───────────────────────
  //
  // useInfiniteQuery stores messages across multiple "pages" in data.pages.
  // MessageList expects a flat array of message objects.
  //
  // pages[0] = newest batch  (offset=0,  e.g. messages 51–100)
  // pages[1] = older batch   (offset=50, e.g. messages  1–50)
  //
  // If we simply did data.pages.flat() we'd get: [51..100, 1..50] — WRONG.
  // Older messages must come FIRST so they render at the TOP of the chat.
  //
  // Solution: reverse the pages array before flattening:
  //   [...data.pages].reverse() = [ [1..50], [51..100] ]
  //   .flat()                   = [1, 2, ..., 50, 51, ..., 100]  ← oldest first ✓
  //
  // We spread into a new array ([...data.pages]) before reversing because
  // Array.reverse() mutates the original array in place — we never want to
  // mutate React Query's internal cache.
  //
  // The `data ?` check handles the loading/error state where data is undefined.
  const messages = data ? [...data.pages].reverse().flat() : [];

  return {
    messages,           // flat array of message objects, oldest-first (for MessageList)
    isLoading,          // true on initial load — MessageList shows a spinner
    isError,            // true if the fetch failed — MessageList shows an error
    fetchNextPage,      // US-502: call this to load the next older batch
    hasNextPage,        // US-502: false when the beginning of history is reached
    isFetchingNextPage, // US-502: true while the older-batch fetch is in flight
  };
}
