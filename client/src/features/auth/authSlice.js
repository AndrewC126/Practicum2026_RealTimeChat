/**
 * Auth Redux Slice
 *
 * A "slice" in Redux Toolkit is a self-contained piece of state along with the
 * actions and reducer that manage it. `createSlice` generates all three from
 * one configuration object.
 *
 * State shape:
 *   {
 *     user:  { id, username, email } | null,   // null = not logged in
 *     token: string | null,                     // JWT returned by the server
 *   }
 *
 * The token is persisted to localStorage so it survives page refreshes.
 * On app start, main.jsx reads it back so the user stays logged in.
 */
import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    // Restore from localStorage on first load so refresh doesn't log the user out
    token: localStorage.getItem('token') ?? null,
  },
  reducers: {
    setCredentials(state, action) {
      state.user  = action.payload.user;
      state.token = action.payload.token;
      localStorage.setItem('token', action.payload.token);
    },
    logout(state) {
      state.user  = null;
      state.token = null;
      localStorage.removeItem('token');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;

export const selectCurrentUser = state => state.auth.user;
export const selectToken       = state => state.auth.token;

export default authSlice.reducer;
