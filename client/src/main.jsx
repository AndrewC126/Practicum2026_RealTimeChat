/**
 * React Application Entry Point
 *
 * This is the first JavaScript file Vite executes (referenced in index.html).
 * Its job is to mount the React component tree into the DOM and wrap the root
 * component with every global provider the app needs.
 *
 * Provider order matters — providers can only be consumed by components that
 * are rendered INSIDE them. The typical nesting order is:
 *
 *   <Provider store={store}>          ← Redux: makes the store available to
 *     <QueryClientProvider ...>       ← React Query: manages server-state cache
 *       <App />                       ← The rest of the component tree
 *     </QueryClientProvider>
 *   </Provider>
 *
 * Why two state managers?
 *   - Redux (via Redux Toolkit) handles ephemeral UI state: who is typing,
 *     which room is active, the logged-in user object. This data does not need
 *     to be fetched from the server on every render.
 *   - React Query handles server state: message history, room lists. It
 *     automatically caches responses, refetches in the background, and gives
 *     you loading/error states for free. Using Redux for this would require
 *     writing all that caching logic by hand.
 *
 * Implementation checklist:
 *   1. Import `store` from ./store/store
 *   2. Import `Provider` from react-redux
 *   3. Import `QueryClient` and `QueryClientProvider` from @tanstack/react-query
 *   4. Create a `new QueryClient()` instance outside the render call (so it is
 *      not recreated on every hot reload)
 *   5. Call ReactDOM.createRoot(document.getElementById('root')).render(...)
 *      with the provider tree above wrapping <App />
 */

// Vite entry point — mounts React, Redux Provider, QueryClientProvider
