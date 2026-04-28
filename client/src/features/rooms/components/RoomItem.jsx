/**
 * RoomItem — Single Room Row in the Sidebar
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
 * room     — the room object from the API: { id, name, description, member_count }
 * isActive — whether this room is the currently selected one (from Redux)
 * onClick  — called when the user clicks the row (dispatches setActiveRoom)
 */
export default function RoomItem({ room, isActive, onClick }) {
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
      {/* The # prefix is a chat convention (like Slack/Discord channel names) */}
      <span style={styles.name}># {room.name}</span>

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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#c9cdd4',
    transition: 'background 0.1s',
  },
  itemActive: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
  },
  name: {
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  description: {
    fontSize: '0.75rem',
    opacity: 0.7,
    // Clamp to one line with an ellipsis so long descriptions don't break layout
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    width: '100%',
  },
};
