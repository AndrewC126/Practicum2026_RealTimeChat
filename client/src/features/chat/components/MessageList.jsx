/**
 * MessageList — Scrollable Message Feed (US-203, US-302)
 *
 * Renders every message for the active room and handles three scrolling
 * behaviours that together satisfy the US-302 acceptance criteria:
 *
 *   AC4 — Auto-scroll when a new message arrives (while at the bottom)
 *   AC5 — Don't force-scroll when the user has scrolled up; show a button
 *
 * Props:
 *   messages  — array of message objects from useMessages / React Query cache
 *   isLoading — bool: true while the initial REST fetch is in flight
 *   isError   — bool: true if the REST fetch failed
 *   roomId    — the active room's UUID; used to reset scroll state on room switch
 *
 * ─── SMART SCROLL DESIGN ─────────────────────────────────────────────────────
 * The core challenge: how do we know whether the user is at the bottom?
 *
 * We listen to the container's 'scroll' event and compute:
 *
 *   distanceFromBottom = scrollHeight - scrollTop - clientHeight
 *
 *   scrollHeight  — total height of all content, including overflow (off-screen)
 *   scrollTop     — how many pixels the user has scrolled down from the top
 *   clientHeight  — the visible height of the element (the "viewport" of the list)
 *
 *   When distanceFromBottom ≈ 0, the user sees the bottom of the list.
 *   When it's large, they've scrolled up to read older messages.
 *
 * We treat "within 80px of the bottom" as "at bottom" so tiny accidental
 * scrolls don't trigger the notification button.
 *
 * ─── WHY A REF FOR isAtBottom, NOT STATE ─────────────────────────────────────
 * The scroll event can fire dozens of times per second. If we called setState
 * on every scroll event, React would re-render the entire component list on
 * every pixel of scroll — expensive and unnecessary.
 *
 * Instead we store the position in a ref:
 *   isAtBottomRef.current = true/false
 *
 * Refs are mutable objects that React doesn't watch. Changing .current never
 * triggers a re-render. We only use state (showNewButton) for the ONE thing
 * that actually needs to change what's rendered.
 *
 * ─── THREE EFFECTS ────────────────────────────────────────────────────────────
 *
 *   Effect 1 — Scroll listener (runs once on mount):
 *     Attaches to the scrollable div and keeps isAtBottomRef up-to-date.
 *     Returns a cleanup that removes the listener on unmount.
 *
 *   Effect 2 — Room switch reset (runs when roomId changes):
 *     When the user clicks a different room, we reset isAtBottomRef to true
 *     and jump instantly to the bottom of the new room's history.
 *     Without this, the scroll position from the previous room would carry
 *     over and the "New message" button might appear incorrectly.
 *
 *   Effect 3 — New message handler (runs when messages array changes):
 *     If at bottom → smoothly scroll to show the new message.
 *     If scrolled up → set showNewButton=true so the user knows new content
 *     arrived without disrupting their place in the history.
 *
 * ─── CSS LAYOUT STRUCTURE ────────────────────────────────────────────────────
 *
 *   <div style={{ flex:1, position:'relative', overflow:'hidden' }}>   ← outer
 *     <div ref={listRef} style={{ overflowY:'auto', height:'100%' }}>  ← scroller
 *       messages …
 *       <div ref={bottomRef} />                                        ← sentinel
 *     </div>
 *     {showNewButton && <button style={{ position:'absolute' }}>…}     ← float
 *   </div>
 *
 * outer      flex:1 to grow in the ChatPanel flex column.
 *            position:relative so the absolutely-positioned button is contained.
 *            overflow:hidden to clip any overflow from children.
 *
 * scroller   height:100% fills outer. overflowY:auto provides the scrollbar.
 *            minHeight:0 is inherited from outer which has minHeight:0 (via flex).
 *
 * The button is pinned to the bottom-center of the outer div with
 * position:absolute, bottom, left:50%, transform:translateX(-50%).
 */
import { useRef, useEffect, useState } from 'react';
import { useSelector }                 from 'react-redux';
import MessageItem                     from './MessageItem';

// How close to the bottom (in pixels) we consider "at bottom."
// 80 px gives a comfortable threshold so tiny accidental scrolls don't
// trigger the "New message" button.
const BOTTOM_THRESHOLD = 80;

