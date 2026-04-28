/**
 * useTyping — Typing Indicator Logic (US-303)
 *
 * Manages both sending and receiving typing events over Socket.io.
 *
 * Sending (this user is typing):
 *   When the user types in MessageInput, emit 'typing_start' to the server.
 *   When they stop (debounced ~2 seconds after the last keystroke, or on send),
 *   emit 'typing_stop'. This avoids flooding the server with events on every
 *   keystroke.
 *
 *   Debounce pattern using a ref (preferred over setTimeout state):
 *     const stopTimer = useRef(null);
 *     function onKeyDown() {
 *       socket.emit('typing_start', { roomId });
 *       clearTimeout(stopTimer.current);
 *       stopTimer.current = setTimeout(() => {
 *         socket.emit('typing_stop', { roomId });
 *       }, 2000);
 *     }
 *
 * Receiving (other users are typing):
 *   Listen for 'typing_update' events from the server and dispatch
 *   the setTyping action to chatSlice so TypingIndicator can read it.
 *     useEffect(() => {
 *       socket.on('typing_update', ({ username, isTyping }) =>
 *         dispatch(setTyping({ roomId, username, isTyping }))
 *       );
 *       return () => socket.off('typing_update');
 *     }, [socket, roomId]);
 *
 * What this hook returns:
 *   { onKeyDown }  — attach this to the MessageInput's onKeyDown prop
 *
 * Implementation checklist:
 *   - Accept roomId as a parameter
 *   - Get socket from useSocket()
 *   - Get dispatch from useDispatch()
 *   - Implement debounced emit on keydown
 *   - Listen for 'typing_update' in a useEffect; clean up on unmount
 *   - Emit 'typing_stop' immediately when a message is sent
 */

// Manages typing indicator socket events (US-303)
export function useTyping() {}
