/**
 * Sidebar — Navigation Panel (US-201, US-202, US-601)
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
 *
 * ─── RESPONSIVE BEHAVIOUR (US-601) ──────────────────────────────────────────
 * On desktop (≥ 768px):
 *   The sidebar is a normal 220px-wide flex child in the Layout body row.
 *   It is always visible and its position is controlled by the flex container.
 *
 * On mobile (< 768px):
 *   The sidebar becomes a "drawer" — a panel that slides in from the left.
 *   Key technique: position: 'fixed' removes it from the normal flex flow.
 *   This means the <main> area next to it automatically expands to full width
 *   without any changes to Layout's flex rules.
 *
 *   The slide animation uses CSS transform: translateX():
 *     isOpen = false → translateX(-100%) → sidebar is completely off-screen
 *                                           to the LEFT of the viewport.
 *     isOpen = true  → translateX(0)     → sidebar is fully visible.
 *
 *   Why keep the sidebar in the DOM when closed?
 *   If we conditionally unmounted the sidebar (e.g. {isOpen && <Sidebar />}),
 *   the slide animation would never play — the element would just appear and
 *   disappear instantly. By keeping it mounted and toggling the transform, the
 *   CSS transition creates the smooth slide effect.
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────
 *   id      (string)   — HTML id attribute for the <aside>. Referenced by the
 *                        hamburger button's aria-controls in Layout.jsx.
 *   isOpen  (boolean)  — Whether the drawer is open (mobile only). Ignored on
 *                        desktop — the sidebar is always visible there.
 *   onClose (function) — Called if the sidebar needs to signal a close (unused
 *                        internally right now, but kept for future use such as
 *                        a close button inside the sidebar itself).
 *
 * ─── Z-INDEX LAYERING ────────────────────────────────────────────────────────
 * When the mobile drawer is open, three layers stack on top of each other:
 *
 *   Main content:  z-index auto (effectively 0)
 *   Backdrop:      z-index 150   ← rendered by Layout.jsx
 *   Sidebar:       z-index 200   ← this component (above the backdrop)
 *
 * The sidebar must be above the backdrop so it is clickable; the backdrop must
 * be above the main content so it dims it.
 *
 * ─── aria-hidden ─────────────────────────────────────────────────────────────
 * On mobile, when the sidebar is closed (off-screen), we set aria-hidden="true"
 * so screen readers skip its content — the room list is not reachable when the
 * drawer is closed. When the drawer is open we remove aria-hidden (or set it
 * to false) so screen readers CAN reach the room list.
 * On desktop the sidebar is always visible, so aria-hidden is never set.
 */
import { useState } from 'react';
import { useMobile } from '../hooks/useMobile';
import RoomList from '../../features/rooms/components/RoomList';
import CreateRoomModal from '../../features/rooms/components/CreateRoomModal';

// Must match Layout.jsx's TOP_BAR_HEIGHT so the drawer starts exactly where
// the top bar ends. Keeping it as a local constant avoids a circular import
// between Layout and Sidebar.
const TOP_BAR_HEIGHT = 52; // px

export default function Sidebar({ id, isOpen = false, onClose = () => {} }) {
  // isMobile: true when viewport width < 768px.
  // useMobile() updates automatically on window resize / device rotation.
  const isMobile = useMobile();

  // Controls whether the Create Room modal is shown.
  // false = hidden (default), true = visible.
  const [showModal, setShowModal] = useState(false);

  // ── Compute the style for the <aside> element ─────────────────────────────
  //
  // On desktop: use the base sidebar style (220px wide, flex child).
  // On mobile:  spread the base styles in, then override/add the properties
  //             that make it a fixed-position drawer.
  //
  // The spread operator (...styles.sidebar) copies all base style properties
  // into a new object, then the subsequent properties OVERRIDE specific ones
  // (like width/height) or ADD new ones (position, transform, etc.).
  const sidebarStyle = isMobile
    ? {
        // Inherit the base styles (background, color, overflowY, etc.)
        ...styles.sidebar,

        // position: 'fixed' removes the sidebar from the normal document flow.
        // Without this, the sidebar would still take up space in the flex row
        // even when slid off-screen, leaving a blank 220px gap in the layout.
        position: 'fixed',

        // Pin the top to just below the top bar.
        // Without this the sidebar would cover the top bar (position: fixed
        // is relative to the viewport, not the parent element).
        top: `${TOP_BAR_HEIGHT}px`,

        // Anchor to the left edge of the viewport.
        left: 0,

        // Stretch to the bottom of the viewport.
        bottom: 0,

        // Sit above the backdrop (zIndex: 150) so the sidebar is clickable
        // even when the backdrop is visible.
        zIndex: 200,

        // The slide animation:
        //   Closed: push the sidebar completely off the left edge.
        //   Open:   move it back to its natural position (no offset).
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',

        // Animate the transform property over 250ms with an ease curve.
        // 'ease' accelerates at the start and decelerates at the end, which
        // feels natural for a drawer sliding in.
        transition: 'transform 0.25s ease',

        // Show a shadow on the right edge of the open drawer so it visually
        // separates from the dimmed main content behind it.
        boxShadow: isOpen ? '4px 0 20px rgba(0,0,0,0.35)' : 'none',
      }
    : styles.sidebar; // Desktop: use base style unchanged

  return (
    /*
     * id={id}
     *   Allows the hamburger button in Layout.jsx to reference this element
     *   via aria-controls="sidebar" for screen-reader accessibility.
     *
     * aria-hidden={isMobile && !isOpen}
     *   On mobile, when the drawer is closed (off-screen), hide this element
     *   from the accessibility tree. Screen readers should not navigate into
     *   content the user cannot see.
     *   On desktop this evaluates to `false`, so aria-hidden is not applied.
     */
    <aside id={id} aria-hidden={isMobile && !isOpen} style={sidebarStyle}>

      {/* ── Rooms section ── */}
      <div style={styles.section}>

        {/*
         * Section header row: "ROOMS" label on the left, "+ New" button on the
         * right. This satisfies US-202 AC: "A Create Room button is visible in
         * the sidebar."
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

// ─── Style objects ────────────────────────────────────────────────────────────
const styles = {
  // Base sidebar style — used as-is on desktop, spread into the mobile style object.
  sidebar: {
    width:          '220px',
    flexShrink:     0,          // do not compress when the flex container is tight
    background:     '#2c3e50',
    color:          '#c9cdd4',
    overflowY:      'auto',     // the room list can scroll independently
    display:        'flex',
    flexDirection:  'column',
  },

  section: {
    padding: '0.75rem 0',
  },

  // Flex row so the heading and button sit side by side
  sectionHeader: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '0 0.5rem 0.4rem 0.75rem',
  },

  sectionHeading: {
    margin:        0,
    fontSize:      '0.7rem',
    fontWeight:    700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color:         '#8b929a',
  },

  // "+ New" button in the sidebar header.
  //
  // display:'flex' + alignItems:'center' vertically centres the "+ New" text
  // within the 44px min-height that index.css enforces on all <button> elements.
  // Without this, the text sits at the top of the taller button area.
  newRoomButton: {
    display:      'flex',
    alignItems:   'center',
    background:   'none',
    border:       'none',
    color:        '#8b929a',
    fontSize:     '0.78rem',
    cursor:       'pointer',
    padding:      '0 0.5rem',
    borderRadius: '3px',
  },
};
