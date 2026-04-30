/**
 * InviteModal — Invite Users to a Room (US-206)
 *
 * Acceptance criteria covered:
 *   ✓ Opens from the "Invite" button in the room header
 *   ✓ Search field that finds users by username, updating results as the user types
 *   ✓ Results exclude users who are already room members (server-side filter)
 *   ✓ Single-click invite — no confirmation dialog
 *   ✓ System message broadcast to room ("Alice was added by Jordan")
 *   ✓ Invited user's sidebar updates in real time (via room_added socket event)
 *   ✓ "No users found" shown when search matches nobody
 *   ✓ Only room members can invite (enforced both server-side and via the
 *     "Invite" button only appearing inside the active room header)
 *
 * ─── COMPONENT STRUCTURE ──────────────────────────────────────────────────────
 *
 *   ┌──── Overlay (backdrop) ─────────────────────────────────────────────────┐
 *   │  ┌──── Box (dialog card) ───────────────────────────────────────────┐   │
 *   │  │  Invite People to #general                         [ ✕ ]        │   │
 *   │  │  ─────────────────────────────────────────────────────           │   │
 *   │  │  [ 🔍  Search by username...                             ]       │   │
 *   │  │  ─────────────────────────────────────────────────────           │   │
 *   │  │  alice                                          [ Invite ]       │   │
 *   │  │  bob                                            [ Invite ]       │   │
 *   │  │  carol                                          [Invited ✓]      │   │
 *   │  │  (empty state / loading / error as needed)                       │   │
 *   │  └─────────────────────────────────────────────────────────────────┘   │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 * ─── DEBOUNCE PATTERN ─────────────────────────────────────────────────────────
 * The search input has two pieces of state:
 *
 *   `search`         — controlled input value, updates on every keystroke
 *   `debouncedQuery` — lags behind `search` by 300ms
 *
 * We derive `debouncedQuery` from `search` using a useEffect + setTimeout:
 *
 *   1. User types a character → `search` updates → React re-renders immediately
 *   2. The useEffect fires: it sets a 300ms timer to copy `search` → `debouncedQuery`
 *   3. If the user types ANOTHER character within 300ms, the cleanup function from
 *      step 2 runs first (clearing the timer), and a new 300ms timer starts
 *   4. Once 300ms pass with no new keystrokes, `debouncedQuery` finally updates
 *   5. React Query sees the new `debouncedQuery` in the queryKey → fetches results
 *
 * Without debouncing: a new HTTP request fires on every single keystroke.
 * With debouncing: requests only fire after a brief pause in typing.
 * This prevents overwhelming the server and reduces UI flicker.
 *
 * ─── TRACKING INVITED USERS ───────────────────────────────────────────────────
 * `invitedIds` is a JavaScript Set stored in state. A Set is like an array but:
 *   • Every value is unique (no duplicates)
 *   • Has O(1) lookup with .has() — faster than Array.includes() for large lists
 *   • Ideal for "have I already done this?" tracking
 *
 * After a successful invite, we add the user's ID to `invitedIds`. This lets
 * the UI immediately show "Invited ✓" on that user's row without waiting for
 * the React Query cache to refresh and remove them from the results.
 *
 * ─── INVITE LOADING STATE ─────────────────────────────────────────────────────
 * `invitingId` holds the UUID of the user currently being invited (null when idle).
 * Using a UUID (not just a boolean `isInviting`) lets us show a spinner on only
 * THAT specific user's button, while keeping all other invite buttons visible
 * (but disabled so the user can't start two invites at once).
 *
 * ─── PROPS ────────────────────────────────────────────────────────────────────
 * roomId   — UUID of the room to invite users into
 * roomName — display name shown in the modal title ("Invite People to #general")
 * onClose  — callback to close the modal (ChatPanel sets showInviteModal = false)
 */
import { useState, useEffect } from 'react';
import { useUserSearch, useInviteUser } from '../hooks/useInvite';

