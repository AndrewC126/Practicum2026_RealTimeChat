/**
 * Sidebar — Navigation Panel
 *
 * A thin "composition" component. Its only job is to assemble the sidebar's
 * sections in one place. Individual sections (RoomList, MemberList) handle
 * their own data fetching and rendering.
 *
 * ─── WHY A SEPARATE SIDEBAR COMPONENT ───────────────────────────────────────
 * Layout.jsx shouldn't know about rooms or members — those are feature-specific
 * concerns. Sidebar acts as the boundary: Layout says "render the sidebar here"
 * and Sidebar decides what that means.
 *
 * As the app grows, you can add new sidebar sections (e.g., direct messages,
 * notifications) by editing only this file.
 */
import RoomList from '../../features/rooms/components/RoomList';

export default function Sidebar() {
  return (
    <aside style={styles.sidebar}>

      {/* ── Rooms section ── */}
      <div style={styles.section}>
        <h2 style={styles.sectionHeading}>Rooms</h2>
        {/*
         * RoomList fetches rooms from the server via React Query and renders
         * a RoomItem for each one. It also handles loading, error, and empty
         * states internally — Sidebar doesn't need to know about any of that.
         */}
        <RoomList />
      </div>

      {/*
       * MemberList will be added here when US-401 (presence) is implemented.
       * Having the structure in place now means adding it is just one line.
       */}

    </aside>
  );
}

const styles = {
  sidebar: {
    width: '220px',
    flexShrink: 0,          // don't shrink below 220px even if space is tight
    background: '#2c3e50',
    color: '#c9cdd4',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  section: {
    padding: '0.75rem 0',
  },
  sectionHeading: {
    margin: 0,
    padding: '0 0.75rem 0.4rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#8b929a',
  },
};
