/**
 * RoomItem — Single Room Row in the Sidebar (US-201, US-602)
 *
 * ─── PRESENTATIONAL vs. CONTAINER COMPONENTS ─────────────────────────────────
 * RoomItem is a "presentational" component — it only renders what it is given
 * through props. It has no data-fetching logic of its own.
 *
 * RoomList (the parent) is the "container" component — it fetches data and
 * passes it down. This separation means:
 *   • RoomItem is trivial to test: give it props, check the output.
 *   • If the data source changes, only RoomList needs updating, not RoomItem.
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────
 * room     — the room object from the API:
 *              { id, name, description, member_count, unread_count }
 *            unread_count is added by US-602. It is always a number (≥ 0).
 * isActive — whether this room is the currently selected one (from Redux)
 * onClick  — called when the user clicks the row (dispatches setActiveRoom)
 *
 * ─── UNREAD BADGE (US-602) ───────────────────────────────────────────────────
 * When room.unread_count > 0, a small red pill badge is rendered on the right
 * side of the room name row. The badge shows the numeric count.
 *
 * Badge behaviour:
 *   • Appears  — when useUnreadBadges (in Layout) receives a 'badge_update'
 *                event and patches the React Query rooms cache.
 *   • Clears   — when the user opens the room: useMessages emits 'join_room'
 *                and immediately zeros the count in the cache (optimistic).
 *
 * Layout of the row with the badge:
 *
 *   ┌────────────────────────────────────────┐
 *   │  # general                        [3]  │  ← nameRow (flex row, space-between)
 *   │  General discussion channel            │  ← description (optional)
 *   └────────────────────────────────────────┘
 *
 * Without a badge (unread_count === 0), the nameRow renders just the name:
 *
 *   ┌────────────────────────────────────────┐
 *   │  # general                             │
 *   │  General discussion channel            │
 *   └────────────────────────────────────────┘
 *
 * ─── WHY NOT USE CSS :after FOR THE BADGE ────────────────────────────────────
 * The project uses React inline styles throughout (no CSS classes). Inline
 * styles can't use pseudo-elements (:after). Rendering a <span> with inline
 * styles is the equivalent approach — same visual result, consistent pattern.
 *
 * ─── BADGE CAP AT 99 ─────────────────────────────────────────────────────────
 * Counts over 99 are displayed as "99+" to keep the badge compact. A 3-digit
 * number would stretch the badge and break the sidebar layout.
 * This is the same convention used by iOS, Slack, and most chat apps.
 */
export default function RoomItem({ room, isActive, onClick }) {
  // Derive the badge label from the unread count.
  // unread_count may be undefined on first render before the cache updates —
  // treat that as 0 so we never render a badge with "NaN" or "undefined".
  const unread = room.unread_count ?? 0;

  // Cap at 99 for compact display. 100 → "99+", 5 → "5".
  const badgeLabel = unread > 99 ? '99+' : String(unread);

  return (
    // Using a <button> instead of a <div> gives keyboard navigation and
    // screen-reader accessibility for free — clicking with Tab + Enter works.
    <button
      onClick={onClick}
      style={{ ...styles.item, ...(isActive ? styles.itemActive : {}) }}
      // aria-current tells screen readers which item is selected, equivalent
      // to the visual highlight
      aria-current={isActive ? 'true' : undefined}
    >
      {/*
       * ── Name row: room name on the left, badge on the right ───────────────
       *
       * display:'flex' + justifyContent:'space-between' pushes the badge to
       * the far right while the room name stays on the left.
       * width:'100%' ensures the row spans the full button width.
       */}
      <div style={styles.nameRow}>

        {/* The # prefix is a chat convention (like Slack/Discord channel names) */}
        <span style={styles.name}># {room.name}</span>

        {/*
         * ── Unread badge (US-602) ─────────────────────────────────────────
         *
         * Only rendered when there are unread messages (unread > 0).
         * React's conditional rendering (&&) means the <span> does not exist
         * in the DOM at all when the count is 0 — no empty space is left behind.
         *
         * aria-label gives screen readers a description of what the badge means.
         * The visual number alone isn't enough context for a screen reader user.
         *
         * Accessibility note: the badge is inside the <button>, so the full
         * button announcement includes the badge count. A screen reader will say
         * something like: "general, 3 unread messages, button".
         */}
        {unread > 0 && (
          <span
            style={styles.badge}
            aria-label={`${unread} unread message${unread === 1 ? '' : 's'}`}
          >
            {badgeLabel}
          </span>
        )}

      </div>

      {/* description is optional — only render the element when it exists (US-201 AC) */}
      {room.description && (
        <span style={styles.description}>{room.description}</span>
      )}
    </button>
  );
}

const styles = {
  item: {
    // Reset browser default button styles, then apply our own
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'flex-start',
    gap:           '2px',
    width:         '100%',
    padding:       '0.5rem 0.75rem',
    background:    'transparent',
    border:        'none',
    borderRadius:  '4px',
    cursor:        'pointer',
    textAlign:     'left',
    color:         '#c9cdd4',
    transition:    'background 0.1s',
  },

  itemActive: {
    background: 'rgba(255,255,255,0.15)',
    color:      '#fff',
  },

  // Flex row: name on the left, badge (if any) on the right.
  // width:'100%' makes it span the full button so space-between works correctly.
  nameRow: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    width:          '100%',
    gap:            '0.4rem',  // minimum gap between the name and badge
  },

  name: {
    fontSize:  '0.9rem',
    fontWeight: 500,
    // Allow long room names to truncate with an ellipsis rather than pushing
    // the badge off screen or wrapping to a second line.
    overflow:     'hidden',
    whiteSpace:   'nowrap',
    textOverflow: 'ellipsis',
    minWidth:     0, // needed for text-overflow to work inside a flex child
  },

  // ── Unread badge pill ────────────────────────────────────────────────────
  // A small red rounded pill showing the numeric count.
  // flexShrink:0 prevents it from being compressed when the room name is long.
  // minWidth ensures the pill is at least as wide as it is tall (circular for
  // single-digit counts, stretches for larger numbers).
  badge: {
    flexShrink:     0,
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    minWidth:       '18px',
    height:         '18px',
    padding:        '0 5px',
    borderRadius:   '9px',      // half of height → perfect pill / circle shape
    background:     '#e53e3e',  // red — universally understood as "attention needed"
    color:          '#fff',
    fontSize:       '0.68rem',
    fontWeight:     700,
    lineHeight:     1,
    // Override index.css's min-height: 44px rule for buttons.
    // The badge is a <span>, not a <button>, so index.css doesn't apply.
    // No override needed — this comment just clarifies the intent.
  },

  description: {
    fontSize:     '0.75rem',
    opacity:      0.7,
    // Clamp to one line with an ellipsis so long descriptions don't break layout
    overflow:     'hidden',
    whiteSpace:   'nowrap',
    textOverflow: 'ellipsis',
    width:        '100%',
  },
};
