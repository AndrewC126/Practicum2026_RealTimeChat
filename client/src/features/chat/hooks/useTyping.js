/**
 * useTyping — Typing Indicator Logic (US-303)
 *
 * Manages the full lifecycle of the typing indicator for one room:
 *   • Sending: debounced 'typing_start' / 'typing_stop' events to the server
 *   • Receiving: listening for 'typing_update' from other users, dispatching
 *     to Redux so TypingIndicator can read the list
 *
 * Returns:
 *   { onKeyDown, stopTyping }
 *
 *   onKeyDown  — attach to MessageInput's onKeyDown prop. Called on every
 *                keystroke; handles emitting typing_start and resetting the
 *                debounce timer.
 *   stopTyping — call from MessageInput's handleSubmit so clicking Send (not
 *                just pressing Enter) also clears the indicator immediately.
 *
 * ─── DEBOUNCE PATTERN ────────────────────────────────────────────────────────
 * "Debounce" means: wait until activity has paused for N milliseconds before
 * triggering an action. Here, we debounce the "stopped typing" signal:
 *
 *   Every keystroke:
 *     1. If not already marked as typing → emit 'typing_start' once
 *     2. Clear any existing stop timer
 *     3. Start a new 3-second timer that emits 'typing_stop' if no key is
 *        pressed before it fires
 *
 *   If the user types continuously: the timer keeps resetting, so 'typing_stop'
 *   is never sent. The indicator stays visible.
 *
 *   If the user pauses for 3 seconds: the timer fires and sends 'typing_stop'.
 *   The indicator disappears for everyone else.
 *
 *   If the user sends a message: stopTyping() is called immediately (no wait).
 *
 * ─── WHY A REF FOR THE TIMER, NOT STATE ──────────────────────────────────────
 * setTimeout() returns an integer ID that we need to pass to clearTimeout().
 * We store this ID in a ref (stopTimerRef.current) rather than state because:
 *   • Changing .current never triggers a re-render — we don't need a render
 *     just because the timer ID changed
 *   • State updates inside event handlers can be batched by React in ways that
 *     could cause the old timer ID to be lost before clearTimeout() is called
 *   • Refs give us direct, synchronous access to the latest value
 *
 * Similarly, isTypingRef tracks whether we've already emitted 'typing_start'.
 * We use a ref so we can read/write it synchronously in onKeyDown without
 * triggering re-renders on every keystroke.
 *
 * ─── EFFECT CLEANUP AND ROOM SWITCHING ───────────────────────────────────────
 * useEffect with [socket, roomId, dispatch] as dependencies runs:
 *   • On mount: attach the 'typing_update' listener
 *   • When roomId changes: cleanup runs (emit typing_stop for OLD room, remove
 *     listener), then the new effect runs (attach listener for NEW room)
 *   • On unmount: cleanup runs (emit typing_stop, remove listener)
 *
 * This ensures:
 *   1. Switching rooms while typing clears the old room's indicator immediately
 *   2. We never accumulate duplicate event listeners
 *   3. We never leak timers
 *
 * ─── WHY NOT EMIT ON EVERY KEYSTROKE ─────────────────────────────────────────
 * If we emitted 'typing_start' on every single keystroke, a fast typist could
 * send hundreds of socket events per minute. Each event is a network round-trip.
 * Instead we use isTypingRef to emit ONCE when typing begins, then reset it
 * only when typing stops (after the 3-second debounce or on send). This means
 * we emit at most 2 events per "typing session": start and stop.
 */
import { useEffect, useRef } from 'react';
import { useDispatch }       from 'react-redux';
import { useSocket }         from '../../../shared/hooks/useSocket';
import { setTyping }         from '../chatSlice';

// AC: "The indicator disappears when the user stops typing for 3 seconds"
const STOP_DELAY_MS = 3000;

