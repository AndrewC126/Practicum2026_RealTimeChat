/**
 * useAuth — Auth State Hook
 *
 * This hook is a thin wrapper over `useSelector` that gives any component
 * easy access to auth state without importing the selector directly.
 * It also exposes login/register/logout functions so components don't need
 * to know about the API layer or Redux dispatch.
 *
 * What it returns:
 *   {
 *     user,       // { id, username, email } or null
 *     token,      // JWT string or null
 *     login,      // async (email, password) => void — calls POST /api/auth/login
 *     register,   // async (username, email, password) => void — calls POST /api/auth/register
 *     logout,     // () => void — dispatches logout action, disconnects socket
 *   }
 *
 * How login works end-to-end:
 *   1. <LoginForm /> calls useAuth().login(email, password)
 *   2. login() calls api.post('/auth/login', { email, password })
 *   3. Server validates credentials, returns { user, token }
 *   4. login() dispatches setCredentials({ user, token }) to Redux
 *   5. App.jsx re-renders, sees user is now set, navigates to "/"
 *   6. The Axios interceptor now includes the Bearer token on all requests
 *
 * Implementation checklist:
 *   - import { useSelector, useDispatch } from 'react-redux'
 *   - import { setCredentials, logout as logoutAction } from '../authSlice'
 *   - import api from '../../../services/api'
 *   - Read user and token with useSelector(state => state.auth)
 *   - Implement login: call api, dispatch setCredentials on success
 *   - Implement register: same pattern but POST /auth/register
 *   - Implement logout: dispatch logoutAction(), call disconnectSocket()
 *   - Return { user, token, login, register, logout }
 */
export function useAuth() {}
