/**
 * MemberList — Room Member Presence Panel (US-402)
 *
 * Acceptance criteria covered:
 *   ✓ Shows all users currently in the active room
 *   ✓ Online members listed before offline members
 *   ✓ Updates in real time as users join or leave (via 'members_updated' socket event)
 *   ✓ Clicking a username shows basic profile info (username, join date)
 *
 * ─── TWO DATA SOURCES ─────────────────────────────────────────────────────────
 *
 *   React Query  (server state) → the MEMBER LIST for the active room
 *     GET /api/rooms/:id/members → [{ id, username, joinedAt, userCreatedAt }]
 *     This is the authoritative list of who is in the room. It changes when
 *     users join or leave, and we refetch it via 'members_updated' socket events.
 *
 *   Redux        (push state)   → the ONLINE STATUS for each user
 *     state.presence.onlineUsers → { [userId]: { username, isOnline } }
 *     This is updated in real time by 'user_online' and 'user_offline' socket
 *     events (handled by usePresence in Layout). It never goes to the server.
 *
 * Combining them:
 *   For each member from the REST response, look up their online status in
 *   the Redux map. Partition the list into two arrays (online / offline).
 *   Render two sections labeled "Online — N" and "Offline — N".
 *
 * ─── REAL-TIME MEMBER LIST UPDATES ───────────────────────────────────────────
 * When a user joins or leaves a room, chat.handler.js emits 'members_updated'
 * to all sockets in that room. This component listens for that event and calls
 * queryClient.invalidateQueries(['members', roomId]).
 *
 * invalidateQueries tells React Query: "this cached data is now stale, please
 * refetch it in the background." The member list refreshes automatically.
 *
 * ─── PROFILE CARD ─────────────────────────────────────────────────────────────
 * When a user clicks a member row, we store that member's data in `selectedMember`
 * state. A small card appears at a fixed screen position showing:
 *   - Username
 *   - "Member since" (user account created_at)
 *   - "Joined room" (room_members joined_at)
 *
 * Clicking anywhere outside the card or pressing Escape dismisses it.
 * The card uses position: 'fixed' so it escapes the sidebar's overflow clipping.
 *
 * ─── CLICK-OUTSIDE DETECTION ─────────────────────────────────────────────────
 * We attach a 'mousedown' listener to the window when the card is open.
 * If the click target is OUTSIDE the card element (checked with
 * cardRef.current.contains(e.target) === false), we close it.
 *
 * We use 'mousedown' instead of 'click' because:
 *   - 'click' fires AFTER 'mouseup', which means the member-row's onClick
 *     and the window's click handler fire in the same event cycle.
 *   - 'mousedown' fires BEFORE 'click', so by the time the member-row's onClick
 *     opens the card, the window's mousedown has already been evaluated against
 *     the PREVIOUS card (if any) and dismissed it cleanly.
 */
import { useState, useEffect, useRef } from 'react';
import { useSelector }                 from 'react-redux';
import { useQuery, useQueryClient }    from '@tanstack/react-query';
import { selectActiveRoomId }          from '../../rooms/roomsSlice';
import { selectOnlineUsers }           from '../presenceSlice';
import { useSocket }                   from '../../../shared/hooks/useSocket';
import PresenceIndicator               from './PresenceIndicator';
import api                             from '../../../services/api';

