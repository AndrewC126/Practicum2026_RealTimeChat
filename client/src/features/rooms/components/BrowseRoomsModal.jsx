/**
 * BrowseRoomsModal — Discover & Join Public Rooms (US-205)
 *
 * Acceptance criteria covered:
 *   ✓ Lists every public room (including ones the user hasn't joined)
 *   ✓ Each entry shows name, optional description, and current member count
 *   ✓ Rooms already joined show a "Joined" label and the join button is disabled
 *   ✓ Single-click join with no confirmation dialog
 *   ✓ After joining: sidebar updates, user navigates into the room, modal closes
 *   ✓ System message posted in the newly joined room ("Alex has joined the room")
 *   ✓ Search field filters results in real time as the user types
 *   ✓ Empty-state message when no joinable rooms exist
 *
 * ─── COMPONENT STRUCTURE ──────────────────────────────────────────────────────
 *
 *   ┌──── Overlay (full-screen backdrop) ────────────────────────────────────────┐
 *   │  ┌──── Box (white dialog card) ────────────────────────────────────────┐   │
 *   │  │  Header: "Browse Rooms"                              [ ✕ ]          │   │
 *   │  │  Search: [ 🔍 Filter rooms...                              ]        │   │
 *   │  │  ─────────────────────────────────────────────────────────          │   │
 *   │  │  Room row: # general            3 members       [ Joined ]          │   │
 *   │  │  Room row: # random             12 members      [ Join   ]          │   │
 *   │  │  ...                                                                 │   │
 *   │  │  (empty state if no joinable rooms)                                  │   │
 *   │  └─────────────────────────────────────────────────────────────────────┘   │
 *   └────────────────────────────────────────────────────────────────────────────┘
 *
 * ─── CLIENT-SIDE SEARCH FILTERING ───────────────────────────────────────────
 * We filter the rooms array in the component using Array.filter() on the
 * search string. This is fast (rooms list is small) and avoids an extra API
 * call for every keystroke.
 *
 * `toLowerCase()` on both sides makes the search case-insensitive:
 *   "General" matches search "gen", "GEN", "Gen", etc.
 *
 * ─── JOINING FLOW ─────────────────────────────────────────────────────────────
 * When the user clicks "Join" on a room:
 *
 *   1. Set joiningId = room.id  (shows "Joining…" on that button, disables others)
 *   2. Await useBrowseRooms().joinPublicRoom(roomId)
 *      → socket 'join_room' with ack → DB updated → system message broadcast
 *      → sidebar cache invalidated → user navigated into room
 *   3. Call onClose() — the parent (Sidebar) unmounts the modal
 *
 * If the join fails, we show the error message and clear joiningId so the
 * user can try again.
 *
 * ─── LOADING A SINGLE JOIN ───────────────────────────────────────────────────
 * joiningId tracks WHICH room is currently being joined (its UUID), not just a
 * boolean `isJoining`. This matters because multiple "Join" buttons are visible
 * at the same time — we only want to show the spinner on the clicked one, and
 * we want to disable ALL join buttons while one join is in progress (so the
 * user can't accidentally double-join or join two rooms simultaneously).
 *
 * ─── PROPS ────────────────────────────────────────────────────────────────────
 * onClose — callback to close the modal (Sidebar sets showBrowseModal = false)
 */
import { useState, useEffect } from 'react';
import { useBrowseRooms } from '../hooks/useRooms';