export function useTyping(roomId) {
  const socket   = useSocket();
  const dispatch = useDispatch();

  // Holds the ID returned by setTimeout so we can cancel it with clearTimeout.
  // A ref because we mutate it frequently inside event handlers without needing
  // a re-render.
  const stopTimerRef = useRef(null);

  // Tracks whether we have already emitted 'typing_start' for the current
  // typing session. Reset to false when typing stops or the user sends.
  // A ref so reads/writes are synchronous and don't cause re-renders.
  const isTypingRef = useRef(false);

  // ── Receive typing events from other users ──────────────────────────────────
  // This effect wires up the socket listener and also handles cleanup when the
  // room changes or the component unmounts. Combining both concerns in one
  // effect (with [socket, roomId] as deps) ensures the order is always:
  //   old room cleanup → new room setup
  useEffect(() => {
    if (!socket || !roomId) return;

    // Handler: called when another user in this room emits typing_start/stop.
    // The server relays their event as 'typing_update' to everyone EXCEPT them,
    // so this function is never called for the current user's own keystrokes.
    function onTypingUpdate({ username, isTyping }) {
      // Dispatch to Redux → TypingIndicator re-renders automatically.
      dispatch(setTyping({ roomId, username, isTyping }));
    }

    socket.on('typing_update', onTypingUpdate);

    // Cleanup: runs when roomId changes (user switches rooms) or on unmount.
    return () => {
      // Remove our specific handler. Passing the function reference to .off()
      // ensures only this listener is removed, not any others on 'typing_update'.
      socket.off('typing_update', onTypingUpdate);

      // If the user was typing when they switched rooms or the component unmounted,
      // immediately emit typing_stop so the indicator clears for other users.
      // We also cancel any pending debounce timer since it's no longer needed.
      clearTimeout(stopTimerRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        // Use roomId from the closure — this is the OLD roomId at cleanup time,
        // which is exactly what we want (stop the OLD room's indicator).
        socket.emit('typing_stop', { roomId });
      }
    };
  }, [socket, roomId, dispatch]);
  // Re-runs when socket reconnects, when the user switches rooms, or when
  // dispatch changes (dispatch is stable in practice, but ESLint requires it).

  // ── stopTyping — emit typing_stop immediately ───────────────────────────────
  // Called by MessageInput's handleSubmit so clicking Send (not just Enter)
  // also stops the indicator right away, without waiting for the 3-second timer.
  //
  // Defined as a standalone function (not inside useEffect) so it can be
  // returned from this hook and called by ChatPanel / MessageInput.
  function stopTyping() {
    clearTimeout(stopTimerRef.current);
    if (isTypingRef.current && socket && roomId) {
      isTypingRef.current = false;
      socket.emit('typing_stop', { roomId });
    }
  }

  // ── onKeyDown — debounced typing detection ──────────────────────────────────
  // Returned from the hook and passed to MessageInput's onKeyDown prop.
  // Called on every keydown event in the textarea.
  function onKeyDown(e) {
    // If there's no socket or no room, do nothing.
    if (!socket || !roomId) return;

    // If the user presses Enter (the send shortcut), stop typing immediately.
    // handleSubmit will also call stopTyping() via the onAfterSend prop, but
    // handling it here too ensures Enter-sends always clear the indicator even
    // if the message is empty (canSend === false, so handleSubmit returns early
    // without calling onAfterSend).
    if (e.key === 'Enter' && !e.shiftKey) {
      stopTyping();
      return;
    }

    // ── Emit typing_start once per typing session ──────────────────────────
    // Only emit if we haven't already told the server we're typing.
    // This prevents flooding the server with duplicate events.
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing_start', { roomId });
    }

    // ── Reset the 3-second debounce timer ─────────────────────────────────
    // clearTimeout(null) and clearTimeout(undefined) are safe no-ops in the browser,
    // so this is always safe to call regardless of the timer's current state.
    clearTimeout(stopTimerRef.current);

    // Start a new timer. If no more keydowns arrive within 3 seconds, it fires
    // and emits typing_stop — clearing the indicator for other users.
    stopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit('typing_stop', { roomId });
    }, STOP_DELAY_MS);
  }

  return { onKeyDown, stopTyping };
}
