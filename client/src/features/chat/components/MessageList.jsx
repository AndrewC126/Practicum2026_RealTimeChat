/**
 * MessageList — Scrollable Message Feed (US-203)
 *
 * Receives the full array of messages for the active room and renders each
 * one as a <MessageItem />. Handles auto-scrolling, loading, and error states.
 *
 * Props:
 *   messages  — array of message objects from useMessages / React Query cache
 *   isLoading — bool: true while the initial REST fetch is in flight
 *   isError   — bool: true if the REST fetch failed
 *
 * ─── AUTO-SCROLL TO BOTTOM ───────────────────────────────────────────────────
 * Every time a new message arrives (or the initial history loads), we want to
 * scroll the list so the newest message is visible. The technique:
 *
 *   Step 1 — Place a hidden <div ref={bottomRef} /> at the END of the list.
 *             This div has no visual appearance; it's just a DOM anchor.
 *
 *   Step 2 — In a useEffect that depends on [messages], call:
 *               bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
 *             scrollIntoView() is a built-in browser DOM method. It walks up
 *             the DOM tree to find the nearest scrollable ancestor and scrolls
 *             it until the target element is visible. { behavior: 'smooth' }
 *             animates the scroll instead of jumping.
 *
 *   Step 3 — When the component re-renders because messages changed (new
 *             message appended by useMessages), the effect fires again and
 *             scrolls to the sentinel div — i.e., to the bottom.
 *
 * ─── useRef ──────────────────────────────────────────────────────────────────
 * useRef() returns an object with a single property: { current: null }.
 * When you attach it to a JSX element with ref={bottomRef}, React sets
 * bottomRef.current = <the actual DOM node> after the element mounts.
 *
 * Crucially, CHANGING .current does NOT cause a re-render — that's what
 * makes refs the right tool for DOM access vs useState.
 *
 * ─── MESSAGE GROUPING ────────────────────────────────────────────────────────
 * To reduce visual noise (like Discord / Slack do), we detect consecutive
 * messages from the same sender and mark them "grouped." We compare:
 *   messages[i].sender_id === messages[i - 1].sender_id
 *
 * A grouped message can suppress the username label in MessageItem.
 * System messages are never grouped with regular messages.
 *
 * ─── isOwn ───────────────────────────────────────────────────────────────────
 * MessageItem needs to know which messages to right-align. We read the
 * current user's ID from Redux here and pass `isOwn` as a prop so MessageItem
 * can remain a simple presentational component with no Redux dependency.
 *
 * Note: after a page refresh, state.auth.user is null (the token is restored
 * from localStorage but the user object is not). In that case currentUserId
 * is undefined and isOwn is always false — own messages will appear on the
 * left until the user logs out and back in. This is an acceptable trade-off
 * for this milestone; a future improvement would decode the JWT payload on
 * the client to extract the user ID without a server round-trip.
 */
import { useRef, useEffect } from 'react';
import { useSelector }       from 'react-redux';
import MessageItem           from './MessageItem';

export default function MessageList({ messages, isLoading, isError }) {
  // Read the logged-in user's ID so we can flag own messages for right-alignment.
  // The optional-chaining (?.) safely returns undefined when user is null.
  const currentUserId = useSelector(state => state.auth.user?.id);

  // bottomRef.current will hold the DOM node of the sentinel <div> at the
  // bottom of the list. React sets it automatically when the div mounts.
  const bottomRef = useRef(null);

  // ── Effect: scroll to the bottom whenever messages changes ────────────────
  // [messages] in the dependency array means this effect re-runs every time
  // the messages array reference changes — which happens when:
  //   a) The initial history loads (React Query resolves the fetch)
  //   b) A new 'new_message' socket event appends to the cache
  //
  // The ?. optional chaining handles the first render where the ref might
  // not yet be attached (though in practice it always is by the time data loads).
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Loading state ──────────────────────────────────────────────────────────
  // isLoading is true on the very first fetch for a room (before any data is
  // cached). After that, React Query returns the stale data immediately while
  // refetching in the background, so this spinner rarely shows.
  if (isLoading) {
    return <div style={styles.center}>Loading messages…</div>;
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div style={styles.center}>Could not load messages. Try again.</div>
    );
  }

  // ── Empty state (room exists but no messages yet) ──────────────────────────
  if (messages.length === 0) {
    return (
      <div style={styles.center}>No messages yet — say hello!</div>
    );
  }

  return (
    // This div must be scrollable and fill all available vertical space.
    //
    // flex: 1  — grow to fill the space between the header and the input box
    //            (ChatPanel is a flex column; this is the flex child that grows).
    // overflowY: 'auto'  — show a scrollbar only when content exceeds the height.
    // flexDirection: 'column' + display: 'flex' — stack messages top-to-bottom.
    <div style={styles.list}>

      {messages.map((message, index) => {
        // ── Grouping logic ───────────────────────────────────────────────────
        // The first message (index 0) has no predecessor, so it's never grouped.
        // System messages break a group — a normal message after a system message
        // is NOT considered grouped even if it's from the same sender.
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const isGrouped   =
          !!prevMessage &&
          prevMessage.sender_id  === message.sender_id &&
          !prevMessage.is_system_message &&
          !message.is_system_message;

        return (
          <MessageItem
            key={message.id}           // key must be stable & unique — DB id is ideal
            message={message}
            isOwn={message.sender_id === currentUserId}
            isGrouped={isGrouped}
          />
        );
      })}

      {/*
       * Sentinel div — zero height, zero width, invisible.
       * Its only purpose is to be the scrollIntoView() target above.
       * Placing it AFTER the last message means scrolling to it puts the
       * newest message fully in view.
       */}
      <div ref={bottomRef} />

    </div>
  );
}

// ─── Style objects ────────────────────────────────────────────────────────────
const styles = {
  list: {
    flex:          1,           // grow to fill remaining height in ChatPanel
    overflowY:     'auto',      // scrollable
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.1rem',
    padding:       '0.75rem 0',
  },
  center: {
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    color:          '#9ca3af',
    fontSize:       '0.9rem',
  },
};
