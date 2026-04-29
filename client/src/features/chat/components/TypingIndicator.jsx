/**
 * TypingIndicator — "Alice is typing…" Display (US-303)
 *
 * A small bar that appears between the message list and the input box when
 * one or more people in the room are typing. Reads typing state from Redux
 * (populated by useTyping's 'typing_update' socket listener).
 *
 * Props:
 *   roomId — used to look up the correct typing list in Redux state
 *
 * ─── DISPLAY LOGIC ───────────────────────────────────────────────────────────
 * 0 users typing   → render null (the bar takes no space at all)
 * 1 user typing    → "Alice is typing…"
 * 2 users typing   → "Alice and Bob are typing…"
 * 3+ users typing  → "Several people are typing…"
 *
 * This mirrors how Slack and Discord handle the indicator.
 *
 * ─── WHY NO CURRENT-USER FILTER HERE ────────────────────────────────────────
 * The server uses socket.to(roomId) when broadcasting 'typing_update', which
 * EXCLUDES the emitting socket. So the current user's own username is never
 * added to typingUsers[roomId] in Redux — they simply never receive their own
 * typing events.
 *
 * However, if the same user has two browser tabs open in the same room and
 * types in tab 1, tab 2 would receive the typing_update and could show the
 * indicator. To guard against this edge case we filter out the current user's
 * username before rendering.
 *
 * ─── THE ANIMATED DOTS ───────────────────────────────────────────────────────
 * We render three <span> elements styled as dots and animate them with a CSS
 * keyframe. Since we are using plain JavaScript style objects (no CSS file),
 * we inject the @keyframes rule using a <style> tag inside the component.
 *
 * React renders <style> tags like any other element — they end up in the
 * document's <head> (or wherever React mounts inline styles). This is a common
 * pattern when you need keyframe animations without a dedicated CSS file.
 *
 * The animation: each dot bounces up sequentially using `animation-delay`,
 * creating the classic "bouncing dots" typing indicator.
 *
 * ─── CONDITIONAL RENDERING WITH null ─────────────────────────────────────────
 * When a React component returns null, React renders nothing and the component
 * takes up zero space in the DOM. This is different from returning an empty
 * <div> which would still occupy space and potentially affect layout.
 * Returning null is the idiomatic way to conditionally render nothing.
 */
import { useSelector } from 'react-redux';
import { selectTypingUsers } from '../chatSlice';

// CSS keyframe animation injected as a <style> tag.
// @keyframes defines a named animation sequence:
//   0%    → translateY(0)    — dot at rest position
//   30%   → translateY(-5px) — dot bounces up 5 pixels
//   60%   → translateY(0)    — dot returns to rest
//   100%  → translateY(0)    — stays at rest until next cycle
//
// Each dot has a different animation-delay so they bounce one after another
// rather than all at once, creating the cascading "wave" effect.
const ANIMATION_CSS = `
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30%            { transform: translateY(-4px); opacity: 1; }
}
`;

export default function TypingIndicator({ roomId }) {
  // Read the current user's username to filter out our own name (multi-tab guard).
  const currentUsername = useSelector(state => state.auth.user?.username);

  // selectTypingUsers(roomId) is a selector factory defined in chatSlice:
  //   (roomId) => (state) => state.chat.typingUsers[roomId] ?? []
  // useSelector calls the inner function with the Redux state.
  // The result is an array of usernames currently typing in this room.
  const allTypingUsers = useSelector(selectTypingUsers(roomId));

  // Filter out the current user — guards against the multi-tab edge case
  // where our own typing events loop back via a second tab.
  const typingUsers = currentUsername
    ? allTypingUsers.filter(u => u !== currentUsername)
    : allTypingUsers;

  // ── Return null when no one (else) is typing ─────────────────────────────
  // This is critical: returning null means the component takes ZERO vertical
  // space. If we returned an empty <div>, it would add padding/height to the
  // layout even when nothing is shown, pushing the message input down.
  if (typingUsers.length === 0) return null;

  // ── Build the display text based on how many people are typing ────────────
  let label;
  if (typingUsers.length === 1) {
    // AC: "Alice is typing…"
    label = `${typingUsers[0]} is typing`;
  } else if (typingUsers.length === 2) {
    // AC: "Alex and Jordan are typing…"
    label = `${typingUsers[0]} and ${typingUsers[1]} are typing`;
  } else {
    // AC: "Several people are typing…" for 3+
    label = 'Several people are typing';
  }

  return (
    <>
      {/*
       * Inject the @keyframes CSS once. React deduplicates identical <style>
       * tags in practice, but even if it renders multiple times the browser
       * simply overwrites the same named animation — no visual side effect.
       */}
      <style>{ANIMATION_CSS}</style>

      <div style={styles.container}>

        {/* ── Bouncing dots ── */}
        {/*
         * Three dots, each delayed by 0.15s relative to the previous one.
         * The delay creates the cascading bounce effect:
         *   dot 1 bounces at t=0ms, t=750ms, t=1500ms…
         *   dot 2 bounces at t=150ms, t=900ms…
         *   dot 3 bounces at t=300ms, t=1050ms…
         *
         * We use inline style objects and spread in a dynamic animationDelay
         * rather than separate CSS classes, to stay consistent with the rest
         * of the codebase's inline-style approach.
         */}
        <span style={styles.dotsWrapper} aria-hidden="true">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              style={{
                ...styles.dot,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </span>

        {/* ── Text label ── */}
        {/*
         * The text sits to the right of the dots.
         * aria-live="polite" tells screen readers to announce this text when
         * it changes — without interrupting the user if they're currently
         * hearing something else. This makes the feature accessible.
         */}
        <span style={styles.text} aria-live="polite">
          {label}…
        </span>

      </div>
    </>
  );
}

// ─── Style objects ────────────────────────────────────────────────────────────
const styles = {
  // Outer row — sits between MessageList and MessageInput in the ChatPanel
  // flex column. flexShrink: 0 prevents it from being compressed.
  // minHeight: 0 allows it to collapse to nothing when null is returned.
  container: {
    display:     'flex',
    alignItems:  'center',
    gap:         '0.4rem',
    padding:     '0.2rem 1.25rem 0.35rem',
    flexShrink:  0,
    background:  '#ffffff',
  },

  // Wrapper for the three dots — inline-flex so dots sit side by side
  dotsWrapper: {
    display:    'inline-flex',
    alignItems: 'flex-end',
    gap:        '3px',
    height:     '16px',
  },

  // Each individual dot
  dot: {
    display:         'inline-block',
    width:           '5px',
    height:          '5px',
    borderRadius:    '50%',
    background:      '#6b7280',      // gray-500
    // animation: name | duration | timing | repeat
    // 0.75s per full bounce cycle, ease-in-out for a natural feel, infinite loop
    animation:       'typing-bounce 0.75s ease-in-out infinite',
    animationFillMode: 'both',
  },

  // The "Alice is typing…" text
  text: {
    fontSize:  '0.75rem',
    color:     '#6b7280',  // gray-500 — subtle, doesn't compete with messages
    fontStyle: 'italic',
  },
};
