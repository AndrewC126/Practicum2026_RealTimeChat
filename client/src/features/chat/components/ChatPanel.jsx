/**
 * ChatPanel — Main Chat Area (US-203, US-204)
 *
 * Rendered by the "/" route inside the protected Layout. It is the hub that
 * connects Redux state (which room is active) to the real-time message display.
 *
 * ─── DATA FLOW ───────────────────────────────────────────────────────────────
 *
 *   User clicks a room in the sidebar
 *       ↓
 *   RoomList dispatches setActiveRoom(roomId) → Redux updates activeRoomId
 *       ↓
 *   ChatPanel reads activeRoomId via useSelector
 *       ↓
 *   useMessages(activeRoomId)
 *     │  ├─ GET /api/rooms/:id/messages  (React Query — loads history)
 *     │  └─ socket.emit('join_room')     (Socket.io — subscribe to live updates)
 *     │       Server: socket.join(roomId) + optional system message broadcast
 *     │       Client: socket.on('new_message') → queryClient.setQueryData(append)
 *     └─ returns { messages, isLoading, isError }
 *       ↓
 *   <MessageList messages={messages} ... />
 *
 * ─── ROOM NAME IN HEADER ─────────────────────────────────────────────────────
 * useMessages only knows the roomId, not the room's name or description.
 * To show the name in the header we look up the room in the React Query cache:
 *
 *   queryClient.getQueryData(['rooms'])
 *
 * getQueryData() is a SYNCHRONOUS cache read — no network request. The rooms
 * list is already cached from the sidebar query (useRooms in RoomList), so
 * this is always fast. If the cache is empty for any reason we fall back to
 * showing "…" in the header.
 *
 * ─── LEAVE ROOM FLOW (US-204) ────────────────────────────────────────────────
 *
 *   1. User clicks "Leave Room" button in the header.
 *   2. window.confirm() shows a browser confirmation dialog.
 *      Using the native browser dialog keeps the code simple and avoids
 *      building a custom modal for a confirmation. It blocks execution until
 *      the user clicks OK or Cancel.
 *   3. On OK: await leaveRoom(activeRoomId)
 *      leaveRoom (from useRooms) emits the 'leave_room' socket event and waits
 *      for the server's acknowledgment before:
 *        a) Dispatching setActiveRoom(null) → ChatPanel shows the empty state
 *        b) Invalidating the ['rooms'] cache → sidebar refetches (room gone)
 *   4. isLeaving state prevents double-clicks and gives the user visual feedback.
 *
 * ─── EMPTY STATE ─────────────────────────────────────────────────────────────
 * If no room is selected (activeRoomId === null), we short-circuit and render
 * a friendly prompt. This means useMessages is called with null — which is
 * safe because it has the guard `enabled: !!roomId` that prevents any fetch
 * or socket emission when roomId is null.
 *
 * ─── LAYOUT (flex column) ────────────────────────────────────────────────────
 * Layout gives ChatPanel 100% of the remaining width and height via
 * <main style={{ flex: 1, overflow: 'auto' }}>.
 *
 * Internally we use a flex column so MessageList can grow to fill the space:
 *
 *   ┌─────────────────────────────────────────┐  ← ChatPanel (height: 100%)
 *   │  header  (room name + Leave button)     │  flexShrink: 0
 *   ├─────────────────────────────────────────┤
 *   │                                         │
 *   │  MessageList  (scrollable)              │  flex: 1  ← grows to fill
 *   │                                         │
 *   └─────────────────────────────────────────┘
 *
 *   MessageInput    ← will be added in US-301
 *   TypingIndicator ← added in US-303 (renders between MessageList and MessageInput)
 */
import { useState }       from 'react';
import { useSelector }    from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { selectActiveRoomId }  from '../../rooms/roomsSlice';
import { useRooms }            from '../../rooms/hooks/useRooms';
import { useMessages }         from '../hooks/useMessages';
import { useTyping }           from '../hooks/useTyping';
import MessageList             from './MessageList';
import MessageInput            from './MessageInput';
import TypingIndicator         from './TypingIndicator';