export default function MessageList({ messages, isLoading, isError, roomId }) {
  // Read the current user's ID to determine which messages to right-align.
  const currentUserId = useSelector(state => state.auth.user?.id);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  // listRef   → the scrollable container div
  // bottomRef → the invisible sentinel at the end of the list
  // isAtBottomRef → tracks scroll position WITHOUT triggering re-renders
  const listRef       = useRef(null);
  const bottomRef     = useRef(null);
  const isAtBottomRef = useRef(true); // start true so initial load scrolls to bottom

  // ── State ─────────────────────────────────────────────────────────────────────
  // showNewButton is the ONLY piece of scroll state that affects rendering.
  // It becomes true when new messages arrive while the user is scrolled up.
  const [showNewButton, setShowNewButton] = useState(false);

  // ── Helper: scroll to the bottom sentinel ───────────────────────────────────
  // `behavior` is either 'smooth' (animated) or 'instant' (jump).
  // We use 'smooth' for new-message scrolls and 'instant' for room switches
  // so switching rooms feels like a page navigation, not a scroll animation.
  function scrollToBottom(behavior = 'smooth') {
    bottomRef.current?.scrollIntoView({ behavior });
  }

  // ── Effect 1: scroll listener ────────────────────────────────────────────────
  // Runs once on mount. Keeps isAtBottomRef.current in sync with the actual
  // scroll position of the container without causing re-renders.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    function handleScroll() {
      // How far the bottom of the content is from the visible bottom edge.
      // Formula breakdown:
      //   scrollHeight  = total height of all content (including overflow)
      //   scrollTop     = pixels scrolled from the top (0 when at top)
      //   clientHeight  = visible height of the container (constant unless resized)
      //
      // When scrollHeight === scrollTop + clientHeight, the user is exactly at
      // the bottom. distanceFromBottom would be 0.
      const distanceFromBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight;

      isAtBottomRef.current = distanceFromBottom < BOTTOM_THRESHOLD;

      // If the user scrolled back down to the bottom, hide the button.
      if (isAtBottomRef.current) {
        setShowNewButton(false);
      }
    }

    // `passive: true` tells the browser this handler never calls preventDefault().
    // The browser can then begin scrolling immediately without waiting for the
    // handler to finish — a meaningful performance improvement on mobile.
    list.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup: remove the listener when MessageList unmounts.
    // Without this, the handler would reference a DOM node that no longer exists.
    return () => list.removeEventListener('scroll', handleScroll);
  }, []); // empty array → runs once when the component mounts

  // ── Effect 2: reset scroll state when the room changes ──────────────────────
  // When the user clicks a different room in the sidebar, `roomId` changes.
  // If we didn't reset, `isAtBottomRef` might carry over the previous room's
  // scroll position (scrolled-up) and the new room would immediately show the
  // "New message" button even though no new messages have arrived.
  useEffect(() => {
    if (!roomId) return;

    // Reset to "at bottom" so Effect 3 will auto-scroll to the new room's
    // latest message when that room's data loads.
    isAtBottomRef.current = true;
    setShowNewButton(false);

    // Jump instantly (no animation) to the bottom.
    // Using 'instant' here feels like a page navigation rather than a scroll,
    // which matches the mental model of "switching to a new room."
    scrollToBottom('instant');
  }, [roomId]); // re-runs every time the user selects a different room

  // ── Effect 3: smart auto-scroll when messages change ────────────────────────
  // Fires whenever the messages array changes — i.e., when:
  //   a) The initial history loads (React Query resolves the fetch)
  //   b) A new 'new_message' socket event appends to the cache via useMessages
  //   c) An optimistic message from MessageInput is appended or replaced
  useEffect(() => {
    if (messages.length === 0) return; // nothing to scroll to yet

    if (isAtBottomRef.current) {
      // User is at or near the bottom — safe to auto-scroll.
      // This is the "happy path" AC4: the panel keeps up with the conversation.
      scrollToBottom('smooth');
    } else {
      // User has scrolled up to read older messages.
      // Auto-scrolling here would yank them away from where they're reading —
      // a very jarring UX. Instead, show the "New message ↓" button so they
      // know new content arrived and can choose when to scroll down.
      // This satisfies AC5.
      setShowNewButton(true);
    }
  }, [messages]);

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return <div style={styles.centeredOuter}><span style={styles.centerText}>Loading messages…</span></div>;
  }

  // ── Error state ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div style={styles.centeredOuter}>
        <span style={styles.centerText}>Could not load messages. Try again.</span>
      </div>
    );
  }

  // ── Empty state (room exists but no messages yet) ─────────────────────────────
  if (messages.length === 0) {
    return (
      <div style={styles.centeredOuter}>
        <span style={styles.centerText}>No messages yet — say hello!</span>
      </div>
    );
  }

  return (
    // ── Outer wrapper ──────────────────────────────────────────────────────────
    // position: 'relative' is required so the absolutely-positioned "New message"
    // button is contained within THIS div rather than the whole page.
    //
    // flex: 1 makes this grow to fill the space between the header and the
    // input box (ChatPanel is a flex column and this is the flex child that grows).
    //
    // overflow: 'hidden' clips the inner scrollable div to this boundary.
    // Without it, the inner div's scrollbar could extend outside the panel.
    //
    // minHeight: 0 is a flex-specific rule. By default a flex item's minimum
    // height is its content size, which prevents it from shrinking. Setting
    // minHeight: 0 allows the item to shrink below its content and lets the
    // inner div control the overflow properly.
    <div style={styles.outer}>

      {/* ── Scrollable inner container ── */}
      {/*
       * ref={listRef} so Effect 1 can attach the scroll listener.
       * height: '100%' fills the outer div.
       * overflowY: 'auto' provides a scrollbar only when content overflows.
       */}
      <div ref={listRef} style={styles.list}>

        {messages.map((message, index) => {
          // ── Grouping logic ─────────────────────────────────────────────────
          // Consecutive messages from the same sender are "grouped."
          // MessageItem uses this to hide the username on grouped messages,
          // matching the Slack/Discord visual style.
          // System messages always break a group.
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const isGrouped   =
            !!prevMessage &&
            prevMessage.sender_id      === message.sender_id &&
            !prevMessage.is_system_message &&
            !message.is_system_message;

          return (
            <MessageItem
              key={message.id}    // stable, unique key — DB UUID (or temp-* for optimistic)
              message={message}
              isOwn={message.sender_id === currentUserId}
              isGrouped={isGrouped}
            />
          );
        })}

        {/*
         * Sentinel div — zero size, invisible. Only purpose: be the target of
         * scrollIntoView() in scrollToBottom(). Placing it after the last
         * message ensures scrolling to it shows the newest message fully.
         */}
        <div ref={bottomRef} />

      </div>

      {/*
       * ── "New message ↓" button ────────────────────────────────────────────
       *
       * Shown only when showNewButton is true (new message arrived while the
       * user was scrolled up). The button floats over the bottom of the message
       * list via position:absolute.
       *
       * Why absolute positioning?
       *   The button sits OUTSIDE the scrollable div (listRef) so it doesn't
       *   scroll with the content — it stays pinned to the bottom of the outer
       *   div regardless of how far up the user has scrolled.
       *
       * Clicking it:
       *   1. Resets isAtBottomRef to true (so the next new message auto-scrolls)
       *   2. Hides the button
       *   3. Smoothly scrolls to the bottom sentinel
       */}
      {showNewButton && (
        <button
          onClick={() => {
            isAtBottomRef.current = true;
            setShowNewButton(false);
            scrollToBottom('smooth');
          }}
          style={styles.newMessageButton}
          aria-label="Scroll to new message"
        >
          New message ↓
        </button>
      )}

    </div>
  );
}

