/**
 * Presence Redux Slice — Online User Map (US-401, US-402)
 *
 * Tracks which users are currently online. Updated exclusively by Socket.io
 * events — never by API calls. Presence is "pushed" by the server in real time.
 *
 * ─── WHY REDUX FOR PRESENCE? ──────────────────────────────────────────────────
 * Presence changes are:
 *   1. Pushed by the server at any time (user connects / disconnects)
 *   2. Needed by MULTIPLE unrelated components simultaneously:
 *        - MemberList (to split members into Online / Offline sections)
 *        - PresenceIndicator (to pick the dot color for a specific user)
 *
 * React Query is for data you FETCH from the server (rooms list, messages).
 * Redux is for UI state you RECEIVE from the server over a live connection
 * and need to share across the component tree. Presence fits Redux perfectly.
 *
 * ─── STATE SHAPE ──────────────────────────────────────────────────────────────
 * {
 *   onlineUsers: {
 *     "uuid-alice": { username: "alice", isOnline: true  },
 *     "uuid-bob":   { username: "bob",   isOnline: false },
 *   }
 * }
 *
 * Using a plain object (map) keyed by userId gives O(1) lookups:
 *   state.presence.onlineUsers[userId]?.isOnline   ← fast from any component
 *
 * ─── IMMER (BUILT INTO REDUX TOOLKIT) ────────────────────────────────────────
 * Redux's core rule is: reducers must NEVER mutate state directly.
 * Traditionally this required writing:
 *   return { ...state, onlineUsers: { ...state.onlineUsers, [id]: newValue } }
 *
 * Redux Toolkit uses the Immer library under the hood, which lets you write
 * the mutation you mean:
 *   state.onlineUsers[userId] = { username, isOnline: true }
 *
 * Immer intercepts the mutation and produces a new immutable state object.
 * The resulting behavior is identical — only the syntax is simpler.
 */
import { createSlice } from '@reduxjs/toolkit';

const presenceSlice = createSlice({
  name: 'presence',

  initialState: {
    // An object (map) rather than an array.
    // Why? Object key lookup (onlineUsers[id]) is O(1).
    // Array lookup (.find(u => u.id === id)) is O(n) — slower as users grow.
    onlineUsers: {},
  },

  reducers: {
    /**
     * setInitialPresence — replace the entire map with a fresh snapshot.
     *
     * Called by usePresence when the server emits 'presence_snapshot' — this
     * happens once right after the socket connects, giving the client an
     * immediate picture of everyone who is online.
     *
     * Payload: { users: [{ userId, username, isOnline }, ...] }
     *
     * We rebuild the map from scratch (rather than merging) because the snapshot
     * IS the authoritative current state from the server. Merging could leave
     * stale "online" entries for users who have since disconnected.
     */
    setInitialPresence(state, action) {
      // Reset to an empty object first
      state.onlineUsers = {};

      // Re-populate from the server's snapshot array.
      // action.payload.users is an array; forEach iterates over each element.
      action.payload.users.forEach(({ userId, username, isOnline }) => {
        // Each entry in the map: userId → { username, isOnline }
        state.onlineUsers[userId] = { username, isOnline };
      });
    },

    /**
     * setUserOnline — mark one user as online.
     *
     * Called when usePresence receives a 'user_online' socket event.
     * Payload: { userId, username }
     *
     * We use a conditional check first:
     *   If the entry already exists (user was previously offline and is coming
     *   back), update isOnline to true and refresh the username (in case they
     *   changed it, though that's rare).
     *
     *   If the entry doesn't exist yet (brand new user we haven't seen before),
     *   create it. This covers the case where a user registers and connects for
     *   the very first time after the presence snapshot was already sent.
     */
    setUserOnline(state, action) {
      const { userId, username } = action.payload;
      // Whether the entry exists or not, set it to online.
      // Immer allows this direct assignment — it creates a new immutable state.
      state.onlineUsers[userId] = { username, isOnline: true };
    },

    /**
     * setUserOffline — mark one user as offline.
     *
     * Called when usePresence receives a 'user_offline' socket event.
     * Payload: { userId }
     *
     * We keep the entry in the map (just flip isOnline to false) rather than
     * deleting it. Why? MemberList shows BOTH online and offline members:
     *   "Online — 2"  |  "Offline — 3"
     * If we deleted the entry, we'd lose the username and couldn't render the
     * offline section. The member list comes from the REST endpoint anyway;
     * this map is only used for the isOnline flag overlay.
     *
     * The optional-chaining check (if entry exists) prevents a crash if we
     * receive a 'user_offline' for a userId we've never seen in our map —
     * for example, a user who connected and disconnected before we joined.
     */
    setUserOffline(state, action) {
      const { userId } = action.payload;
      if (state.onlineUsers[userId]) {
        // Only flip the flag — preserve the username so the offline section renders
        state.onlineUsers[userId].isOnline = false;
      }
    },
  },
});

// ── Action creators ────────────────────────────────────────────────────────────
// createSlice auto-generates these from the reducer names.
// Import and dispatch them: dispatch(setUserOnline({ userId, username }))
export const { setInitialPresence, setUserOnline, setUserOffline } = presenceSlice.actions;

// ── Selector ──────────────────────────────────────────────────────────────────
// A "selector" is a function that reads a specific slice from the whole Redux state.
// Using a named selector (instead of inline state => state.presence.onlineUsers)
// means: if the state shape ever changes, we fix it here once instead of in
// every component that reads this value.
export const selectOnlineUsers = state => state.presence.onlineUsers;

// ── Reducer ───────────────────────────────────────────────────────────────────
// The default export is the reducer function, which store.js registers under
// the 'presence' key. Redux calls it on every dispatched action.
export default presenceSlice.reducer;
