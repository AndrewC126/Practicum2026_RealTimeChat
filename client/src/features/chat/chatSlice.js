/**
 * Chat Redux Slice — Ephemeral Chat UI State (US-303)
 *
 * Manages real-time state that is pushed by the server via Socket.io rather
 * than fetched on demand. This is state that:
 *   • Changes very frequently (every keystroke triggers a typing event)
 *   • Comes from the server unprompted (pushed, not pulled)
 *   • Does not need to be persisted across page refreshes
 *
 * ─── WHY REDUX AND NOT REACT QUERY? ─────────────────────────────────────────
 * React Query is designed for request/response patterns — you ask the server
 * for data and it responds. Socket.io events are the opposite: the server
 * pushes data to the client without being asked.
 *
 * Redux + a useEffect that listens to socket events is the standard pattern
 * for this use case:
 *   socket.on('typing_update', event => dispatch(setTyping(event)))
 *
 * ─── STATE SHAPE ─────────────────────────────────────────────────────────────
 *   {
 *     typingUsers: {
 *       "room-uuid-1": ["Alice", "Bob"],  // currently typing in room 1
 *       "room-uuid-2": ["Carol"],         // currently typing in room 2
 *     },
 *     unreadCounts: {
 *       "room-uuid-1": 3,   // 3 unread messages in room 1
 *       "room-uuid-2": 0,
 *     }
 *   }
 *
 * typingUsers is keyed by roomId so each room has its own typing list.
 * TypingIndicator reads typingUsers[roomId] for the active room.
 *
 * unreadCounts is keyed by roomId so the sidebar can show badges.
 * (Badge display is a future story; the reducer is here for completeness.)
 *
 * ─── IMMER (MUTABLE SYNTAX IN REDUCERS) ──────────────────────────────────────
 * Redux Toolkit uses Immer under the hood. Immer wraps the state in a "proxy"
 * that records your mutations and produces a new immutable object.
 *
 * This means inside a Redux Toolkit reducer you can write:
 *   state.typingUsers[roomId].push(username)  ← looks like a mutation
 *
 * Even though it LOOKS like we're modifying the state directly, Immer
 * intercepts the assignment and returns a new state object. You must NEVER
 * return a value AND mutate — do one or the other.
 *
 * ─── setTyping REDUCER ───────────────────────────────────────────────────────
 * payload: { roomId, username, isTyping }
 *
 *   isTyping = true  → add username to typingUsers[roomId] if not already there
 *   isTyping = false → remove username from typingUsers[roomId]
 *
 * Duplicate guard for the add case: if Alice is already in the list and a
 * second 'typing_start' arrives (e.g., she has two tabs open), we don't add
 * her twice — the indicator would show "Alice and Alice are typing…" without it.
 *
 * ─── incrementUnread / clearUnread ───────────────────────────────────────────
 * Unread badge support (used by the sidebar in a future story).
 *   incrementUnread: called when a 'new_message' arrives for a room the user
 *     is NOT currently viewing (tracked by the sidebar, not implemented here).
 *   clearUnread: called when the user opens a room — resets the badge to 0.
 */
import { createSlice } from '@reduxjs/toolkit';

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    typingUsers:  {},  // { [roomId]: string[] }
    unreadCounts: {},  // { [roomId]: number }
  },
  reducers: {
    /**
     * setTyping — add or remove a username from a room's typing list.
     *
     * Called by useTyping() whenever a 'typing_update' socket event arrives.
     * The server sends this event to all room members EXCEPT the typer, so
     * the current user's own username never appears here.
     */
    setTyping(state, action) {
      const { roomId, username, isTyping } = action.payload;

      // Initialize the array for this room if it doesn't exist yet.
      // Immer allows this direct assignment — it won't mutate the original state.
      if (!state.typingUsers[roomId]) {
        state.typingUsers[roomId] = [];
      }

      if (isTyping) {
        // Only add if not already present — guards against duplicate entries
        // when a user has multiple browser tabs open in the same room.
        if (!state.typingUsers[roomId].includes(username)) {
          state.typingUsers[roomId].push(username);
        }
      } else {
        // Filter out the username. .filter() returns a new array, which Immer
        // handles correctly — assigning back to state.typingUsers[roomId] is fine.
        state.typingUsers[roomId] = state.typingUsers[roomId].filter(
          u => u !== username
        );
      }
    },

    /**
     * incrementUnread — add 1 to the unread count for a room.
     * Intended to be called when a new message arrives in a room the user
     * isn't currently viewing.
     */
    incrementUnread(state, action) {
      const { roomId } = action.payload;
      // ?? 0 initializes the count to 0 if this room has no entry yet.
      state.unreadCounts[roomId] = (state.unreadCounts[roomId] ?? 0) + 1;
    },

    /**
     * clearUnread — reset the unread count to 0 for a room.
     * Call this when the user opens (or switches to) a room.
     */
    clearUnread(state, action) {
      const { roomId } = action.payload;
      state.unreadCounts[roomId] = 0;
    },
  },
});

export const { setTyping, incrementUnread, clearUnread } = chatSlice.actions;

// Selector helpers — components import these instead of
// writing `state => state.chat.typingUsers[roomId]` inline everywhere.
// Centralising selectors here means if we rename the state key we only
// update this file, not every consumer.
export const selectTypingUsers  = (roomId) => (state) =>
  state.chat.typingUsers[roomId]  ?? [];

export const selectUnreadCount  = (roomId) => (state) =>
  state.chat.unreadCounts[roomId] ?? 0;

export default chatSlice.reducer;
