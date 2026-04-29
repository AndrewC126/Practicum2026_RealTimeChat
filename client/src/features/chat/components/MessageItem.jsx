/**
 * MessageItem — Single Message Row (US-203)
 *
 * Renders one row in the chat feed. There are three distinct visual variants:
 *
 *   1. System message  (message.is_system_message === true)
 *        e.g. "Alex has joined the room"
 *        → Centered, small, gray, italic. No bubble, no username.
 *        → These are created by the server's join_room socket handler and
 *          arrive via the 'new_message' socket event like any other message.
 *
 *   2. Own message  (message.sender_id === the current user's id)
 *        → Right-aligned blue bubble. No username shown — you know it's yours.
 *
 *   3. Other user's message
 *        → Left-aligned gray bubble with the sender's username shown above.
 *
 * Props:
 *   message   — object from the API / React Query cache:
 *               { id, room_id, sender_id, sender_username, body,
 *                 is_system_message, created_at }
 *   isOwn     — boolean, true when message.sender_id === logged-in user's id.
 *               Computed by MessageList and passed in as a prop so this
 *               component stays "dumb" (pure presentation, no Redux reads).
 *   isGrouped — boolean, true when this message immediately follows another
 *               from the same sender. (Currently unused — just accepted so
 *               the prop doesn't cause a React warning when MessageList
 *               passes it in; visual grouping can be added later.)
 *
 * ─── TIMESTAMP FORMATTING ────────────────────────────────────────────────────
 * created_at arrives from PostgreSQL as an ISO 8601 string, e.g.:
 *   "2025-04-29T14:32:00.000Z"
 *
 * We parse it with new Date() and format it with toLocaleTimeString():
 *   new Date("2025-04-29T14:32:00.000Z").toLocaleTimeString([], {
 *     hour: '2-digit', minute: '2-digit'
 *   })
 *   → "2:32 PM"  (exact format depends on the user's browser locale)
 *
 * toLocaleTimeString() is built into the browser — no extra library needed.
 * The [] first argument means "use the browser's default locale."
 *
 * ─── INLINE STYLES ───────────────────────────────────────────────────────────
 * React accepts a plain JavaScript object for the `style` prop. Property names
 * must be camelCase (backgroundColor, not background-color) because they map
 * directly to the DOM element's .style object. We define the style objects at
 * the bottom of the file so the JSX above stays readable.
 *
 * ─── SPREAD MERGE PATTERN ────────────────────────────────────────────────────
 * Some elements need a base style plus one conditional tweak. We merge them
 * with the object spread operator:
 *   { ...styles.row, justifyContent: isOwn ? 'flex-end' : 'flex-start' }
 * This creates a new object with all keys from styles.row, then overrides
 * justifyContent. The original styles.row object is never mutated.
 */

export default function MessageItem({ message, isOwn, isGrouped }) {
  // Parse the ISO timestamp and format it as "2:32 PM".
  // The [] locale argument tells the browser to use its default locale.
  // { hour: '2-digit', minute: '2-digit' } requests just hours and minutes.
  const time = new Date(message.created_at).toLocaleTimeString([], {
    hour:   '2-digit',
    minute: '2-digit',
  });

  // ── Variant 1: System message ─────────────────────────────────────────────
  // Return early so we don't render the normal bubble markup at all.
  if (message.is_system_message) {
    return (
      <div style={styles.system}>
        {message.body} · {time}
      </div>
    );
  }

  // ── Variant 2 & 3: Normal message ─────────────────────────────────────────
  return (
    // The outer row is a flex container.
    // justifyContent: 'flex-end'   → pushes the bubble to the RIGHT (own)
    // justifyContent: 'flex-start' → keeps the bubble on the LEFT (others)
    <div style={{ ...styles.row, justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>

      {/* Constrain bubble width so long messages don't span the full panel */}
      <div style={{ maxWidth: '70%' }}>

        {/* Username label — only shown for other people's messages.
            Your own messages don't need it; you know who you are. */}
        {!isOwn && (
          <div style={styles.username}>{message.sender_username}</div>
        )}

        {/* The colored bubble. isOwn picks between two different style objects. */}
        <div style={isOwn ? styles.ownBubble : styles.otherBubble}>
          {message.body}
        </div>

        {/* Timestamp sits below the bubble, aligned to the same side. */}
        <div style={{ ...styles.time, textAlign: isOwn ? 'right' : 'left' }}>
          {time}
        </div>

      </div>
    </div>
  );
}

// ─── Style objects ────────────────────────────────────────────────────────────
// Defined as module-level constants so they are created once (not on every
// render). These are plain objects — React converts them to inline CSS.

const styles = {
  // ── System message: centered, muted, italic ────────────────────────────────
  system: {
    textAlign:  'center',
    fontSize:   '0.75rem',
    color:      '#9ca3af',   // Tailwind gray-400
    fontStyle:  'italic',
    margin:     '0.5rem 0',
    padding:    '0 1rem',
  },

  // ── Row: a flex container that controls LEFT/RIGHT alignment ──────────────
  // justifyContent is merged in at render time (see the spread pattern above)
  row: {
    display:      'flex',
    marginBottom: '0.25rem',
    padding:      '0 1rem',
  },

  // ── Sender's username (shown only for other people) ───────────────────────
  username: {
    fontSize:     '0.75rem',
    fontWeight:   600,
    color:        '#374151',   // gray-700
    marginBottom: '0.2rem',
    paddingLeft:  '0.5rem',
  },

  // ── Own message bubble: blue, right-side pointer ──────────────────────────
  // Border-radius trick: 1rem on three corners, 0.25rem on the bottom-right
  // creates a "tail" pointing toward the sender (right side).
  ownBubble: {
    background:   '#3b82f6',                  // Tailwind blue-500
    color:        '#ffffff',
    borderRadius: '1rem 1rem 0.25rem 1rem',   // tail: bottom-right
    padding:      '0.5rem 0.75rem',
    wordBreak:    'break-word',               // wrap long words instead of overflow
  },

  // ── Other user's bubble: gray, left-side pointer ─────────────────────────
  otherBubble: {
    background:   '#e5e7eb',                  // Tailwind gray-200
    color:        '#111827',                  // gray-900
    borderRadius: '1rem 1rem 1rem 0.25rem',   // tail: bottom-left
    padding:      '0.5rem 0.75rem',
    wordBreak:    'break-word',
  },

  // ── Timestamp below the bubble ────────────────────────────────────────────
  // textAlign is merged in at render time so it matches the bubble side.
  time: {
    fontSize:  '0.65rem',
    color:     '#9ca3af',   // gray-400
    marginTop: '0.2rem',
    padding:   '0 0.25rem',
  },
};