// ─── Style objects ────────────────────────────────────────────────────────────
const styles = {
  // Outer wrapper — grows in the ChatPanel flex column; contains the button
  outer: {
    flex:      1,
    position:  'relative', // required for absolute-positioned button
    overflow:  'hidden',
    minHeight: 0,          // allow flex shrinking (prevents content overflow)
  },

  // The actual scrollable list — fills the outer div
  list: {
    height:        '100%',
    overflowY:     'auto',
    display:       'flex',
    flexDirection: 'column',
    gap:           '0.1rem',
    padding:       '0.75rem 0',
  },

  // Reusable centered layout for loading / error / empty states.
  // These states also need flex:1 so ChatPanel's layout doesn't collapse.
  centeredOuter: {
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    minHeight:      0,
  },

  centerText: {
    color:    '#9ca3af',
    fontSize: '0.9rem',
  },

  // Floating "New message ↓" button
  //
  // position: 'absolute' pins it relative to the outer wrapper.
  // left: '50%' + transform: 'translateX(-50%)' centers it horizontally.
  // This is a common pattern for centering absolutely-positioned elements:
  //   left:50% moves the LEFT EDGE of the button to the center of the parent.
  //   translateX(-50%) then shifts the button LEFT by half its own width,
  //   centering it perfectly regardless of how wide the button is.
  newMessageButton: {
    position:     'absolute',
    bottom:       '1rem',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   '#3b82f6',       // blue-500
    color:        '#ffffff',
    border:       'none',
    borderRadius: '999px',         // pill shape
    padding:      '0.4rem 1.1rem',
    fontSize:     '0.8rem',
    fontWeight:   600,
    cursor:       'pointer',
    boxShadow:    '0 2px 8px rgba(0, 0, 0, 0.20)',
    // zIndex ensures the button sits above the scrollable content
    zIndex:       10,
    // Smooth appearance — fade in when React adds it to the DOM
    animation:    'fadeIn 0.15s ease',
    whiteSpace:   'nowrap',
  },
};
