/**
 * Layout — Persistent Authenticated Shell (US-103, US-201)
 *
 * This component is the visual wrapper for every page a logged-in user sees.
 * It renders once and stays on screen while the user navigates between rooms —
 * only the inner content area (the <Outlet />) swaps out.
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
 * <Outlet /> placeholder with whichever child route matched. Layout only
 * renders once — the header and sidebar stay mounted continuously.
 *
 * ─── CSS LAYOUT STRUCTURE ────────────────────────────────────────────────────
 * We use flexbox to build the three-region shell:
 *
 *   ┌───────────────────────────────────────────┐  ← topBar (52px, flexShrink: 0)
 *   ├──────────┬────────────────────────────────┤
 *   │          │                                │
 *   │ Sidebar  │     <Outlet /> (main)          │  ← body (flex: 1, overflow hidden)
 *   │  220px   │     flex: 1, overflow: auto    │
 *   │          │                                │
 *   └──────────┴────────────────────────────────┘
 *
 *   shell:   display flex, flexDirection column, height 100vh
 *   topBar:  flexShrink 0 (never compressed)
 *   body:    flex 1 (takes all remaining height), display flex, flexDirection row
 *   main:    flex 1 (takes all remaining width), overflow auto (scrolls content)
 *
 * ─── HOW LOGOUT WORKS (end-to-end) ─────────────────────────────────────────
 * 1. User clicks "Log out" in the top bar.
 * 2. handleLogout() calls useAuth().logout() → dispatches the Redux `logout`
 *    action → sets token/user to null → removes token from localStorage.
 * 3. navigate('/login') sends the user to the login page.
 * 4. Even without navigate(), <RequireAuth> in App.jsx would detect the null
 *    token and redirect automatically on the next render.
 *
 * ─── WHY BACK-NAVIGATION DOESN'T GRANT ACCESS ───────────────────────────────
 * After logout the token is null everywhere (Redux + localStorage). If the user
 * presses the browser back button, React Router re-renders the route, RequireAuth
 * reads the null token, and redirects to /login with `replace` — which also
 * overwrites the history entry so "back" can't loop back to the protected page.
 */
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/hooks/useAuth';
import Sidebar from './Sidebar';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();           // clears Redux state + localStorage token
    navigate('/login'); // immediately redirect to the login page
  }

  return (
    <div style={styles.shell}>

      {/* ── Top bar ── visible on every authenticated page (US-103 AC) */}
      <header style={styles.topBar}>
        <span style={styles.appName}>💬 RealTimeChat</span>

        <div style={styles.topBarRight}>
          {user && (
            <span style={styles.username}>
              Logged in as <strong>{user.username}</strong>
            </span>
          )}
          <button onClick={handleLogout} style={styles.logoutButton}>
            Log out
          </button>
        </div>
      </header>

      {/*
       * ── Body row ──
       * Sidebar sits on the left; the main content area fills the rest.
       * Using flex here instead of CSS Grid keeps the code simpler for
       * a two-column layout with one fixed-width column.
       */}
      <div style={styles.body}>

        {/*
         * Sidebar renders the room list (US-201) and will later hold the
         * member presence list (US-401). It manages its own data fetching.
         */}
        <Sidebar />

        {/*
         * <Outlet /> is the slot where React Router renders the current child
         * route — right now the "/" index route (the "Chat coming soon" placeholder).
         * When ChatPanel is built it will render here instead.
         */}
        <main style={styles.main}>
          <Outlet />
        </main>

      </div>
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: 'system-ui, sans-serif',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 1.25rem',
    height: '52px',
    background: '#1976d2',
    color: '#fff',
    flexShrink: 0, // prevent the header from shrinking when content is tall
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
  body: {
    display: 'flex',
    flex: 1,           // fill all space below the header
    overflow: 'hidden', // prevent the body itself from scrolling; children scroll independently
  },
  main: {
    flex: 1,
    overflow: 'auto',  // the content area scrolls if it overflows
    background: '#f5f7fb',
  },
};
