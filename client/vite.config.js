/**
 * Vite Configuration
 *
 * Vite is the build tool and dev server for the React client. It replaces
 * older tools like Create React App (webpack). Key concepts:
 *
 * plugins: [react()]
 *   - Enables JSX transformation and React Fast Refresh (hot module replacement).
 *   - Fast Refresh means edits to a component update the browser instantly
 *     without losing component state — you don't need to manually reload.
 *
 * server.proxy
 *   - During development, the client runs on http://localhost:5173 and the
 *     Express server runs on http://localhost:3001. Browsers block cross-origin
 *     requests by default (CORS). The proxy solves this by forwarding any request
 *     that starts with "/api" from the Vite dev server to the Express server,
 *     so from the browser's perspective all requests go to the same origin.
 *   - Example: fetch('/api/rooms') in the browser → Vite forwards it to
 *     http://localhost:3001/api/rooms.
 *   - In production you would configure your web server (nginx, etc.) to do
 *     the same thing, so no change to your fetch calls is needed.
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