export default function MemberList() {
  // ── Redux state ──────────────────────────────────────────────────────────────
  // Which room the user is currently viewing.
  const activeRoomId = useSelector(selectActiveRoomId);

  // The online status map: { [userId]: { username, isOnline } }.
  // Updated in real time by usePresence (called in Layout.jsx).
  const onlineUsers = useSelector(selectOnlineUsers);

  // ── Profile card state ───────────────────────────────────────────────────────
  // null = no card open.
  // { member, cardY } = show card for `member` at vertical position `cardY` px.
  const [selectedMember, setSelectedMember] = useState(null);

  // ref to the profile card DOM node — used for click-outside detection.
  const cardRef = useRef(null);

  // ── Socket + QueryClient for real-time member list updates ──────────────────
  const socket      = useSocket();
  const queryClient = useQueryClient();

  // ── React Query: fetch the member list ──────────────────────────────────────
  // This query is disabled when no room is selected (enabled: !!activeRoomId)
  // to avoid fetching /api/rooms/null/members.
  //
  // members array shape: [{ id, username, joinedAt, userCreatedAt }]
  const { data: members = [], isLoading, isError } = useQuery({
    queryKey: ['members', activeRoomId],
    queryFn:  () =>
      api.get(`/rooms/${activeRoomId}/members`).then(r => r.data),
    enabled:   !!activeRoomId,
    staleTime: 30_000, // 30 seconds — real-time updates via 'members_updated' keep it fresh
  });

  // ── Real-time membership updates ─────────────────────────────────────────────
  // Listen for 'members_updated' events emitted by the server when someone
  // joins, leaves, or is invited. Invalidate the React Query cache so the list
  // refetches automatically.
  useEffect(() => {
    if (!socket || !activeRoomId) return;

    function handleMembersUpdated({ roomId }) {
      // Only invalidate if the event is for our currently active room.
      // (We're subscribed to the room's socket channel, so we only receive
      // events for rooms we have open — this guard is extra safety.)
      if (roomId === activeRoomId) {
        // invalidateQueries marks the cache as stale and triggers a background
        // refetch. React Query handles the loading state automatically.
        queryClient.invalidateQueries({ queryKey: ['members', activeRoomId] });
      }
    }

    socket.on('members_updated', handleMembersUpdated);

    // Cleanup: remove the listener when the room changes or the socket reconnects
    return () => {
      socket.off('members_updated', handleMembersUpdated);
    };
  }, [socket, activeRoomId, queryClient]);

  // ── Close profile card when clicking outside it ───────────────────────────────
  useEffect(() => {
    // Only attach the listener when a card is actually open.
    if (!selectedMember) return;

    function handleMouseDown(e) {
      // cardRef.current.contains(e.target) returns true if the click was
      // INSIDE the card element (any child or the element itself).
      // If it returns false, the click was outside → close the card.
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setSelectedMember(null);
      }
    }

    // 'mousedown' fires before 'click', which prevents a race condition where
    // the card opens and the same click closes it immediately.
    window.addEventListener('mousedown', handleMouseDown);

    // Cleanup: remove the listener when the card closes or the component unmounts.
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [selectedMember]);

  // ── Close profile card on Escape ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMember) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') setSelectedMember(null);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMember]);

  // ── Hide when no room is active ───────────────────────────────────────────────
  // Nothing to show without an active room.
  if (!activeRoomId) return null;

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return <p style={styles.statusText}>Loading members…</p>;
  }

  // ── Error state ───────────────────────────────────────────────────────────────
  if (isError) {
    return <p style={styles.statusText}>Could not load members.</p>;
  }

  // ── Partition members into online and offline ─────────────────────────────────
  //
  // For each member from the REST response, check the Redux onlineUsers map:
  //   onlineUsers[member.id]?.isOnline → true = online, false/undefined = offline
  //
  // Array.filter() returns a new array of elements where the callback returns true.
  // We run it twice: once for online, once for offline.
  //
  // AC: "Online members are listed before offline members"
  const onlineMembers  = members.filter(m => onlineUsers[m.id]?.isOnline === true);
  const offlineMembers = members.filter(m => onlineUsers[m.id]?.isOnline !== true);

  // ── Handle clicking a member row ──────────────────────────────────────────────
  function handleMemberClick(member, event) {
    // If this member's card is already open, close it (toggle behavior).
    if (selectedMember?.member.id === member.id) {
      setSelectedMember(null);
      return;
    }

    // getBoundingClientRect() returns the element's position and size relative
    // to the viewport. We use it to position the card near the clicked row.
    const rect = event.currentTarget.getBoundingClientRect();

    // Store the member data and where to position the card.
    // cardY is the top of the clicked row — the card will appear at this Y position.
    setSelectedMember({ member, cardY: rect.top });
  }

  return (
    <div style={styles.container}>

      {/* ── Online section ── */}
      {onlineMembers.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionHeading}>
            {/* The count badge next to the heading */}
            Online — <span style={styles.count}>{onlineMembers.length}</span>
          </h3>

          {onlineMembers.map(member => (
            <PresenceIndicator
              key={member.id}
              user={member}
              isOnline={true}
              onClick={e => handleMemberClick(member, e)}
            />
          ))}
        </div>
      )}

      {/* ── Offline section ── */}
      {offlineMembers.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionHeading}>
            Offline — <span style={styles.count}>{offlineMembers.length}</span>
          </h3>

          {offlineMembers.map(member => (
            <PresenceIndicator
              key={member.id}
              user={member}
              isOnline={false}
              onClick={e => handleMemberClick(member, e)}
            />
          ))}
        </div>
      )}

      {/* ── Profile card (shown when a member is clicked) ── */}
      {/*
       * position: 'fixed' positions the card relative to the VIEWPORT, not
       * the sidebar. This lets it escape the sidebar's overflow clipping so
       * it appears freely over the chat panel.
       *
       * We clamp cardY to prevent it from going off the bottom of the screen:
       *   Math.min(cardY, window.innerHeight - 180)
       *   180 is an approximate card height — keeps it fully visible.
       */}
      {selectedMember && (
        <ProfileCard
          ref={cardRef}
          member={selectedMember.member}
          cardY={Math.min(selectedMember.cardY, window.innerHeight - 180)}
          onClose={() => setSelectedMember(null)}
        />
      )}

    </div>
  );
}

