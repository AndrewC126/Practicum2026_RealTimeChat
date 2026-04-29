/**
 * MessageInput — Chat Message Composer (US-301)
 *
 * The textarea at the bottom of ChatPanel where the user types and sends
 * messages. Handles local draft state, keyboard shortcuts, character limits,
 * and the optimistic update pattern so sent messages appear instantly.
 *
 * Props:
 *   roomId — the UUID of the room to send messages to
 *
 * ─── OPTIMISTIC UPDATE PATTERN ───────────────────────────────────────────────
 * US-301 AC: "The sent message appears in the chat immediately for the sender
 * without waiting for a server round-trip."
 *
 * A "round-trip" is the time for a message to travel: client → network →
 * server → network → client. Even on a local network this takes milliseconds,
 * and on a real network it can take 50–200ms. During that time, the user
 * wonders "did my message send?"
 *
 * The optimistic update pattern solves this:
 *
 *   Step 1 — User presses Enter.
 *   Step 2 — Immediately add a "pending" message to the React Query cache.
 *             This is the OPTIMISTIC message — it has a temporary ID
 *             (e.g., "temp-1715000000000") and the current timestamp.
 *             MessageList re-renders instantly and shows the message.
 *   Step 3 — In parallel, emit 'send_message' to the server.
 *             The server saves to DB, then calls ack({ ok: true, message: real }).
 *   Step 4a — On success: replace the temp message with the real one
 *             (the real one has the DB-generated id and authoritative created_at).
 *   Step 4b — On failure: remove the temp message and show an error.
 *
 * ─── WHY REPLACE INSTEAD OF JUST REMOVE? ─────────────────────────────────────
 * The ack returns the real saved message from the DB. We REPLACE the temp
 * message with it (matching on the temp id) so that:
 *   - The message id changes from "temp-…" to the real UUID (important if
 *     the user tries to quote or interact with the message later)
 *   - The created_at changes from the client timestamp to the DB's timestamp
 *     (which is the authoritative value for sorting)
 *   - The visual position of the message stays stable — no flicker
 *
 * ─── TEXTAREA vs INPUT ────────────────────────────────────────────────────────
 * We use <textarea> instead of <input type="text"> because:
 *   - textarea supports Shift+Enter to insert a newline
 *   - textarea can grow vertically for multi-line messages
 *   - <input> has no newline support at all
 *
 * We listen for keyDown events on the textarea:
 *   - Enter (without Shift) → submit (prevent the default newline insertion)
 *   - Shift+Enter → do nothing (let the browser insert a newline)
 *
 * ─── CHARACTER COUNT ──────────────────────────────────────────────────────────
 * The DB enforces a 1,000-character limit via a CHECK constraint. We mirror
 * this on the client so users get feedback before the server rejects the message:
 *   - Show "N / 1000" counter when draft.length > 800 (approaching the limit)
 *   - Turn the counter red when draft.length > 1000 (over the limit)
 *   - Disable the Send button when over the limit or when the draft is empty
 *
 * ─── useRef FOR TEXTAREA FOCUS ────────────────────────────────────────────────
 * After sending, we call textareaRef.current.focus() to return keyboard focus
 * to the textarea so the user can immediately type their next message without
 * clicking. useRef gives us direct DOM access without causing re-renders.
 *
 * ─── onKeyDown PROP (future US-303) ──────────────────────────────────────────
 * The stub mentioned an `onKeyDown` prop for the typing indicator (US-303).
 * We accept it as an optional prop and call it on every keystroke. When
 * US-303 is implemented, ChatPanel will pass the debounced typing handler here
 * without any changes to MessageInput itself.
 */
import { useState, useRef }    from 'react';
import { useSelector }         from 'react-redux';
import { useQueryClient }      from '@tanstack/react-query';
import { useSocket }           from '../../../shared/hooks/useSocket';

const MAX_LENGTH = 1000;
const WARN_AT    = 800;  // start showing the counter at this many chars

