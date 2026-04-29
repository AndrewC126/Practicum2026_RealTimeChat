/**
 * React Application Entry Point
 *
 * Mounts the React tree into the #root div and wraps the app with every
 * global provider it needs:
 *
 *   <Provider store={store}>          ← Redux: makes the store available app-wide
 *     <QueryClientProvider ...>       ← React Query: manages server-state cache
 *       <App />
 *     </QueryClientProvider>
 *   </Provider>
 */
// Global CSS — imported here so it applies to every component in the app.
// Handles box-sizing reset, overflow prevention, and 44 px touch targets (US-601).
// This is the ONE place to import global styles; all other styles live inline.
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './store/store';
import App from './App';

// Create the QueryClient once outside render so it isn't reset on hot-reload
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);
