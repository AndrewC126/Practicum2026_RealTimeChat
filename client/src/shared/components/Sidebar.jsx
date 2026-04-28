/**
 * Sidebar — Navigation Panel (US-201, US-202)
 *
 * A composition component that assembles the sidebar's sections. It owns
 * the open/closed state of the CreateRoomModal — when the user clicks
 * "+ New Room", Sidebar sets showModal to true; when the modal wants to
 * close itself, it calls onClose which sets showModal back to false.
 *
 * ─── LOCAL STATE FOR UI-ONLY CONCERNS ────────────────────────────────────────
 * showModal is stored in useState (local component state), not Redux, because
 * nothing outside Sidebar needs to know whether the modal is open.
 *
 * The rule of thumb:
 *   • Local state (useState) — only this component cares about it
 *   • Redux state             — multiple unrelated components need to share it
 *
 * ─── LIFTING STATE ───────────────────────────────────────────────────────────
 * The modal is rendered by Sidebar, not by RoomList, because Sidebar is the
 * natural owner of the "+ New Room" button (it's in the sidebar header, not
 * inside the room list). The modal's `onClose` callback is passed down as a
 * prop — this is "lifting state up" to the lowest common ancestor.
 */
import { useState } from 'react';
import RoomList from '../../features/rooms/components/RoomList';
import CreateRoomModal from '../../features/rooms/components/CreateRoomModal';

export default function Sidebar() {
  // Controls whether the Create Room modal is shown.
  // false = hidden (default), true = visible.
  const [showModal, setShowModal] = useState(false);

  return (
    <aside style={styles.sidebar}>

      {/* ── Rooms section ── */}
      <div style={styles.section}>

        {/*
         * Section header row: "ROOMS" label on the left, "+ New Room" button
         * on the right. This satisfies US-202 AC: "A Create Room button is
         * visible in the sidebar."
         */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionHeading}>Rooms</h2>
          <button
            onClick={() => setShowModal(true)}
            style={styles.newRoomButton}
            title="Create a new room"
            aria-label="Create a new room"
          >
            + New
          </button>
        </div>

        {/*
         * RoomList fetches and renders the room list. Sidebar doesn't need to
         * know how that works — encapsulation at work.
         */}
        <RoomList />

      </div>

      {/*
       * MemberList will be added here when US-401 (presence) is implemented.
       */}

      {/*
       * Conditional rendering — React only renders CreateRoomModal when
       * showModal is true. When showModal becomes false, the modal is fully
       * unmounted from the DOM (which also clears its internal state, so the
       * form resets automatically the next time it opens).
       *
       * onClose is a callback that sets showModal back to false. The modal
       * calls it when: the user submits successfully, clicks Cancel, clicks ✕,
       * presses Escape, or clicks the backdrop.
       */}
      {showModal && (
        <CreateRoomModal onClose={() => setShowModal(false)} />
      )}

    </aside>
  );
}

const styles = {
  sidebar: {
    width: '220px',
    flexShrink: 0,
    background: '#2c3e50',
    color: '#c9cdd4',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    padding: '0.75rem 0',
  },
  // Flex row so the heading and button sit side by side
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 0.5rem 0.4rem 0.75rem',
  },
  sectionHeading: {
    margin: 0,
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#8b929a',
  },
  newRoomButton: {
    background: 'none',
    border: 'none',
    color: '#8b929a',
    fontSize: '0.78rem',
    cursor: 'pointer',
    padding: '0.1rem 0.3rem',
    borderRadius: '3px',
    // Highlight on hover is handled below via inline style — for a full
    // hover effect you'd use a CSS class or a styling library like Tailwind
  },
};
