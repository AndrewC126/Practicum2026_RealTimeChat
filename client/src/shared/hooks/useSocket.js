/**
 * useSocket — Singleton Socket.io Client Hook
 *
 * Socket.io enables real-time, bidirectional communication between the browser
 * and the server. Unlike HTTP (request → response), a WebSocket connection
 * stays open so the server can push events to the client at any time.
 *
 * Why a singleton?
 *   We only want ONE socket connection per browser tab. If every component
 *   that needs real-time data created its own socket, we would have multiple
 *   parallel connections all receiving duplicate events. This module creates
 *   the socket once and reuses it.
 *
 * How Socket.io works:
 *   Client emits:  socket.emit('send_message', { roomId, body })
 *   Server hears:  socket.on('send_message', handler)
 *   Server emits:  io.to(roomId).emit('new_message', savedMessage)
 *   Client hears:  socket.on('new_message', handler)
 *
 * Authentication:
 *   Socket.io lets you pass data during the handshake (before any events):
 *     io(SERVER_URL, { auth: { token: jwtToken } })
 *   The server's socketAuth middleware reads this token and rejects the
 *   connection if it is invalid (see server/src/socket/middleware/socketAuth.js).
 */
import { io }          from 'socket.io-client';
import { useEffect }   from 'react';
import { useSelector } from 'react-redux';
import { store }       from '../../store/store';
import { selectToken, logout } from '../../features/auth/authSlice';

// ── Module-level singleton ─────────────────────────────────────────────────────
// This variable lives OUTSIDE of React — it is not re-created on every render.
// It holds the one Socket.io connection for the entire browser tab.
//
// null  → no socket exists yet (user not logged in, or logged out)
// Socket instance → the live connection
let socketInstance = null;

/**
 * getSocket — lazily create and return the singleton socket.
 *
 * "Lazy" means we don't open the connection when the module first loads.
 * We create it on first demand — only after we have a valid token.
 *
 * @param {string} token — the JWT stored in Redux after a successful login
 * @returns {Socket} the Socket.io client instance
 */
export function getSocket(token) {
  // Only open a NEW connection if one doesn't already exist.
  // This is the core of the singleton pattern.
  if (!socketInstance) {
    // io('/') — connect to the same origin this page was served from.
    //   In development, Vite's proxy forwards the WebSocket upgrade to the server.
    //   In production, both client and server run on the same host/port.
    //
    // { auth: { token } } — Socket.io sends this object during the initial
    //   HTTP upgrade handshake (before the WebSocket is fully open).
    //   The server's socketAuth middleware reads socket.handshake.auth.token
    //   and calls next(error) to reject the connection if the token is bad.
    socketInstance = io('/', { auth: { token } });

    // ── Handle authentication failures ────────────────────────────────────
    // 'connect_error' fires when the server refuses the connection.
    // The server's socketAuth middleware calls next(new Error('...')) to reject
    // connections with bad tokens, which triggers this event on the client.
    socketInstance.on('connect_error', (err) => {
      // Check if the error is specifically an auth failure.
      // Other connect errors (network outage, server restart) should NOT
      // log the user out — they might resolve on their own.
      if (
        err.message === 'Invalid or expired token' ||
        err.message === 'No authentication token provided'
      ) {
        // Clean up the broken socket first so the module-level ref is clear.
        disconnectSocket();

        // Log the user out of Redux (clears state.auth.user + state.auth.token)
        // and removes the token from localStorage.
        //
        // We use store.dispatch directly here rather than React's useDispatch
        // because this callback runs outside of the React render cycle —
        // it is a plain Socket.io event handler. store.dispatch is always safe
        // to call from anywhere in the app (not just inside components/hooks).
        store.dispatch(logout());
      }
    });
  }

  return socketInstance;
}

/**
 * disconnectSocket — close the connection and reset the singleton to null.
 *
 * This is called:
 *   1. When the user logs out (token becomes null, detected in useSocket)
 *   2. When the server rejects our token (connect_error handler above)
 *
 * After calling this, the next getSocket() call will create a brand-new
 * connection — important for when the user logs back in with a fresh token.
 */
export function disconnectSocket() {
  // Optional chaining (?.) means: only call .disconnect() if socketInstance
  // is not null. Calling this when there is no socket is a safe no-op.
  socketInstance?.disconnect();

  // Reset the singleton so the next getSocket() call starts fresh.
  socketInstance = null;
}

/**
 * useSocket — React hook: returns the authenticated socket, or null.
 *
 * Call this from any hook or component that needs to emit events or
 * listen to server broadcasts. It always returns either:
 *   - The connected Socket.io instance (when the user is logged in), or
 *   - null (when the user is not logged in, or has just logged out)
 *
 * Because it uses useSelector internally, the component or hook that calls
 * useSocket() will automatically re-render when the token changes.
 *
 * @returns {Socket|null}
 */
export function useSocket() {
  // Read the JWT from Redux state.
  //
  // useSelector subscribes to the Redux store. When auth.token changes —
  // for example after login (null → "eyJ...") or logout ("eyJ..." → null) —
  // React will re-run this hook, returning the correct socket or null.
  const token = useSelector(selectToken);

  // ── Disconnect when the token is removed (logout) ─────────────────────────
  // useEffect with [token] in the dependency array runs whenever `token` changes.
  //
  // Scenario: user clicks "Log Out"
  //   1. authSlice.logout() sets state.auth.token = null
  //   2. useSelector detects the change → this hook re-renders
  //   3. useEffect fires because `token` changed
  //   4. token is now null → disconnectSocket() closes the WebSocket
  //
  // Why NOT put disconnect in the effect's return (cleanup) function?
  //   The cleanup runs whenever the component that calls useSocket() unmounts,
  //   which can happen for reasons unrelated to logout (routing, re-renders).
  //   We only want to disconnect on logout, not every component unmount.
  //   Checking `if (!token)` inside the effect body gives us that precision.
  useEffect(() => {
    if (!token) {
      // Token is gone — this means the user has logged out (or was force-logged
      // out by a 401 response interceptor in api.js). Close the connection.
      disconnectSocket();
    }
    // When token goes from null → a value (login), we do nothing here.
    // getSocket() below will lazily create the socket on the next render.
  }, [token]); // re-run only when the token value changes

  // If the user is not authenticated, return null.
  // Hooks that call useSocket() guard against null: `if (!socket) return;`
  if (!token) return null;

  // Return the singleton (creates it on the first call, reuses on subsequent calls).
  return getSocket(token);
}
