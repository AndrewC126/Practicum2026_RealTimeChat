/**
 * useAuth — Auth State Hook
 *
 * Wraps useSelector/useDispatch so components get auth state and actions
 * through one import instead of knowing about Redux and the API layer separately.
 */
import { useSelector, useDispatch } from 'react-redux';
import { setCredentials, logout as logoutAction } from '../authSlice';
import api from '../../../services/api';

export function useAuth() {
  const dispatch = useDispatch();
  const user  = useSelector(state => state.auth.user);
  const token = useSelector(state => state.auth.token);

  async function register(username, email, password) {
    // Throws on error — callers must catch and display the message
    const { data } = await api.post('/auth/register', { username, email, password });
    dispatch(setCredentials(data));
  }

  async function login(email, password) {
    // Throws on error — callers must catch and display the message
    const { data } = await api.post('/auth/login', { email, password });
    dispatch(setCredentials(data));
  }

  function logout() {
    dispatch(logoutAction());
  }

  return { user, token, register, login, logout };
}