export default function BrowseRoomsModal({ onClose }) {
  // ── Search state ────────────────────────────────────────────────────────────
  // Controlled input: search text that drives the filtered room list.
  // Stored in local state — only this component needs to know what's typed.
  const [search, setSearch] = useState('');

  // ── Join loading state ───────────────────────────────────────────────────────
  // null = no join in progress
  // '<uuid>' = that specific room is being joined right now
  const [joiningId, setJoiningId] = useState(null);

  // ── Error state ─────────────────────────────────────────────────────────────
  const [joinError, setJoinError] = useState('');

  // ── Data from hook ──────────────────────────────────────────────────────────
  const { publicRooms, isLoading, isError, joinPublicRoom } = useBrowseRooms();

  // ── Close on Escape key ─────────────────────────────────────────────────────
  // This is the same pattern used in CreateRoomModal.
  // We add the listener when the modal mounts and remove it when it unmounts,
  // so the key doesn't accidentally close other modals later.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown); // cleanup on unmount
  }, [onClose]);

  // ── Client-side search filter ───────────────────────────────────────────────
  // Array.filter() returns a NEW array containing only items where the callback
  // returns true. We do NOT mutate publicRooms — we derive a new array each render.
  //
  // trim() removes leading/trailing whitespace so "  gen  " matches "general".
  const searchTerm = search.trim().toLowerCase();
  const filteredRooms = searchTerm
    ? publicRooms.filter(room =>
        room.name.toLowerCase().includes(searchTerm)
      )
    : publicRooms; // no search term → show all rooms

  // ── Handle join click ───────────────────────────────────────────────────────
  async function handleJoin(roomId) {
    // Prevent double-clicks while a join is already in progress
    if (joiningId) return;

    setJoiningId(roomId); // mark this room as "joining…"
    setJoinError('');     // clear any previous error

    try {
      // joinPublicRoom emits the socket event, waits for the ack, invalidates
      // caches, and dispatches setActiveRoom — all before this line resolves.
      await joinPublicRoom(roomId);

      // Close the modal — the user is now navigated into the room.
      // No need to reset joiningId because the modal is unmounting.
      onClose();
    } catch (err) {
      // Join failed — show the error and re-enable the buttons
      setJoinError(err.message ?? 'Could not join room. Please try again.');
      setJoiningId(null);
    }
  }

  // ── Derived empty-state check ───────────────────────────────────────────────
  // We want a specific message when ALL visible rooms are already joined
  // (no joinable rooms exist), different from the case where the search
  // filtered everything out.
  const joinableRooms = filteredRooms.filter(r => !r.is_member);
  const allJoined     = filteredRooms.length > 0 && joinableRooms.length === 0;

  return (
    /*
     * Overlay — full-screen semi-transparent backdrop.
     * Clicking the overlay calls onClose (same as CreateRoomModal).
     * e.stopPropagation() on the box prevents click bubbling to the overlay.
     */
    <div style={styles.overlay} onClick={onClose}>

      {/* ── Dialog box ── */}
      <div
        style={styles.box}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="browse-modal-title"
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={styles.header}>
          <h2 id="browse-modal-title" style={styles.title}>Browse Rooms</h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* ── Search input ────────────────────────────────────────────────── */}
        {/*
         * The search field is always visible, even while loading.
         * This prevents the layout from "jumping" when data arrives.
         *
         * `autoFocus` focuses this field the moment the modal opens,
         * so the user can start typing immediately without clicking.
         *
         * `value` + `onChange` make this a "controlled input":
         *   React owns the value (stored in `search` state).
         *   Every keystroke calls setSearch → state updates → React re-renders
         *   the input with the new value. This is the standard React pattern
         *   for form inputs when you need to react to changes (e.g., filtering).
         */}
        <div style={styles.searchWrapper}>
          <input
            type="search"
            placeholder="Filter rooms…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            style={styles.searchInput}
            aria-label="Filter rooms by name"
          />
        </div>

        {/* ── Error banner (join failure) ──────────────────────────────────── */}
        {joinError && (
          <p role="alert" style={styles.errorBanner}>{joinError}</p>
        )}

        {/* ── Room list area ───────────────────────────────────────────────── */}
        <div style={styles.listArea}>

          {/* Loading state — shown on the very first fetch */}
          {isLoading && (
            <p style={styles.statusText}>Loading rooms…</p>
          )}

          {/* Error state — shown if GET /api/rooms/public failed */}
          {isError && (
            <p style={styles.statusText}>Could not load rooms. Please try again.</p>
          )}

          {/*
           * Search produced zero results.
           * Different message from "no joinable rooms" so the user knows
           * it's their search query at fault, not a lack of rooms.
           */}
          {!isLoading && !isError && filteredRooms.length === 0 && (
            <p style={styles.statusText}>
              No rooms match "<strong>{search}</strong>"
            </p>
          )}

          {/*
           * All visible rooms are already joined — no joinable ones left.
           * US-205 AC: "If no joinable public rooms exist, a helpful
           * empty-state message is shown."
           */}
          {!isLoading && !isError && allJoined && (
            <p style={styles.statusText}>
              No other rooms available — create one!
            </p>
          )}

          {/*
           * Room rows — one per room that passes the search filter.
           * Rendered even when some rows show "Joined" (existing members)
           * so the user can see everything in one view.
           */}
          {!isLoading && !isError && filteredRooms.map(room => (
            <RoomRow
              key={room.id}
              room={room}
              isJoining={joiningId === room.id}
              anyJoining={joiningId !== null}
              onJoin={() => handleJoin(room.id)}
            />
          ))}

        </div>

      </div>
    </div>
  );
}

