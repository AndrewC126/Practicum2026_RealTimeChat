/**
 * Layout — Persistent Authenticated Shell (US-103)
 *
 * This component is the visual wrapper for every page a logged-in user sees.
 * It renders once and stays on screen while the user navigates between rooms,
 * settings, etc. — only the inner content area (the <Outlet />) swaps out.
 *
 * ─── HOW REACT ROUTER'S <Outlet /> WORKS ────────────────────────────────────
 * When you nest routes in App.jsx like this:
 *
 *   <Route element={<Layout />}>          ← Layout is the "parent" route element
 *     <Route path="/" element={<Chat />} />
 *     <Route path="/settings" element={<Settings />} />
 *   </Route>
 *
 * React Router renders <Layout /> for all of those paths, but replaces the
 * <Outlet /> placeholder inside Layout with whichever child route matched.
 * Layout only renders once; the content area swaps without re-mounting the
 * header or sidebar.
 *
 * ─── HOW LOGOUT WORKS (end-to-end) ─────────────────────────────────────────
 * 1. User clicks the "Log out" button in the top bar.
 * 2. handleLogout() calls useAuth().logout(), which dispatches the `logout`
 *    Redux action defined in authSlice.js.
 * 3. The reducer runs:
 *      state.token = null
 *      state.user  = null
 *      localStorage.removeItem('token')   ← clears persisted token
 * 4. handleLogout() then calls navigate('/login') to send the user to the
 *    login page immediately.
 * 5. Even if navigate() weren't called, the <RequireAuth> wrapper in App.jsx
 *    would catch the now-null token on the next render and redirect to /login
 *    automatically.
 *
 * ─── WHY BACK-NAVIGATION DOESN'T GRANT ACCESS (US-103 AC) ──────────────────
 * After step 3, localStorage no longer has a token. When the user presses the
 * browser back button:
 *   - React Router re-renders the matched route component.
 *   - <RequireAuth> reads token from the Redux store — it's null.
 *   - RequireAuth returns <Navigate to="/login" replace />, overwriting the
 *     history entry so the browser can't go "back" to the protected page again.
 *
 * Note on JWTs: unlike server-side sessions, a JWT can't be "invalidated" on
 * the server once issued — it's valid until it expires (7 days, per auth.service).
 * Clearing it from the client is enough for normal logout. If you need
 * "force-logout" (e.g., account deletion, security breach), you would maintain
 * a server-side token blocklist and check it in requireAuth middleware.
 */
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';

export default function Layout() {
  // useAuth() reads from Redux and gives us the logout action
  const { user, logout } = useAuth();

  // useNavigate() returns a function we can call to change the URL
  // programmatically (i.e., from JavaScript, not a <Link> click)
  const navigate = useNavigate();

  function handleLogout() {
    logout();            // clears Redux state + localStorage token
    navigate('/login');  // send the user to the login page
  }

  return (
    // CSS Grid: one fixed-height header row, one row that fills the rest
    <div style={styles.shell}>

      {/* ── Top bar ── visible on every page while logged in (US-103 AC) */}
      <header style={styles.topBar}>
        <span style={styles.appName}>💬 RealTimeChat</span>

        <div style={styles.topBarRight}>
          {/* Show the username so the user knows which account is active */}
          {user && (
            <span style={styles.username}>
              Logged in as <strong>{user.username}</strong>
            </span>
          )}

          {/*
           * The logout button is always visible here — meeting the AC:
           * "visible and accessible from any page while logged in".
           * It lives in Layout (not in individual pages) so it only needs
           * to be written once.
           */}
          <button onClick={handleLogout} style={styles.logoutButton}>
            Log out
          </button>
        </div>
      </header>

      {/*
       * ── Content area ──
       * <Outlet /> is where React Router renders the matched child route.
       * Right now "/" just shows a placeholder. Once the chat UI is built,
       * <ChatPanel /> will appear here instead.
       */}
      <main style={styles.content}>
        <Outlet />
      </main>

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
// Inline styles keep this component self-contained for now.
// In a larger project these would move to a CSS file or a styling library.
const styles = {
  // The outer shell takes the full viewport height and stacks vertically
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: 'system-ui, sans-serif',
  },

  // Fixed-height bar pinned to the top
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.25rem',
    height: '52px',
    background: '#1976d2',
    color: '#fff',
    flexShrink: 0,   // prevent the header from shrinking when content is tall
  },

  appName: {
    fontWeight: 700,
    fontSize: '1.1rem',
    letterSpacing: '0.01em',
  },

  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },

  username: {
    fontSize: '0.875rem',
    opacity: 0.9,
  },

  logoutButton: {
    padding: '0.35rem 0.85rem',
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '4px',
    fontSize: '0.875rem',
    cursor: 'pointer',
  },

  // The main area fills all remaining space below the header
  content: {
    flex: 1,
    overflow: 'auto',  // scroll if content is taller than available space
  },
};
