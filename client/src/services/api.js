/**
 * Axios API Client (base instance)
 *
 * Instead of calling `fetch('/api/...')` with the same options in every file,
 * we create one configured Axios instance here and export it. Every other file
 * imports this instance and calls `api.get(...)`, `api.post(...)`, etc.
 *
 * Why Axios over fetch?
 *   - Automatic JSON serialization/deserialization (no `.json()` call needed)
 *   - Interceptors let you attach the JWT token to every request in one place
 *     instead of passing headers manually each time
 *   - Better error handling: Axios throws on 4xx/5xx by default; fetch does not
 *
 * Key configuration:
 *   baseURL: '/api'
 *     All requests are relative to /api. The Vite proxy (vite.config.js)
 *     forwards them to http://localhost:3001/api during development.
 *
 *   Request interceptor — attach JWT token:
 *     axios.interceptors.request.use(config => {
 *       const token = store.getState().auth.token;
 *       if (token) config.headers.Authorization = `Bearer ${token}`;
 *       return config;
 *     });
 *
 *   Response interceptor — handle 401 Unauthorized:
 *     axios.interceptors.response.use(
 *       response => response,
 *       error => {
 *         if (error.response?.status === 401) {
 *           store.dispatch(logout()); // clear Redux auth state
 *         }
 *         return Promise.reject(error);
 *       }
 *     );
 *
 * Implementation checklist:
 *   1. npm install axios  (if not already in package.json)
 *   2. import axios from 'axios'
 *   3. const api = axios.create({ baseURL: '/api' })
 *   4. Add the request interceptor to inject the Bearer token
 *   5. Add the response interceptor to handle 401s
 *   6. export default api
 */

// Axios base instance for REST calls to the Express server
