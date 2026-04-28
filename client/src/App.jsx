/**
 * Root Application Component
 *
 * App is the top of the component tree. Its main responsibilities are:
 *
 * 1. Routing — decide which "page" to render based on the URL.
 *    This project uses React Router. Core concepts:
 *      <BrowserRouter>   wraps the app so components can read the URL
 *      <Routes>          container that picks the first matching <Route>
 *      <Route path="/" element={<Layout />}>  renders Layout for "/"
 *        <Route index element={<ChatPanel />} />  default child route
 *        <Route path="login" element={<LoginForm />} />
 *        <Route path="register" element={<RegisterForm />} />
 *      </Route>
 *
 * 2. Auth gate — redirect unauthenticated users to /login.
 *    Use the `useAuth` hook to read auth state from Redux, then render a
 *    <Navigate to="/login" replace /> if there is no current user.
 *    Wrap protected routes in a small <RequireAuth> component for reuse.
 *
 * 3. Socket initialization — call `useSocket()` here (or in a useEffect)
 *    so the socket connects once when the app mounts after login and
 *    disconnects when the user logs out.
 *
 * Implementation checklist:
 *   - Import BrowserRouter, Routes, Route, Navigate from react-router-dom
 *   - Import Layout, LoginForm, RegisterForm, ChatPanel
 *   - Import useAuth from features/auth/hooks/useAuth
 *   - Build the route tree described above
 *   - Add a RequireAuth wrapper that checks useAuth().user
 */
export default function App() {}
