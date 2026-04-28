/**
 * Presence Redux Slice — Online User Map (US-401, US-402)
 *
 * Tracks which users are currently online. Updated by Socket.io events, not
 * by API calls — presence is pushed by the server in real time.
 *
 * State shape:
 *   {
 *     onlineUsers: {
 *       [userId]: { username, isOnline }
 *     }
 *   }
 *   Using an object (map) instead of an array makes O(1) lookups:
 *     state.presence.onlineUsers[userId]?.isOnline  — fast anywhere in the UI
 *
 * Reducers to implement:
 *   setUserOnline(state, action)
 *     payload: { userId, username }
 *     Sets or updates onlineUsers[userId] = { username, isOnline: true }
 *
 *   setUserOffline(state, action)
 *     payload: { userId }
 *     Updates onlineUsers[userId].isOnline = false
 *     (Keep the entry so you can still show their name as "offline")
 *
 *   setInitialPresence(state, action)
 *     payload: { users: [{ userId, username, isOnline }, ...] }
 *     Replaces the entire map on initial connection (the server sends the
 *     full presence snapshot when the socket first connects).
 *
 * Implementation checklist:
 *   1. import { createSlice } from '@reduxjs/toolkit'
 *   2. initialState: { onlineUsers: {} }
 *   3. Implement the three reducers above
 *   4. Export action creators and reducer
 *   5. Export selector: export const selectOnlineUsers = state => state.presence.onlineUsers
 */

// Redux slice for ephemeral presence state (online user map)
