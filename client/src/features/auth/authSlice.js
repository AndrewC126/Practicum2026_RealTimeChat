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
 * Why store the token in Redux?
 *   The Axios interceptor in services/api.js reads the token from the Redux
 *   store to attach it to every HTTP request. This avoids having to pass the
 *   token around manually.
 *
 * Persisting the token across page reloads:
 *   Redux state is in memory and is lost on refresh. The common pattern is:
 *     - On setCredentials: save token to localStorage
 *     - On app start (main.jsx): read token from localStorage and pre-populate
 *       the store by dispatching setCredentials if a token exists
 *     - On logout: clear localStorage
 *
 * Implementation checklist:
 *   1. import { createSlice } from '@reduxjs/toolkit'
 *   2. Define the initialState (read from localStorage if available)
 *   3. Create the slice with two reducers:
 *        setCredentials(state, action) {
 *          state.user  = action.payload.user;
 *          state.token = action.payload.token;
 *          localStorage.setItem('token', action.payload.token);
 *        }
 *        logout(state) {
 *          state.user  = null;
 *          state.token = null;
 *          localStorage.removeItem('token');
 *        }
 *   4. Export the action creators: export const { setCredentials, logout } = authSlice.actions
 *   5. Export the reducer as the default export: export default authSlice.reducer
 *   6. Export a selector for convenience:
 *        export const selectCurrentUser = state => state.auth.user
 */

// Redux slice for auth state (current user, token)
