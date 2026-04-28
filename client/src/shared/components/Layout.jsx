/**
 * Layout — Persistent Shell Component
 *
 * Layout is the parent route element in App.jsx. It renders the chrome
 * (the parts of the UI that stay the same across every page): the sidebar
 * and the top navigation bar. Child routes render inside an <Outlet />.
 *
 * React Router's <Outlet />:
 *   When you nest routes like:
 *     <Route path="/" element={<Layout />}>
 *       <Route index element={<ChatPanel />} />
 *     </Route>
 *   React Router renders <Layout /> and replaces <Outlet /> with the matched
 *   child route's component (<ChatPanel /> in this case).
 *   This means Layout only renders once; only the content area swaps.
 *
 * Typical structure:
 *   <div className="app-shell">
 *     <Sidebar />               ← room list + member list
 *     <main className="content">
 *       <Outlet />              ← ChatPanel or other pages render here
 *     </main>
 *   </div>
 *
 * Implementation checklist:
 *   - Import { Outlet } from 'react-router-dom'
 *   - Import Sidebar from './Sidebar'
 *   - Render a two-column layout (sidebar + content area)
 *   - Add a top bar with the app name and a logout button that dispatches
 *     the logout action from authSlice
 */
export default function Layout() {}
