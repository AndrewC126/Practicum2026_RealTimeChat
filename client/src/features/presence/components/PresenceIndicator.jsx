/**
 * PresenceIndicator — Avatar with Online/Offline Status Dot (US-401, US-402)
 *
 * A purely presentational ("dumb") component — it only renders what is given
 * to it through props. No data fetching, no Redux reads, no side effects.
 * All the interesting logic (who is online? which room?) lives in MemberList.
 *
 * Visual layout:
 *
 *   ┌───────────────────────────────────────────┐
 *   │  ┌─────┐                                 │
 *   │  │  A  │●  alice                         │   ← online (green dot)
 *   │  └─────┘                                 │
 *   │  ┌─────┐                                 │
 *   │  │  B  │○  bob                           │   ← offline (gray dot)
 *   │  └─────┘                                 │
 *   └───────────────────────────────────────────┘
 *
 *   Avatar:  36×36px circle with the user's first initial, background color
 *            derived deterministically from their username (same color every time).
 *   Dot:     8×8px circle overlaid at the bottom-right of the avatar.
 *            Green (#44b700) = online, Gray (#bdbdbd) = offline.
 *   Username: displayed to the right of the avatar.
 *
 * ─── POSITIONING THE DOT ─────────────────────────────────────────────────────
 * The dot sits on top of the avatar's bottom-right corner. To achieve this:
 *
 *   1. The avatar WRAPPER div has position: 'relative'.
 *      This makes the wrapper the "containing block" for any absolutely-
 *      positioned children — the dot will be positioned relative to the
 *      wrapper, not the page.
 *
 *   2. The dot <span> has position: 'absolute', bottom: '-1px', right: '-1px'.
 *      Absolute positioning takes the element OUT of the normal document flow
 *      (it doesn't push other elements around). bottom/right move it from the
 *      wrapper's edges inward — negative values let it slightly overflow.
 *
 * ─── DETERMINISTIC AVATAR COLOR ──────────────────────────────────────────────
 * We want each user to have a consistent avatar color — the same color every
 * time their name appears, in any component, without storing anything.
 *
 * Algorithm:
 *   1. Sum the Unicode code points of every character in the username.
 *      ("alice" → 97 + 108 + 105 + 99 + 101 = 510)
 *   2. Take the result modulo the palette length to get an index.
 *      (510 % 8 = 6 → index 6 in the palette)
 *   3. Use that palette color as the avatar background.
 *
 * This is the same algorithm used in InviteModal's avatarColour() function —
 * if you use both, a user's color will be consistent across both components.
 *
 * ─── PROPS ────────────────────────────────────────────────────────────────────
 * user     — { id: string, username: string }
 * isOnline — boolean
 * onClick  — optional click handler (used by MemberList to open profile card)
 */

// Colors to pick from for avatar backgrounds.
// 8 colors gives good visual variety without too many similar shades.
const AVATAR_COLORS = [
  '#1976d2', // blue
  '#388e3c', // green
  '#f57c00', // orange
  '#7b1fa2', // purple
  '#c62828', // red
  '#00838f', // teal
  '#558b2f', // olive
  '#ad1457', // pink
];

/**
 * avatarColor — pick a background color from the palette deterministically.
 * Same username always produces the same color index.
 */
function avatarColor(username) {
  let sum = 0;
  for (let i = 0; i < username.length; i++) {
    // charCodeAt(i) returns the numeric Unicode value of the character at position i.
    // Summing all characters gives a number that varies predictably per username.
    sum += username.charCodeAt(i);
  }
  // % AVATAR_COLORS.length wraps the sum into [0, length - 1]
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export default function PresenceIndicator({ user, isOnline, onClick }) {
  return (
    /*
     * Outer row: avatar + username side by side.
     * cursor: onClick is a click handler — show a pointer cursor so the user
     * knows the row is clickable. If onClick is not provided, use default.
     */
    <div
      style={{ ...styles.row, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      // aria-label gives screen readers context about the presence status —
      // the color dot alone conveys nothing to someone using assistive technology.
      aria-label={`${user.username} is ${isOnline ? 'online' : 'offline'}`}
    >

      {/*
       * Avatar wrapper — position: 'relative' so the absolutely-positioned
       * dot is anchored to this element, not the page.
       */}
      <div style={styles.avatarWrapper}>

        {/* Colored circle with the first letter of the username */}
        <div
          style={{
            ...styles.avatar,
            // Override the background color with the deterministic palette choice
            background: avatarColor(user.username),
          }}
        >
          {/* toUpperCase() so "alice" → "A" */}
          {user.username[0].toUpperCase()}
        </div>

        {/*
         * Presence dot — the small circle at the bottom-right of the avatar.
         *
         * position: 'absolute' removes it from the flow. bottom/right values
         * overlap with the avatar's corner; the white border creates a small
         * gap so the dot is visually distinct from the avatar background.
         *
         * border: '2px solid #2c3e50' — matches the Sidebar background color
         * so the dot appears to "float" just outside the avatar circle.
         */}
        <span
          style={{
            ...styles.dot,
            // Ternary: green for online, gray for offline
            background: isOnline ? '#44b700' : '#bdbdbd',
          }}
          // Hide from screen readers — the aria-label on the outer div already
          // communicates the same information.
          aria-hidden="true"
        />

      </div>

      {/* Username to the right of the avatar */}
      <span style={styles.username}>{user.username}</span>

    </div>
  );
}

const styles = {
  // Flex row: avatar on the left, username on the right
  row: {
    display:    'flex',
    alignItems: 'center',
    gap:        '0.6rem',
    padding:    '0.3rem 0.75rem',
    borderRadius: '4px',
    // Hover highlight is handled inline in MemberList because hover state
    // requires local state or CSS (which we avoid here — the project uses inline styles)
  },

  // Wraps both the avatar circle and the dot.
  // position: 'relative' is the KEY property — it makes this div the
  // "containing block" for the absolutely-positioned dot.
  avatarWrapper: {
    position:   'relative',
    flexShrink: 0,      // never compress the avatar when the sidebar is narrow
  },

  // The colored circle with initials
  avatar: {
    width:          '32px',
    height:         '32px',
    borderRadius:   '50%',         // 50% radius on a square → circle
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          '#fff',
    fontWeight:     700,
    fontSize:       '0.8rem',
    // background is set inline per-user (avatarColor function)
  },

  // The 8×8 presence status dot
  dot: {
    position:     'absolute',
    bottom:       '-1px',
    right:        '-1px',
    width:        '10px',
    height:       '10px',
    borderRadius: '50%',           // circle
    // White ring creates a visual gap between the dot and the avatar edge
    border:       '2px solid #2c3e50',  // matches sidebar background
    // background is set inline (green or gray)
  },

  username: {
    fontSize:     '0.875rem',
    color:        '#c9cdd4',       // sidebar text color
    overflow:     'hidden',
    whiteSpace:   'nowrap',
    textOverflow: 'ellipsis',
  },
};
