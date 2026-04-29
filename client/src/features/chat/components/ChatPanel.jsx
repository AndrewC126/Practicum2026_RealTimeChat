/**
 * ChatPanel — Main Chat Area (US-203)
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
 *       ↓  (maps each message to)
 *   <MessageItem message={msg} isOwn={...} />
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
 * ─── LAYOUT (flex column) ────────────────────────────────────────────────────
 * Layout gives ChatPanel 100% of the remaining width and height via
 * <main style={{ flex: 1, overflow: 'auto' }}>.
 *
 * Internally we use a flex column so MessageList can grow to fill the space:
 *
 *   ┌─────────────────────────────────────────┐  ← ChatPanel (height: 100%)
 *   │  header  (room name + description)      │  flexShrink: 0
 *   ├─────────────────────────────────────────┤
 *   │                                         │
 *   │  MessageList  (scrollable)              │  flex: 1  ← grows to fill
 *   │                                         │
 *   └─────────────────────────────────────────┘
 *
 *   MessageInput  ← will be added in US-301
 *   TypingIndicator  ← will be added in US-303
 *
 * ─── EMPTY STATE ─────────────────────────────────────────────────────────────
 * If no room is selected (activeRoomId === null), we short-circuit and render
 * a friendly prompt. This means useMessages is called with null — which is
 * safe because it has the guard `enabled: !!roomId` that prevents any fetch
 * or socket emission when roomId is null.
 */
import { useSelector }    from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { selectActiveRoomId }  from '../../rooms/roomsSlice';
import { useMessages }         from '../hooks/useMessages';
import MessageList             from './MessageList';

export default function ChatPanel() {
  // Read which room the user clicked in the sidebar.
  // selectActiveRoomId is a selector defined in roomsSlice:
  //   export const selectActiveRoomId = state => state.rooms.activeRoomId;
  // Using a named selector means if we ever rename the Redux key, we only
  // update roomsSlice.js — not every component that uses it.
  const activeRoomId = useSelector(selectActiveRoomId);

  // Look up the room's metadata from the React Query cache so we can display
  // the room name in the header without a separate network request.
  // The rooms list was already fetched by RoomList (useRooms hook) and stored
  // under the key ['rooms']. getQueryData() reads it synchronously.
  const queryClient = useQueryClient();
  const rooms       = queryClient.getQueryData(['rooms']) ?? [];
  const activeRoom  = rooms.find(r => r.id === activeRoomId);

  // useMessages is always called — React hooks must be called unconditionally
  // (no early returns BEFORE hook calls). The hook itself guards against a
  // null roomId with `enabled: !!roomId`, so nothing happens when no room is
  // selected.
  const { messages, isLoading, isError } = useMessages(activeRoomId);

  // ── Empty state: no room selected ────────────────────────────────────────
  // Show this AFTER all hooks have been called (React rule: hooks before
  // any early return).
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
        {/*
         * activeRoom?.name — optional chaining handles the brief moment where
         * the room list cache might be empty (e.g., hard refresh with a URL
         * that has no sidebar data yet). Falls back to "…" as a placeholder.
         */}
        <span style={styles.roomName}>
          # {activeRoom?.name ?? '…'}
        </span>

        {/* Description is optional — only render the element if it exists */}
        {activeRoom?.description && (
          <span style={styles.description}>{activeRoom.description}</span>
        )}
      </header>

      {/*
       * MessageList receives all message state from useMessages.
       * It owns scrolling, loading, and error display internally.
       * ChatPanel just passes the data through — separation of concerns.
       */}
      <MessageList
        messages={messages}
        isLoading={isLoading}
        isError={isError}
      />

      {/* US-301: <MessageInput roomId={activeRoomId} /> */}
      {/* US-303: <TypingIndicator roomId={activeRoomId} /> */}

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
    display:       'flex',
    alignItems:    'baseline',
    gap:           '0.75rem',
    padding:       '0.75rem 1.25rem',
    borderBottom:  '1px solid #e5e7eb',
    flexShrink:    0,          // prevent this from being squeezed by MessageList
    background:    '#ffffff',
  },

  roomName: {
    fontWeight: 700,
    fontSize:   '1rem',
    color:      '#111827',
  },

  description: {
    fontSize: '0.85rem',
    color:    '#6b7280',
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
