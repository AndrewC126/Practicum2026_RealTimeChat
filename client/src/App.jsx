/**
 * Root Application Component
 *
 * This file owns the entire route tree. Understanding the structure:
 *
 * ─── ROUTE NESTING IN REACT ROUTER v6 ───────────────────────────────────────
 * Routes can be nested inside one another. A parent route renders its
 * `element` and puts an <Outlet /> somewhere inside it. Child routes render
 * into that Outlet.
 *
 * Here we use a "layout route" — a route with no `path` of its own, whose
 * only job is to wrap child routes with a shared UI shell:
 *
 *   <Route element={<RequireAuth><Layout /></RequireAuth>}>
 *     <Route path="/" element={<ChatPanel />} />
 *   </Route>
 *
 * React Router matches "/" → renders RequireAuth → renders Layout →
 * renders ChatPanel inside Layout's <Outlet />.
 *
 * ─── REQUIREAUTH ─────────────────────────────────────────────────────────────
 * RequireAuth reads the JWT token from Redux. If it's null (not logged in),
 * it renders <Navigate to="/login" replace /> instead of its children.
 *
 * `replace` is important: it replaces the current history entry instead of
 * pushing a new one. This means after a successful login and redirect to "/",
 * the user pressing "back" goes to the login page — not to "/" again (which
 * would instantly redirect them back to "/login" in a confusing loop).
 *
 * ─── UNAUTHENTICATED ROUTES ──────────────────────────────────────────────────
 * /login and /register are rendered outside RequireAuth so users who are not
 * logged in can always reach them.
 *
 * The catch-all <Route path="*"> redirects any unknown URL to /login.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import LoginForm    from './features/auth/components/LoginForm';
import RegisterForm from './features/auth/components/RegisterForm';
import Layout       from './shared/components/Layout';
import ChatPanel    from './features/chat/components/ChatPanel';

/**
 * RequireAuth — Auth Guard Component
 *
 * Wraps protected routes. If the user has no token, redirect them to /login
 * before they can see any protected content.
 *
 * Why check the token rather than the user object?
 *   On a page refresh, the Redux store is rebuilt from localStorage. The
 *   token is restored by authSlice's initialState, but the `user` object
 *   (name, email, etc.) is not — it would need a server round-trip to restore.
 *   Checking `token` lets users stay "logged in" across refreshes while we
 *   defer fetching the full user profile until the chat UI is built.
 */
function RequireAuth({ children }) {
  const token = useSelector(state => state.auth.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Public routes — no auth required ── */}
        <Route path="/login"    element={<LoginForm />} />
        <Route path="/register" element={<RegisterForm />} />

        {/*
         * ── Protected layout route ──
         * No `path` here — this route only wraps its children with auth
         * checking and the persistent Layout shell (header + logout button).
         * Every route nested inside here is automatically protected.
         */}
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          {/*
           * index route: matches exactly "/"
           * ChatPanel reads the active room from Redux and renders the message
           * feed. If no room is selected it shows an empty-state prompt.
           */}
          <Route index element={<ChatPanel />} />
        </Route>

        {/* Catch-all: redirect any unknown URL to /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}