export default function MessageInput({ roomId, onKeyDown, onAfterSend }) {
  // draft holds whatever the user has typed so far.
  const [draft,    setDraft]    = useState('');
  // sendError is shown briefly if the server rejects the message.
  const [sendError, setSendError] = useState('');

  const socket      = useSocket();
  const queryClient = useQueryClient();

  // The current user — used to build the optimistic message.
  // After a page refresh, user is null (token is restored but user object
  // isn't). We fall back to empty strings; the ack will supply the real values.
  const currentUser = useSelector(state => state.auth.user);

  // textareaRef lets us call .focus() programmatically after sending.
  const textareaRef = useRef(null);

  // ── Derived state ──────────────────────────────────────────────────────────
  const trimmed    = draft.trim();
  const overLimit  = draft.length > MAX_LENGTH;
  const nearLimit  = draft.length > WARN_AT;
  // The send button is disabled when: nothing typed, over the limit, or
  // no socket connection (very rare — only if the user isn't authenticated).
  const canSend    = trimmed.length > 0 && !overLimit && !!socket;

  // ── handleSubmit ───────────────────────────────────────────────────────────
  function handleSubmit() {
    if (!canSend) return; // guard: do nothing on empty / over-limit / no socket

    const body = trimmed;

    // ── Step 1: Clear the input immediately (feels instant to the user) ────
    setDraft('');
    setSendError('');

    // Immediately emit typing_stop so the "Alice is typing…" indicator clears
    // for other users the moment the message is sent (US-303 AC).
    // onAfterSend is the stopTyping function from useTyping, passed in by
    // ChatPanel via the onAfterSend prop. The ?. means this is a safe no-op
    // if ChatPanel doesn't provide the prop (e.g., in a test or isolated render).
    onAfterSend?.();

    // ── Step 2: Build and add an optimistic message to the cache ──────────
    // This appears in MessageList RIGHT NOW, before the server responds.
    //
    // `Date.now()` generates a timestamp used as a temporary ID.
    // The "temp-" prefix distinguishes it from real UUID ids so we can find
    // and replace it once the ack arrives.
    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      id:                tempId,
      room_id:           roomId,
      sender_id:         currentUser?.id   ?? null,
      sender_username:   currentUser?.username ?? '',
      body,
      is_system_message: false,
      // Use local time for now; the ack will give us the server's created_at.
      created_at:        new Date().toISOString(),
    };

    // setQueryData updates the React Query cache synchronously.
    // Any component subscribed to ['messages', roomId] re-renders immediately.
    queryClient.setQueryData(['messages', roomId], prev =>
      [...(prev ?? []), optimisticMessage]
    );

    // ── Step 3: Emit to the server with an acknowledgment callback ─────────
    // The server saves the message, broadcasts it to OTHER users, then calls
    // ack({ ok: true, message: savedMessage }).
    socket.emit('send_message', { roomId, body }, (response) => {
      if (response?.ok) {
        // ── Step 4a: Replace temp message with the real saved message ──────
        // Map over the cache: swap the temp entry for the DB-authoritative one.
        // response.message has the real UUID id and PostgreSQL created_at.
        queryClient.setQueryData(['messages', roomId], prev =>
          (prev ?? []).map(m => m.id === tempId ? response.message : m)
        );
      } else {
        // ── Step 4b: Remove the optimistic message and show an error ───────
        queryClient.setQueryData(['messages', roomId], prev =>
          (prev ?? []).filter(m => m.id !== tempId)
        );
        setSendError(response?.message ?? 'Failed to send. Try again.');
      }
    });

    // Return focus to the textarea so the user can type immediately.
    textareaRef.current?.focus();
  }

  // ── handleKeyDown ──────────────────────────────────────────────────────────
  function handleKeyDown(e) {
    // Call the optional typing indicator handler (US-303 will provide it).
    // Calling it with every keydown event lets the server know the user is typing.
    onKeyDown?.(e); // ?. safely does nothing if onKeyDown is undefined

    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter alone → submit. Prevent the browser from inserting a newline
      // in the textarea before we clear the draft.
      e.preventDefault();
      handleSubmit();
    }
    // Shift+Enter → do nothing here; the browser inserts a newline normally.
  }

  return (
    <div style={styles.wrapper}>

      {/* ── Error banner (shown briefly after a failed send) ── */}
      {sendError && (
        <div style={styles.errorBanner}>
          {sendError}
          {/* Dismiss button */}
          <button
            onClick={() => setSendError('')}
            style={styles.dismissBtn}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Character count warning ── */}
      {/*
       * Only shown when the user has typed more than WARN_AT (800) characters.
       * Color turns red when over the 1000-char limit — matching the disabled
       * state of the Send button, so both signals point to the same problem.
       */}
      {nearLimit && (
        <div style={{
          ...styles.charCount,
          color: overLimit ? '#ef4444' : '#9ca3af',  // red when over, gray when near
        }}>
          {draft.length} / {MAX_LENGTH}
          {overLimit && ' — message too long'}
        </div>
      )}

      {/* ── Input row: textarea + send button ── */}
      <div style={styles.inputRow}>

        {/*
         * <textarea> instead of <input> so that Shift+Enter can insert newlines.
         * rows={1} starts it at one line tall; it can grow with content if you
         * add CSS resize handling (not needed for this milestone).
         *
         * placeholder disappears when the user starts typing.
         * aria-label provides an accessible label (no visible <label> element
         * because the placeholder serves that purpose visually).
         */}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Shift+Enter for new line)"
          rows={1}
          aria-label="Message input"
          style={{
            ...styles.textarea,
            // Visual feedback when over the limit: red border
            borderColor: overLimit ? '#ef4444' : '#d1d5db',
          }}
        />

        {/*
         * Send button
         * disabled when canSend is false — this covers three cases:
         *   1. Draft is empty (nothing to send)
         *   2. Draft is over 1000 chars (would be rejected by the server)
         *   3. No socket connection (can't emit)
         *
         * The opacity change gives a visual "disabled" cue even if the
         * browser's default disabled styling is subtle.
         */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          style={{
            ...styles.sendButton,
            opacity: canSend ? 1 : 0.45,
            cursor:  canSend ? 'pointer' : 'not-allowed',
          }}
          aria-label="Send message"
        >
          Send
        </button>

      </div>
    </div>
  );
}