export default function ChatPanel() {
  // Read which room the user clicked in the sidebar.
  // selectActiveRoomId is a selector defined in roomsSlice:
  //   export const selectActiveRoomId = state => state.rooms.activeRoomId;
  const activeRoomId = useSelector(selectActiveRoomId);

  // leaveRoom is the function that emits the socket event and waits for the
  // server acknowledgment before updating local state.
  // We import it from useRooms (which also owns createRoom and the rooms list)
  // so all room mutations live in one hook.
  const { leaveRoom } = useRooms();

  // isLeaving tracks whether a leave request is in flight.
  // This prevents the user from clicking "Leave Room" multiple times while
  // waiting for the server acknowledgment, which would send duplicate events.
  const [isLeaving, setIsLeaving] = useState(false);

  // Look up the room's metadata from the React Query cache so we can display
  // the room name in the header without a separate network request.
  // getQueryData() is a synchronous read — no network request is made.
  const queryClient = useQueryClient();
  const rooms       = queryClient.getQueryData(['rooms']) ?? [];
  const activeRoom  = rooms.find(r => r.id === activeRoomId);

  // useMessages is always called — React hooks must be called unconditionally
  // (no early returns BEFORE hook calls). The hook itself guards against a
  // null roomId with `enabled: !!roomId`, so nothing happens when no room is
  // selected.
  const { messages, isLoading, isError } = useMessages(activeRoomId);

  // useTyping manages the debounced typing_start / typing_stop socket events
  // and listens for typing_update from other users (via Redux dispatch).
  //
  // onKeyDown (renamed typingKeyDown to avoid colliding with the prop name):
  //   Passed to MessageInput's onKeyDown prop. Called on every keystroke to
  //   emit typing_start (once per session) and reset the 3-second stop timer.
  //
  // stopTyping:
  //   Passed to MessageInput's onAfterSend prop. Called immediately when the
  //   user clicks the Send button so the indicator clears without waiting for
  //   the 3-second debounce timer to fire.
  //
  // Called unconditionally (hook rule). When activeRoomId is null, useTyping
  // guards internally with `if (!socket || !roomId) return`.
  const { onKeyDown: typingKeyDown, stopTyping } = useTyping(activeRoomId);

  // ── Leave handler ─────────────────────────────────────────────────────────
  async function handleLeaveRoom() {
    // window.confirm() opens a native browser dialog and returns:
    //   true  — the user clicked "OK" (confirm)
    //   false — the user clicked "Cancel" or closed the dialog
    // This is the simplest way to get confirmation without a custom modal.
    const confirmed = window.confirm(
      `Leave #${activeRoom?.name ?? 'this room'}? You can rejoin later.`
    );
    if (!confirmed) return; // user cancelled — do nothing

    setIsLeaving(true);
    try {
      // await leaveRoom so we know when the server acknowledgment arrives.
      // leaveRoom internally:
      //   1. Emits 'leave_room' socket event
      //   2. Waits for ack({ ok: true }) from the server
      //   3. Dispatches setActiveRoom(null) → causes the empty state to show
      //   4. Invalidates ['rooms'] cache → sidebar refetches without this room
      await leaveRoom(activeRoomId);
      // No need to setIsLeaving(false) here — the component unmounts this
      // panel's room view once activeRoomId becomes null, so the state reset
      // is irrelevant. But we add it in case of errors (the catch below).
    } catch (err) {
      console.error('Leave room failed:', err);
      // Show a simple alert if the leave fails.
      // A future improvement would show an inline error banner instead.
      alert('Could not leave the room. Please try again.');
      setIsLeaving(false);
    }
  }

  // ── Empty state: no room selected ────────────────────────────────────────
  // Show this AFTER all hooks have been called (React rule: hooks must be
  // called before any early return — you cannot call hooks conditionally).
  if (!activeRoomId) {
    return (
      <div style={styles.empty}>
        <p>Select a room from the sidebar to start chatting.</p>
      </div>
    );
  }

  // ── Normal state: a room is selected ─────────────────────────────────────
  return (
    <div style={styles.panel}>

      {/* ── Header ── */}
      <header style={styles.header}>

        {/* Room name and optional description */}
        <div style={styles.headerLeft}>
          {/*
           * activeRoom?.name — optional chaining handles the brief moment where
           * the room list cache might be empty (e.g., hard refresh).
           * Falls back to "…" as a placeholder.
           */}
          <span style={styles.roomName}>
            # {activeRoom?.name ?? '…'}
          </span>
          {activeRoom?.description && (
            <span style={styles.description}>{activeRoom.description}</span>
          )}
        </div>

        {/*
         * Leave Room button (US-204 AC: "A Leave Room option is accessible
         * while inside a room").
         *
         * disabled={isLeaving} prevents double-clicks while the socket event
         * is in flight. The button label changes to give visual feedback.
         *
         * style={{ opacity }} visually dims the button while in flight so the
         * user knows something is happening.
         */}
        <button
          onClick={handleLeaveRoom}
          disabled={isLeaving}
          style={{ ...styles.leaveButton, opacity: isLeaving ? 0.6 : 1 }}
          title="Leave this room"
        >
          {isLeaving ? 'Leaving…' : 'Leave Room'}
        </button>

      </header>

      {/*
       * MessageList receives all message state from useMessages.
       * It owns scrolling, loading, and error display internally.
       * ChatPanel just passes the data through — separation of concerns.
       */}
      {/*
       * roomId is passed so MessageList can reset its scroll position
       * when the user switches to a different room (US-302 AC5).
       * Without it, the scroll state from the previous room would carry over.
       */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        isError={isError}
        roomId={activeRoomId}
      />

      {/*
       * TypingIndicator (US-303) — the "Alice is typing…" bar.
       *
       * Sits between the message list and the input box.
       * Returns null when no one is typing, so it takes zero height in that case —
       * the layout doesn't shift when it appears or disappears.
       *
       * It reads typing state from Redux (populated by useTyping's
       * 'typing_update' listener above), so it re-renders automatically when
       * someone starts or stops typing.
       */}
      <TypingIndicator roomId={activeRoomId} />

      {/*
       * MessageInput lives at the bottom of the flex column.
       * It has flexShrink: 0 so it never gets compressed by the message list.
       *
       * onKeyDown={typingKeyDown}  — fires on every keystroke to emit typing_start
       *   and reset the 3-second stop timer (US-303).
       *
       * onAfterSend={stopTyping}  — fires when the message is submitted (Enter or
       *   Send button), immediately stopping the indicator without waiting for the
       *   3-second debounce timer (US-303 AC: "indicator clears when message sent").
       */}
      <MessageInput
        roomId={activeRoomId}
        onKeyDown={typingKeyDown}
        onAfterSend={stopTyping}
      />

    </div>
  );
}

// ─── Style objects ────────────────────────────────────────────────────────────
const styles = {
  // Full-height flex column — fills the <main> element from Layout
  panel: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100%',
    overflow:      'hidden',  // children (MessageList) manage their own overflow
    background:    '#ffffff',
  },

  // Header bar — fixed height, does not shrink when the list grows
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',  // push Leave button to the far right
    gap:            '0.75rem',
    padding:        '0.75rem 1.25rem',
    borderBottom:   '1px solid #e5e7eb',
    flexShrink:     0,  // prevent this from being squeezed by MessageList
    background:     '#ffffff',
  },

  // Left side of header: room name + description stacked
  headerLeft: {
    display:    'flex',
    alignItems: 'baseline',
    gap:        '0.75rem',
    minWidth:   0,  // allow text to truncate instead of overflowing
  },

  roomName: {
    fontWeight:   700,
    fontSize:     '1rem',
    color:        '#111827',
    whiteSpace:   'nowrap',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
  },

  description: {
    fontSize:     '0.85rem',
    color:        '#6b7280',
    whiteSpace:   'nowrap',
    overflow:     'hidden',
    textOverflow: 'ellipsis',
  },

  // Leave Room button — subtle destructive styling (red text, no fill)
  // A fill would be too alarming for a common action. The red text signals
  // "this is a destructive action" without dominating the header visually.
  leaveButton: {
    padding:      '0.3rem 0.75rem',
    background:   'transparent',
    color:        '#ef4444',        // Tailwind red-500
    border:       '1px solid #ef4444',
    borderRadius: '4px',
    fontSize:     '0.8rem',
    cursor:       'pointer',
    flexShrink:   0,  // never shrink below its natural size
    transition:   'opacity 0.15s',
  },

  // Shown when no room is selected
  empty: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    height:         '100%',
    color:          '#9ca3af',
    fontSize:       '0.95rem',
  },
};
