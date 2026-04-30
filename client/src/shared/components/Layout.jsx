/**
 * Layout — Persistent Authenticated Shell (US-103, US-201, US-601)
 *
 * This component is the visual wrapper for every page a logged-in user sees.
 * It renders once and stays on screen while the user navigates between rooms —
 * only the inner content area (the <Outlet />) swaps out.
 *
 * ─── HOW REACT ROUTER'S <Outlet /> WORKS ────────────────────────────────────
 * When you nest routes in App.jsx like this:
 *
 *   <Route element={<Layout />}>
 *     <Route path="/" element={<ChatPanel />} />
 *   </Route>
 *
 * React Router renders <Layout /> for all of those paths, but replaces the
 * <Outlet /> placeholder with whichever child route matched. Layout only
 * renders once — the header and sidebar stay mounted continuously.
 *
 * ─── RESPONSIVE LAYOUT STRATEGY (US-601) ────────────────────────────────────
 *
 *   Desktop (≥ 768px):
 *   ┌───────────────────────────────────────────┐  ← topBar (52px, fixed height)
 *   ├──────────┬────────────────────────────────┤
 *   │ Sidebar  │  <Outlet /> (chat panel)       │  ← body (flex row, fills rest)
 *   │  220px   │  flex: 1                       │
 *   └──────────┴────────────────────────────────┘
 *
 *   Mobile (< 768px), sidebar closed:
 *   ┌───────────────────────────────────────────┐  ← topBar
 *   │ [☰]  💬 RealTimeChat       alice [Log out]│
 *   ├───────────────────────────────────────────┤
 *   │  <Outlet /> — full viewport width         │  ← body (sidebar is off-screen)
 *   └───────────────────────────────────────────┘
 *
 *   Mobile (< 768px), sidebar open:
 *   ┌───────────────────────────────────────────┐
 *   │ [✕]  💬 RealTimeChat       alice [Log out]│
 *   ├────────────┬──────────────────────────────┤
 *   │  Sidebar   │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← Sidebar: position fixed
 *   │  (drawer)  │ ░░  backdrop overlay  ░░░░░ │    Backdrop: position fixed
 *   │            │ ░░  (tap to close)    ░░░░░ │    zIndex: sidebar(200) > backdrop(150)
 *   └────────────┴──────────────────────────────┘
 *
 * ─── HOW THE MOBILE DRAWER WORKS ────────────────────────────────────────────
 * On mobile the <Sidebar> uses position: 'fixed', removing it from the normal
 * document flow. The <main> then fills 100% of the body's width automatically —
 * no changes to the body div's flex rules are needed.
 *
 * When sidebarOpen is false → Sidebar is slid off-screen with CSS transform.
 * When sidebarOpen is true  → Sidebar slides into view.
 * The transition is smooth because Sidebar stays mounted in the DOM both ways;
 * we never conditionally remove it (which would prevent the slide animation).
 *
 * ─── AUTO-CLOSE ON ROOM SELECTION ───────────────────────────────────────────
 * On mobile, once the user taps a room in the sidebar the chat panel should
 * fill the screen immediately. We watch Redux activeRoomId with useSelector:
 * when it changes, we call setSidebarOpen(false).
 *
 * ─── ESCAPE KEY ──────────────────────────────────────────────────────────────
 * A document-level keydown listener fires when the user presses Escape while
 * the sidebar is open. This matches standard drawer/dialog UX expectations and
 * is important for keyboard accessibility.
 *
 * ─── LOGOUT FLOW ─────────────────────────────────────────────────────────────
 * 1. User clicks "Log out" → handleLogout()
 * 2. useAuth().logout() dispatches Redux `logout` → clears token + user state
 * 3. navigate('/login') redirects to the login page
 */
import { useState, useEffect }       from 'react';
import { Outlet, useNavigate }       from 'react-router-dom';
import { useSelector }               from 'react-redux';
import { useAuth }                   from '../../features/auth/hooks/useAuth';
import { selectActiveRoomId }        from '../../features/rooms/roomsSlice';
import { useMobile }                 from '../hooks/useMobile';
import { useUnreadBadges }           from '../../features/chat/hooks/useUnreadBadges';
import { useRoomInvites }            from '../hooks/useRoomInvites';
import { usePresence }               from '../../features/presence/hooks/usePresence';
import Sidebar                       from './Sidebar';