export default function InviteModal({ roomId, roomName, onClose }) {
  // ── Search input state ──────────────────────────────────────────────────────
  // `search` is the raw input value — updated on every keystroke.
  const [search, setSearch] = useState('');

  // `debouncedQuery` is what actually drives the React Query fetch.
  // It trails `search` by 300ms to avoid a request on every keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // ── Invite tracking state ───────────────────────────────────────────────────
  // Set of user IDs that have been successfully invited this session.
  // We use a Set<string> for O(1) .has() lookups.
  const [invitedIds, setInvitedIds] = useState(new Set());

  // UUID of the user currently being invited, or null if no invite is in flight.
  const [invitingId, setInvitingId] = useState(null);

  // Error to display if an invite fails (cleared on each new invite attempt)
  const [inviteError, setInviteError] = useState('');

  // ── Hook calls ──────────────────────────────────────────────────────────────
  // useUserSearch provides the search results from GET /api/rooms/:id/invitees?q=
  const { users, isLoading: isSearching, isError: isSearchError } = useUserSearch(roomId, debouncedQuery);

  // useInviteUser provides the inviteUser(roomId, userId) function
  const { inviteUser } = useInviteUser();

  // ── Debounce: delay the query by 300ms ─────────────────────────────────────
  //
  // HOW THIS WORKS:
  //   Every time `search` changes, this effect runs. It schedules a timer that
  //   will update `debouncedQuery` after 300ms. The effect also returns a
  //   cleanup function that CANCELS the timer if `search` changes again before
  //   the 300ms is up. This ensures `debouncedQuery` only updates after the user
  //   has stopped typing for at least 300ms.
  //
  //   setTimeout(fn, 300) → schedule fn 300ms in the future
  //   clearTimeout(timer) → cancel a pending setTimeout
  //
  //   React runs the cleanup before each new effect execution and on unmount.
  useEffect(() => {
    // Schedule the update
    const timer = setTimeout(() => {
      setDebouncedQuery(search);
    }, 300);

    // Cleanup: cancel the timer if `search` changes before 300ms
    return () => clearTimeout(timer);
  }, [search]); // only re-run when `search` changes

  // ── Close on Escape key ─────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown); // cleanup on unmount
  }, [onClose]);

  // ── Handle invite click ─────────────────────────────────────────────────────
  async function handleInvite(userId) {
    // Prevent concurrent invites (e.g., double-clicking "Invite")
    if (invitingId) return;

    setInvitingId(userId); // show "Inviting…" on this user's button
    setInviteError('');    // clear any previous error

    try {
      // inviteUser wraps the socket.emit('invite_user', ...) in a Promise.
      // It resolves when the server's ack({ ok: true }) fires, meaning:
      //   • The user was added to room_members in the DB
      //   • The system message was broadcast to all room members
      //   • The invited user received the 'room_added' socket notification
      await inviteUser(roomId, userId);

      // Mark this user as invited so we can show "Invited ✓" immediately,
      // without waiting for React Query to refetch and remove them.
      //
      // We create a NEW Set (rather than mutating the existing one) because
      // React detects state changes by reference equality — mutating the existing
      // Set would give React the same object reference and no re-render would happen.
      setInvitedIds(prev => new Set([...prev, userId]));

    } catch (err) {
      setInviteError(err.message ?? 'Could not invite user. Please try again.');
    } finally {
      // Always clear the loading state so the buttons re-enable
      setInvitingId(null);
    }
  }

  // ── Determine what to show in the results area ───────────────────────────────
  // These derived booleans make the JSX below more readable.
  const hasQuery   = debouncedQuery.trim().length > 0;
  const hasResults = users.length > 0;

  return (
    /*
     * Overlay — clicking outside the box closes the modal.
     * e.stopPropagation() on the box prevents clicks inside it from
     * bubbling up to the overlay's onClick handler (same as other modals).
     */
    <div style={styles.overlay} onClick={onClose}>

      {/* ── Dialog box ── */}
      <div
        style={styles.box}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
      >

        {/* ── Header ── */}
        <div style={styles.header}>
          <h2 id="invite-modal-title" style={styles.title}>
            {/* Show the room name so the user knows which room they're inviting to */}
            Invite People to <span style={styles.roomNameChip}># {roomName}</span>
          </h2>
          <button
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close invite dialog"
          >
            ✕
          </button>
        </div>

        {/* ── Search input ────────────────────────────────────────────────── */}
        {/*
         * autoFocus: immediately focus the search field when the modal opens
         * so the user can start typing without clicking.
         *
         * This is a "controlled input": React owns the `search` state, and the
         * input always displays exactly what `search` contains. Every keystroke
         * calls setSearch → state updates → React re-renders with the new value.
         */}
        <input
          type="search"
          placeholder="Search by username…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
          style={styles.searchInput}
          aria-label="Search for users to invite"
        />

        {/* ── Error banner ────────────────────────────────────────────────── */}
        {inviteError && (
          <p role="alert" style={styles.errorBanner}>{inviteError}</p>
        )}

        {/* ── Results area ────────────────────────────────────────────────── */}
        <div style={styles.results}>

          {/* Prompt — shown before the user has typed anything */}
          {!hasQuery && (
            <p style={styles.hintText}>
              Start typing to search for users to invite.
            </p>
          )}

          {/* Loading state — shown while the debounced fetch is in flight */}
          {hasQuery && isSearching && (
            <p style={styles.hintText}>Searching…</p>
          )}

          {/* Network error */}
          {hasQuery && isSearchError && (
            <p style={styles.hintText}>Could not load results. Please try again.</p>
          )}

          {/*
           * Empty state — query was sent but no users matched.
           * AC: "If a search query matches no registered users, a clear message
           * is shown (e.g. 'No users found')."
           *
           * !isSearching ensures we only show this AFTER the response arrives,
           * not while the request is still in flight (which would flash briefly).
           */}
          {hasQuery && !isSearching && !isSearchError && !hasResults && (
            <p style={styles.hintText}>No users found.</p>
          )}

          {/*
           * User rows — one per result from the search.
           * Rendered even for users already in `invitedIds` (they show "Invited ✓").
           * They will disappear from the list on the next search refetch once the
           * React Query cache invalidation from useInviteUser has completed.
           */}
          {!isSearching && !isSearchError && users.map(user => {
            const alreadyInvited = invitedIds.has(user.id);
            const isBeingInvited = invitingId === user.id;
            const anyInFlight    = invitingId !== null;

            // Derive the button label based on state
            let buttonLabel;
            if (alreadyInvited)    buttonLabel = 'Invited ✓';
            else if (isBeingInvited) buttonLabel = 'Inviting…';
            else                   buttonLabel = 'Invite';

            return (
              <div key={user.id} style={styles.userRow}>

                {/* ── User info ─────────────────────────────────────────── */}
                <div style={styles.userInfo}>
                  {/*
                   * Avatar — a simple coloured circle with the first letter of
                   * the username. This gives visual identity without needing
                   * profile pictures. The colour is derived from the username
                   * so each user has a consistent colour across sessions.
                   */}
                  <div style={{ ...styles.avatar, background: avatarColour(user.username) }}>
                    {user.username[0].toUpperCase()}
                  </div>
                  <span style={styles.username}>{user.username}</span>
                </div>

                {/* ── Invite button ────────────────────────────────────── */}
                <button
                  onClick={() => handleInvite(user.id)}
                  disabled={alreadyInvited || anyInFlight}
                  style={{
                    ...styles.inviteButton,
                    ...(alreadyInvited  ? styles.inviteButtonDone    : {}),
                    ...(isBeingInvited  ? styles.inviteButtonLoading : {}),
                  }}
                  aria-label={alreadyInvited
                    ? `${user.username} has been invited`
                    : `Invite ${user.username}`
                  }
                >
                  {buttonLabel}
                </button>

              </div>
            );
          })}

        </div>

      </div>
    </div>
  );
}

