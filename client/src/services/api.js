/**
 * Axios API Client (base instance)
 *
 * One configured Axios instance shared by every file that makes HTTP calls.
 * The request interceptor attaches the JWT so you never have to pass it manually.
 * The response interceptor clears auth state on 401 so stale tokens are cleaned up.
 */
import axios from 'axios';
import { store } from '../store/store';
import { logout } from '../features/auth/authSlice';

const api = axios.create({ baseURL: '/api' });

// Attach the Bearer token to every outgoing request
api.interceptors.request.use(config => {
  const token = store.getState().auth.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 (token expired or invalid), log the user out automatically
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      store.dispatch(logout());
    }
    return Promise.reject(error);
  }
);

export default api;
