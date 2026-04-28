/**
 * Chat Redux Slice — Ephemeral Chat UI State
 *
 * This slice manages real-time state that changes frequently and does not
 * need to be persisted. It is updated by Socket.io events, not by API calls.
 *
 * State shape:
 *   {
 *     typingUsers: {
 *       [roomId]: [username, username, ...]   // who is currently typing per room
 *     },
 *     unreadCounts: {
 *       [roomId]: number                      // unread messages per room
 *     }
 *   }
 *
 * Why is this in Redux and not React Query?
 *   Typing indicators and unread counts are pushed by the server via Socket.io.
 *   React Query is designed for request/response (polling or mutations), not
 *   push events. Redux + a useEffect to listen to socket events is the right
 *   pattern for data that arrives unprompted from the server.
 *
 * Reducers to implement:
 *   setTyping(state, action)
 *     payload: { roomId, username, isTyping }
 *     If isTyping: add username to typingUsers[roomId] if not already there.
 *     If !isTyping: remove username from typingUsers[roomId].
 *
 *   incrementUnread(state, action)
 *     payload: { roomId }
 *     Increment unreadCounts[roomId] by 1.
 *     Skip if roomId === activeRoomId (user is looking at this room).
 *
 *   clearUnread(state, action)
 *     payload: { roomId }
 *     Set unreadCounts[roomId] = 0 when the user opens that room.
 *
 * Implementation checklist:
 *   1. import { createSlice } from '@reduxjs/toolkit'
 *   2. Define initialState with typingUsers: {} and unreadCounts: {}
 *   3. Implement the three reducers above
 *   4. Export action creators and reducer
 */

// Redux slice for ephemeral chat state (typing users, unread counts)
