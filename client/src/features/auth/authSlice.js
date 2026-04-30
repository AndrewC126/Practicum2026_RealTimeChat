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

/**
 * decodeToken — extract the payload from a JWT without verifying its signature.
 *
 * A JWT looks like:  HEADER.PAYLOAD.SIGNATURE
 * Each part is Base64URL-encoded. The PAYLOAD is a JSON object containing the
 * claims the server put in when it issued the token — in our case:
 *   { id, username, iat (issued-at timestamp), exp (expiry timestamp) }
 *
 * ─── WHY IS THIS SAFE ON THE CLIENT? ──────────────────────────────────────────
 * The server signs the token with JWT_SECRET. We are NOT verifying that signature
 * here — we are just reading the payload. That's fine because:
 *
 *   1. The payload is not secret. It only contains id and username, which the
 *      user already knows about themselves.
 *   2. Any time the client sends this token to the server (every API request and
 *      every socket connection), the server DOES verify the signature with its
 *      secret. A tampered token will be rejected there.
 *   3. We are only using the decoded payload to restore the Redux `user` object
 *      for display purposes (determining which messages are "own"). No
 *      authorization decision is made based on this client-side decode.
 *
 * ─── HOW BASE64 / ATOB WORKS ─────────────────────────────────────────────────
 * Base64URL uses '-' and '_' instead of '+' and '/' and omits '=' padding.
 * atob() expects standard Base64, so we must replace those characters first.
 *
 * @param {string} token — a JWT string
 * @returns {{ id: string, username: string } | null} — decoded payload, or null
 */
function decodeToken(token) {
  try {
    // Split on '.' to get [header, payload, signature], take the middle part
    const base64Payload = token.split('.')[1];

    // Base64URL → Base64: replace URL-safe chars with standard Base64 chars
    const base64 = base64Payload.replace(/-/g, '+').replace(/_/g, '/');

    // atob() decodes a Base64 string to a UTF-8 byte string.
    // JSON.parse turns the resulting JSON text into a plain JS object.
    return JSON.parse(atob(base64));
  } catch {
    // Token is malformed or localStorage held garbage — treat as "not logged in"
    return null;
  }
}

// Read the stored token ONCE at module load time.
// This runs when the JavaScript file is first imported (before React renders),
// which is exactly when we need it — to initialise the Redux store.
const storedToken   = localStorage.getItem('token') ?? null;

// Decode the payload to get { id, username } back without a network request.
// If the token is missing or malformed, decoded is null → user stays null.
const decoded       = storedToken ? decodeToken(storedToken) : null;
const restoredUser  = decoded ? { id: decoded.id, username: decoded.username } : null;

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    // Restore the user object from the token payload so that on a page refresh,
    // `state.auth.user` is not null. Without this, MessageList's `isOwn` check
    // (message.sender_id === currentUserId) would always be false after a reload,
    // making the user's own messages look identical to everyone else's.
    user:  restoredUser,
    // Restore the token from localStorage so RequireAuth keeps the user logged in
    token: storedToken,
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