/**
 * ProfileCard — Profile info popover (US-402 AC: "Clicking a username shows
 * basic profile info — username, join date").
 *
 * Positioned at a fixed Y coordinate (passed from MemberList) so it appears
 * next to the clicked member row. Sits to the RIGHT of the sidebar (left: 228px
 * = sidebar width 220px + 8px gap).
 *
 * Uses React.forwardRef so MemberList can attach a ref for click-outside detection.
 * forwardRef wraps the component function and passes the ref as a second argument.
 *
 * Props:
 *   member  — { id, username, joinedAt, userCreatedAt }
 *   cardY   — vertical pixel position for the card top edge
 *   onClose — called by the ✕ button
 */
import { forwardRef } from 'react';

const ProfileCard = forwardRef(function ProfileCard({ member, cardY, onClose }, ref) {
  // Format a UTC ISO string into a human-readable local date.
  // new Date(isoString) parses the string.
  // toLocaleDateString() formats it per the browser locale ("Apr 1, 2025").
  // { year:'numeric', month:'short', day:'numeric' } controls the format.
  function formatDate(isoString) {
    if (!isoString) return '—';
    return new Date(isoString).toLocaleDateString([], {
      year:  'numeric',
      month: 'short',
      day:   'numeric',
    });
  }

  return (
    <div
      ref={ref}
      style={{
        ...styles.card,
        top:  cardY,  // dynamic vertical position
      }}
      role="dialog"
      aria-label={`${member.username}'s profile`}
    >
      {/* ── Close button ── */}
      <button
        onClick={onClose}
        style={styles.cardClose}
        aria-label="Close profile card"
      >
        ✕
      </button>

      {/* ── Username ── */}
      <p style={styles.cardName}>{member.username}</p>

      {/* ── Dates ── */}
      <div style={styles.cardField}>
        <span style={styles.cardLabel}>Member since</span>
        <span style={styles.cardValue}>{formatDate(member.userCreatedAt)}</span>
      </div>

      <div style={styles.cardField}>
        <span style={styles.cardLabel}>Joined room</span>
        <span style={styles.cardValue}>{formatDate(member.joinedAt)}</span>
      </div>
    </div>
  );
});

// ─── Style objects ────────────────────────────────────────────────────────────
const styles = {
  // Outer wrapper for the member list — takes up the sections below the room list
  container: {
    paddingTop: '0.25rem',
  },

  // Each Online / Offline group
  section: {
    padding: '0.25rem 0',
  },

  // "Online — 2" heading row
  sectionHeading: {
    margin:        0,
    padding:       '0.3rem 0.75rem 0.2rem',
    fontSize:      '0.7rem',
    fontWeight:    700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color:         '#8b929a',
  },

  count: {
    fontWeight: 400, // lighter than the label so the number doesn't shout
  },

  // Small muted text for loading/error states
  statusText: {
    margin:    0,
    padding:   '0.5rem 0.75rem',
    fontSize:  '0.8rem',
    color:     '#8b929a',
    fontStyle: 'italic',
  },

  // ── Profile card ────────────────────────────────────────────────────────────
  card: {
    position:     'fixed',
    left:         '228px',  // 220px sidebar width + 8px gap
    // `top` is set inline from cardY
    width:        '200px',
    background:   '#fff',
    borderRadius: '8px',
    padding:      '1rem',
    boxShadow:    '0 4px 20px rgba(0,0,0,0.18)',
    zIndex:       500,      // above everything in the sidebar, below modals (1000)
  },
  cardClose: {
    position:   'absolute',
    top:        '0.5rem',
    right:      '0.5rem',
    background: 'none',
    border:     'none',
    color:      '#888',
    fontSize:   '0.9rem',
    cursor:     'pointer',
    lineHeight: 1,
  },
  cardName: {
    margin:     '0 0 0.75rem',
    fontWeight: 700,
    fontSize:   '1rem',
    color:      '#111',
  },
  cardField: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '1px',
    marginBottom:  '0.5rem',
  },
  cardLabel: {
    fontSize:   '0.7rem',
    color:      '#888',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  cardValue: {
    fontSize: '0.85rem',
    color:    '#333',
  },
};