/**
 * RoomRow — A single room entry in the browse list.
 *
 * Kept as a separate component (inside this file, not exported) to keep
 * BrowseRoomsModal's JSX readable. It's "private" — only BrowseRoomsModal uses it.
 *
 * Layout:
 *   ┌───────────────────────────────────────────────────────────────────────┐
 *   │  # general                                              [ Join ]      │
 *   │  General discussion — 12 members                                     │
 *   └───────────────────────────────────────────────────────────────────────┘
 *
 * Props:
 *   room       — room object: { id, name, description, member_count, is_member }
 *   isJoining  — true when THIS room is being joined (show "Joining…" on its button)
 *   anyJoining — true when ANY room is being joined (disable all join buttons)
 *   onJoin     — callback when the user clicks Join
 */
function RoomRow({ room, isJoining, anyJoining, onJoin }) {
  // Determine the button label based on membership and loading state
  let buttonLabel;
  if (room.is_member)  buttonLabel = 'Joined';
  else if (isJoining)  buttonLabel = 'Joining…';
  else                 buttonLabel = 'Join';

  // The join button is disabled when:
  //   - The user is already a member of this room (no re-joining)
  //   - Any join is currently in progress (prevent concurrent joins)
  const joinDisabled = room.is_member || anyJoining;

  return (
    <div style={styles.row}>

      {/* ── Left side: room info ─────────────────────────────────────────── */}
      <div style={styles.rowInfo}>

        {/* Room name with the Slack-style # prefix */}
        <span style={styles.rowName}># {room.name}</span>

        {/*
         * Meta line: description (if any) and member count.
         * These are on the same line, separated by a dash when description exists.
         *
         * Conditional rendering with &&:
         *   React renders nothing for `false`, `null`, or `undefined`.
         *   `room.description && <span>...</span>` renders the span only when
         *   description is a non-empty string.
         */}
        <span style={styles.rowMeta}>
          {room.description && (
            // Fragment lets us group the description + dash without an extra div
            <>
              <span style={styles.rowDescription}>{room.description}</span>
              {' · '}
            </>
          )}
          {/* member_count comes from the room_summary VIEW's COUNT(rm.user_id) */}
          {room.member_count} {room.member_count === 1 ? 'member' : 'members'}
        </span>

      </div>

      {/* ── Right side: join button or "Joined" label ────────────────────── */}
      <button
        onClick={onJoin}
        disabled={joinDisabled}
        // Spread the base style, then conditionally apply the "joined" or
        // "joining" variant. The spread operator merges two style objects —
        // later properties override earlier ones with the same name.
        style={{
          ...styles.joinButton,
          ...(room.is_member ? styles.joinButtonJoined : {}),
          ...(isJoining      ? styles.joinButtonJoining : {}),
        }}
        // aria-label gives screen readers more context than just "Join"
        aria-label={room.is_member
          ? `Already a member of ${room.name}`
          : `Join ${room.name}`
        }
      >
        {buttonLabel}
      </button>

    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  // ── Modal overlay ───────────────────────────────────────────────────────────
  overlay: {
    position:       'fixed',
    inset:          0,                         // shorthand for top/right/bottom/left: 0
    background:     'rgba(0, 0, 0, 0.5)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         1000,
  },

  // ── Dialog box ──────────────────────────────────────────────────────────────
  box: {
    background:   '#fff',
    borderRadius: '8px',
    padding:      '1.5rem',
    width:        '100%',
    maxWidth:     '520px',
    maxHeight:    '80vh',        // prevent the modal from overflowing the viewport
    display:      'flex',
    flexDirection:'column',      // stack header, search, list vertically
    boxShadow:    '0 8px 32px rgba(0,0,0,0.2)',
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   '1rem',
  },
  title: {
    margin:   0,
    fontSize: '1.2rem',
  },
  closeButton: {
    background: 'none',
    border:     'none',
    fontSize:   '1.1rem',
    cursor:     'pointer',
    color:      '#666',
    padding:    '0.2rem 0.4rem',
    lineHeight: 1,
  },

  // ── Search ──────────────────────────────────────────────────────────────────
  searchWrapper: {
    marginBottom: '0.75rem',
  },
  searchInput: {
    width:        '100%',
    padding:      '0.5rem 0.75rem',
    border:       '1px solid #ccc',
    borderRadius: '4px',
    fontSize:     '0.95rem',
    boxSizing:    'border-box', // include padding in the 100% width calculation
  },

  // ── Error banner ────────────────────────────────────────────────────────────
  errorBanner: {
    margin:       '0 0 0.75rem',
    padding:      '0.6rem 0.75rem',
    background:   '#fdecea',
    color:        '#c62828',
    borderRadius: '4px',
    fontSize:     '0.875rem',
  },

  // ── Room list area ──────────────────────────────────────────────────────────
  // flex:1 makes this area expand to fill the remaining box height.
  // overflowY:'auto' adds a scrollbar only when the list is taller than the box.
  listArea: {
    flex:      1,
    overflowY: 'auto',
  },

  // Status / empty-state text
  statusText: {
    margin:    '1rem 0',
    fontSize:  '0.875rem',
    color:     '#666',
    textAlign: 'center',
  },

  // ── Room row ────────────────────────────────────────────────────────────────
  row: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            '1rem',
    padding:        '0.65rem 0',
    borderBottom:   '1px solid #f0f0f0', // subtle separator between rows
  },
  rowInfo: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '2px',
    minWidth:      0,           // allows text-overflow: ellipsis to work inside a flex child
  },
  rowName: {
    fontSize:     '0.95rem',
    fontWeight:   600,
    color:        '#222',
    overflow:     'hidden',
    whiteSpace:   'nowrap',
    textOverflow: 'ellipsis',
  },
  rowMeta: {
    fontSize: '0.8rem',
    color:    '#777',
  },
  rowDescription: {
    // The description is inline inside the meta line; no extra style needed
  },

  // ── Join button variants ─────────────────────────────────────────────────────
  joinButton: {
    flexShrink:   0,            // never compress when room name is long
    padding:      '0.35rem 0.85rem',
    border:       '1px solid #1976d2',
    borderRadius: '4px',
    background:   '#1976d2',
    color:        '#fff',
    fontSize:     '0.85rem',
    fontWeight:   500,
    cursor:       'pointer',
    whiteSpace:   'nowrap',
  },

  // "Joined" state: grey border + transparent background to read as a label
  joinButtonJoined: {
    background: 'transparent',
    color:      '#888',
    border:     '1px solid #ccc',
    cursor:     'default',
  },

  // "Joining…" state: slightly dimmed while the socket round-trip is in flight
  joinButtonJoining: {
    opacity: 0.65,
    cursor:  'wait',
  },
};