/**
 * avatarColour — deterministic colour from a username string.
 *
 * Converts the username to a number (by summing char codes) and uses modulo
 * to pick from a palette of colours. Same username always → same colour.
 *
 * This is NOT cryptographic — it just needs to look visually distinct.
 * Using charCodeAt(i) gives the ASCII/Unicode code point of each character.
 * Summing them gives a unique-enough number for colour selection.
 *
 * @param {string} username
 * @returns {string} — a CSS hex colour string
 */
function avatarColour(username) {
  const palette = [
    '#1976d2', '#388e3c', '#f57c00', '#7b1fa2',
    '#c62828', '#00838f', '#558b2f', '#ad1457',
  ];
  let sum = 0;
  for (let i = 0; i < username.length; i++) {
    // charCodeAt(i) returns the numeric Unicode value of the character at index i.
    // Summing all characters gives a number that is unique-ish per username.
    sum += username.charCodeAt(i);
  }
  // % palette.length wraps the sum into a valid index [0, palette.length - 1]
  return palette[sum % palette.length];
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  // ── Modal overlay ────────────────────────────────────────────────────────────
  overlay: {
    position:       'fixed',
    inset:          0,                        // top/right/bottom/left: 0
    background:     'rgba(0, 0, 0, 0.5)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    zIndex:         1000,
  },

  // ── Dialog box ───────────────────────────────────────────────────────────────
  box: {
    background:    '#fff',
    borderRadius:  '8px',
    padding:       '1.5rem',
    width:         '100%',
    maxWidth:      '480px',
    maxHeight:     '75vh',        // cap so the modal never fills the whole screen
    display:       'flex',
    flexDirection: 'column',
    boxShadow:     '0 8px 32px rgba(0,0,0,0.2)',
  },

  // ── Header ───────────────────────────────────────────────────────────────────
  header: {
    display:        'flex',
    alignItems:     'flex-start',  // top-align title (it might wrap) and close button
    justifyContent: 'space-between',
    gap:            '0.5rem',
    marginBottom:   '1rem',
  },
  title: {
    margin:   0,
    fontSize: '1.1rem',
    lineHeight: 1.3,
  },
  // The room name inside the title — styled like a "chip" / "badge"
  roomNameChip: {
    display:       'inline-block',
    background:    '#f0f4ff',
    color:         '#1976d2',
    borderRadius:  '3px',
    padding:       '1px 6px',
    fontSize:      '1rem',
    fontWeight:    600,
  },
  closeButton: {
    flexShrink:  0,          // don't compress the close button
    background:  'none',
    border:      'none',
    fontSize:    '1.1rem',
    cursor:      'pointer',
    color:       '#666',
    padding:     '0.2rem 0.4rem',
    lineHeight:  1,
  },

  // ── Search input ─────────────────────────────────────────────────────────────
  searchInput: {
    width:        '100%',
    padding:      '0.5rem 0.75rem',
    border:       '1px solid #ccc',
    borderRadius: '4px',
    fontSize:     '0.95rem',
    marginBottom: '0.75rem',
    boxSizing:    'border-box',  // include padding in the 100% width
  },

  // ── Error banner ─────────────────────────────────────────────────────────────
  errorBanner: {
    margin:       '0 0 0.75rem',
    padding:      '0.6rem 0.75rem',
    background:   '#fdecea',
    color:        '#c62828',
    borderRadius: '4px',
    fontSize:     '0.875rem',
  },

  // ── Results scrollable area ───────────────────────────────────────────────────
  results: {
    flex:      1,           // grow to fill remaining box height
    overflowY: 'auto',      // scrollbar appears only when list is taller than box
    minHeight: '80px',      // always show at least some space even when empty
  },

  // Hint / status text (loading, empty state, prompt)
  hintText: {
    margin:    '1rem 0',
    fontSize:  '0.875rem',
    color:     '#888',
    textAlign: 'center',
  },

  // ── User row ─────────────────────────────────────────────────────────────────
  userRow: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            '0.75rem',
    padding:        '0.6rem 0',
    borderBottom:   '1px solid #f0f0f0',
  },

  // Left side of the row: avatar + username
  userInfo: {
    display:    'flex',
    alignItems: 'center',
    gap:        '0.6rem',
    minWidth:   0,          // allow username to truncate if too long
  },

  // Circular avatar — background colour set inline per-user
  avatar: {
    flexShrink:     0,
    width:          '32px',
    height:         '32px',
    borderRadius:   '50%',        // makes it a circle
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          '#fff',
    fontWeight:     700,
    fontSize:       '0.85rem',
  },

  username: {
    fontSize:     '0.95rem',
    fontWeight:   500,
    color:        '#222',
    overflow:     'hidden',
    whiteSpace:   'nowrap',
    textOverflow: 'ellipsis',
  },

  // ── Invite button variants ────────────────────────────────────────────────────
  inviteButton: {
    flexShrink:   0,
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

  // "Invited ✓" state — green outline label, not a clickable button
  inviteButtonDone: {
    background: 'transparent',
    color:      '#388e3c',
    border:     '1px solid #388e3c',
    cursor:     'default',
  },

  // "Inviting…" state — dimmed while the socket round-trip is in flight
  inviteButtonLoading: {
    opacity: 0.65,
    cursor:  'wait',
  },
};