// Shared constant so the topBar height and the Sidebar's `top` offset on mobile
// are always identical — change it in one place and both update.
const TOP_BAR_HEIGHT = 52; // px

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  // isMobile is true when viewport width < 768px.
  // useMobile() attaches a resize listener so this updates on window resize
  // or device rotation — no page refresh needed.
  const isMobile = useMobile();

  // ── US-602: Real-time unread badge listener ───────────────────────────────
  // Called here (in Layout) because Layout stays mounted for the entire
  // authenticated session. This means the 'badge_update' socket listener is
  // always active — even when the user is idle or has no room selected.
  //
  // If we called useUnreadBadges() inside ChatPanel instead, the listener
  // would not exist when ChatPanel shows the empty state (no room selected),
  // and badge updates would be silently dropped.
  //
  // The hook returns nothing — all its work is side-effect driven.
  useUnreadBadges();

  // ── US-206: Real-time room-invite listener ────────────────────────────────
  // Listens for 'room_added' socket events emitted by the server when another
  // user invites this user into a room. On receipt, it invalidates the ['rooms']
  // React Query cache so the new room appears in the sidebar immediately.
  //
  // Called here for the same reason as useUnreadBadges — Layout is always
  // mounted, so the listener is always active regardless of which room (if any)
  // the user currently has open.
  useRoomInvites();

  // ── US-401 / US-402: Real-time presence listener ──────────────────────────
  // Listens for 'presence_snapshot', 'user_online', and 'user_offline' socket
  // events and keeps the Redux presenceSlice in sync. Called here so the
  // listener is always active, regardless of which room (if any) is open.
  usePresence();

  // ── Sidebar open/close state ──────────────────────────────────────────────
  // On mobile:  controls whether the drawer sidebar is slid in or out.
  // On desktop: Sidebar is always visible; this state value is ignored.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Auto-close when the user picks a room ────────────────────────────────
  // useSelector subscribes to the Redux store. When state.rooms.activeRoomId
  // changes (user tapped a room), this component re-renders and the effect fires.
  const activeRoomId = useSelector(selectActiveRoomId);

  useEffect(() => {
    // Hide the mobile drawer so the chat panel becomes fully visible.
    // On desktop this is a harmless no-op — the sidebar always shows.
    setSidebarOpen(false);
  }, [activeRoomId]);

  // ── Escape key closes the sidebar ────────────────────────────────────────
  useEffect(() => {
    // Only register the listener when the sidebar is actually open.
    // If it is already closed there is nothing to close, so we skip.
    if (!sidebarOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }

    // document-level listener fires regardless of which element has focus,
    // so the user doesn't have to click inside the sidebar first.
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup: remove listener when the sidebar closes or when this effect
    // re-runs (which happens if sidebarOpen changes). Without cleanup,
    // stale handlers would pile up and fire multiple times.
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  function handleLogout() {
    logout();           // clear Redux + localStorage
    navigate('/login');
  }

  function toggleSidebar() {
    // Using functional update (prev => !prev) is the safe way to flip a boolean
    // in React when the new value depends on the old one. It avoids stale closure
    // issues that can happen if two rapid clicks arrive in the same render cycle.
    setSidebarOpen(prev => !prev);
  }

  return (
    // Full-viewport flex column. overflow: 'hidden' keeps the shell itself from
    // scrolling; individual children manage their own scroll areas.
    <div style={styles.shell}>

      {/* ── Top bar ── */}
      {/*
       * Always 52px tall (flexShrink: 0).
       * Desktop: [app name]    [username] [Log out]
       * Mobile:  [☰] [app name]   [alice] [Log out]
       *
       * Two flex sub-groups (topBarLeft, topBarRight) with justifyContent:
       * 'space-between' on the header push them to opposite ends.
       */}
      <header style={styles.topBar}>

        <div style={styles.topBarLeft}>

          {/*
           * ── Hamburger / close button — mobile only ─────────────────────────
           *
           * This button is conditionally rendered: it only appears when
           * isMobile is true. On desktop, this JSX produces nothing at all.
           *
           * Accessibility attributes:
           *   aria-label    — what screen readers announce ("Open menu" / "Close menu")
           *   aria-expanded — tells assistive tech whether the controlled region is open
           *   aria-controls — links this button to the sidebar element (by id="sidebar")
           *
           * ☰ and ✕ give visual feedback about the current state.
           * The 44×44px size is enforced by index.css plus explicit width/height here.
           */}
          {isMobile && (
            <button
              onClick={toggleSidebar}
              style={styles.hamburger}
              aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={sidebarOpen}
              aria-controls="sidebar"
            >
              {sidebarOpen ? '✕' : '☰'}
            </button>
          )}

          {/* App name — always visible; never wraps */}
          <span style={styles.appName}>💬 RealTimeChat</span>

        </div>

        <div style={styles.topBarRight}>
          {/*
           * On mobile, show just the username (e.g. "alice") to save space.
           * On desktop, show the full "Logged in as alice" string.
           */}
          {user && (
            <span style={styles.username}>
              {isMobile ? user.username : `Logged in as ${user.username}`}
            </span>
          )}

          {/*
           * Log out button. min-height 44px comes from index.css.
           * display:'flex' + alignItems:'center' vertically centres the text
           * within those 44px.
           */}
          <button onClick={handleLogout} style={styles.logoutButton}>
            Log out
          </button>
        </div>

      </header>

      {/* ── Body: sidebar + main content ── */}
      {/*
       * display:'flex' puts Sidebar and main in a row.
       * On desktop, Sidebar is a 220px flex child and main fills the rest.
       * On mobile, Sidebar has position:'fixed' (see Sidebar.jsx), so it is
       * removed from the flex flow and main expands to full width automatically.
       */}
      <div style={styles.body}>

        {/*
         * isOpen → Sidebar uses this to slide itself in or out on mobile.
         * onClose → called if Sidebar has its own internal close mechanism.
         * id="sidebar" → referenced by the hamburger's aria-controls attribute.
         */}
        <Sidebar
          id="sidebar"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Child route renders here (currently ChatPanel at "/") */}
        <main style={styles.main}>
          <Outlet />
        </main>

      </div>

      {/*
       * ── Backdrop overlay — mobile only, when sidebar is open ──────────────
       *
       * Only rendered when isMobile && sidebarOpen — never on desktop.
       *
       * What it does:
       *   1. Darkens the chat panel behind the open sidebar so the sidebar
       *      feels like a temporary overlay rather than a permanent column.
       *   2. Gives the user a large tap target to close the sidebar — tapping
       *      anywhere on the dark area closes the drawer.
       *
       * z-index layering (highest wins):
       *   Main content:  z-index auto (effectively 0)
       *   Backdrop:      z-index 150   ← this div
       *   Sidebar:       z-index 200   ← see Sidebar.jsx
       *
       * position:'fixed' + inset:0 is shorthand for top/right/bottom/left:0.
       * It covers the entire browser viewport including the area under the
       * top bar (the top bar's z-index stacks on top of the backdrop because
       * it comes later in the DOM and has a higher implied stacking context).
       *
       * aria-hidden="true" hides this from screen readers — it is purely visual.
       * The sidebar open/closed state is already communicated via aria-expanded
       * on the hamburger button.
       */}
      {isMobile && sidebarOpen && (
        <div
          style={styles.backdrop}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

    </div>
  );
}

// ─── Style objects ────────────────────────────────────────────────────────────
const styles = {
  // Full-viewport container — flex column so header + body stack vertically
  shell: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    fontFamily:    'system-ui, sans-serif',
    overflow:      'hidden',
  },

  // Header bar — always exactly TOP_BAR_HEIGHT pixels, never shrinks
  topBar: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '0 1rem',
    height:         `${TOP_BAR_HEIGHT}px`,
    background:     '#1976d2',
    color:          '#fff',
    flexShrink:     0,
    gap:            '0.5rem',
  },

  // Left group: [hamburger (mobile only)] [app name]
  topBarLeft: {
    display:    'flex',
    alignItems: 'center',
    gap:        '0.5rem',
    minWidth:   0, // allow children to shrink rather than overflowing the bar
  },

  // ── Hamburger / close button ─────────────────────────────────────────────
  // Explicitly 44×44px square. index.css also sets min-height/min-width 44px,
  // but the explicit width/height here makes the button a perfect square and
  // centres the ☰/✕ icon both horizontally and vertically.
  hamburger: {
    width:          '44px',
    height:         '44px',
    flexShrink:     0,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    background:     'rgba(255,255,255,0.15)',
    border:         '1px solid rgba(255,255,255,0.3)',
    borderRadius:   '6px',
    color:          '#fff',
    fontSize:       '1.2rem',
    cursor:         'pointer',
    padding:        0,
  },

  appName: {
    fontWeight:    700,
    fontSize:      '1.05rem',
    letterSpacing: '0.01em',
    whiteSpace:    'nowrap',
  },

  // Right group: [username] [Log out]
  topBarRight: {
    display:    'flex',
    alignItems: 'center',
    gap:        '0.75rem',
    flexShrink: 0,
  },

  username: {
    fontSize:    '0.85rem',
    opacity:     0.9,
    whiteSpace:  'nowrap',
    overflow:    'hidden',
    textOverflow:'ellipsis',
  },

  // Log out button — white outline style so it reads as secondary on the blue bar
  logoutButton: {
    display:      'flex',       // vertically centres text within the 44px min-height
    alignItems:   'center',
    padding:      '0 0.85rem',
    background:   'rgba(255,255,255,0.15)',
    color:        '#fff',
    border:       '1px solid rgba(255,255,255,0.4)',
    borderRadius: '4px',
    fontSize:     '0.875rem',
    cursor:       'pointer',
    whiteSpace:   'nowrap',
    // min-height: 44px is inherited from index.css; we don't override it here
  },

  // Body row: sidebar + main. flex:1 fills all height below the top bar.
  body: {
    display:  'flex',
    flex:     1,
    overflow: 'hidden',
  },

  // Main content area — fills all width not taken by the sidebar.
  // min-width: 0 prevents very long words from stretching this box wider
  // than the viewport (without it, flexbox allows children to overflow).
  main: {
    flex:       1,
    overflow:   'auto',
    background: '#f5f7fb',
    minWidth:   0,
  },

  // ── Full-screen backdrop ─────────────────────────────────────────────────
  // position:'fixed', inset:0 → covers the full viewport
  // zIndex: 150 → above content (auto), below sidebar (200)
  backdrop: {
    position:   'fixed',
    inset:      0,
    background: 'rgba(0, 0, 0, 0.45)',
    zIndex:     150,
  },
};