// ─── Style objects ────────────────────────────────────────────────────────────
const styles = {
  // Outer wrapper — sits below MessageList in the ChatPanel flex column.
  // flexShrink: 0 prevents it from being squeezed by the message list.
  wrapper: {
    flexShrink:   0,
    padding:      '0.75rem 1rem',
    borderTop:    '1px solid #e5e7eb',
    background:   '#ffffff',
    display:      'flex',
    flexDirection:'column',
    gap:          '0.4rem',
  },

  // Error banner — red strip above the input when a send fails
  errorBanner: {
    background:   '#fef2f2',
    color:        '#b91c1c',
    border:       '1px solid #fca5a5',
    borderRadius: '4px',
    padding:      '0.35rem 0.75rem',
    fontSize:     '0.8rem',
    display:      'flex',
    justifyContent: 'space-between',
    alignItems:   'center',
  },

  dismissBtn: {
    background: 'none',
    border:     'none',
    color:      '#b91c1c',
    cursor:     'pointer',
    fontSize:   '0.8rem',
    padding:    '0 0.25rem',
  },

  // Character count — appears near the limit
  charCount: {
    fontSize:  '0.75rem',
    textAlign: 'right',
  },

  // Row containing the textarea and the send button side-by-side
  inputRow: {
    display: 'flex',
    gap:     '0.5rem',
    alignItems: 'flex-end',  // align button to bottom when textarea grows taller
  },

  textarea: {
    flex:        1,           // fill remaining width
    padding:     '0.5rem 0.75rem',
    border:      '1px solid #d1d5db',
    borderRadius:'6px',
    fontSize:    '0.9rem',
    resize:      'none',      // disable manual resize handle (cleaner look)
    fontFamily:  'inherit',   // match the app font, not monospace
    lineHeight:  '1.5',
    outline:     'none',
    // Smooth border color transition when the limit is exceeded
    transition:  'border-color 0.15s',
  },

  sendButton: {
    padding:      '0.5rem 1.1rem',
    background:   '#3b82f6',    // blue-500
    color:        '#ffffff',
    border:       'none',
    borderRadius: '6px',
    fontSize:     '0.9rem',
    fontWeight:   600,
    transition:   'opacity 0.15s',
    // height and flexShrink prevent the button from stretching with the textarea
    alignSelf:    'flex-end',
  },
};
