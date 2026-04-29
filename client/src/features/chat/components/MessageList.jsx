/**
 * MessageList — Scrollable Message Feed (US-203, US-302, US-502)
 *
 * Renders every message for the active room and handles four scroll behaviours:
 *
 *   Effect 1 — Scroll listener (runs once on mount):
 *     Attaches to the container and keeps isAtBottomRef up-to-date.
 *     Returns a cleanup that removes the listener on unmount.
 *
 *   Effect 2 — Room switch reset (runs when roomId changes):
 *     Resets isAtBottomRef to true and jumps to the bottom of the new room.
 *     Without this, stale scroll state from the previous room would carry over.
 *
 *   Effect 3 — New message handler (runs when messages array changes):
 *     If at bottom → smoothly scroll to the new message (AC4 of US-302).
 *     If scrolled up → show "New message ↓" button (AC5 of US-302).
 *     Skips this logic when we are in the middle of loading OLDER messages,
 *     because loading older messages prepends content rather than appending it.
 *
 *   Effect 4 — Scroll position preservation (US-502 AC3):
 *     After "Load older messages" resolves and React has painted the DOM,
 *     restores the viewport to the same visual position the user was at
 *     BEFORE the new content was prepended.
 *
 * ─── WHY SCROLL POSITION BREAKS WITHOUT EFFECT 4 ────────────────────────────
 * When older messages are prepended, the list's scrollHeight grows.
 * Example:
 *   Before load: scrollHeight=1000, scrollTop=0 (user scrolled to the top)
 *   After  load: scrollHeight=1500 (500px of new messages inserted above)
 *   Without fix: scrollTop stays 0 → user is still "at the top" but the top
 *                is now 500px higher than where they were reading → content jumps
 *   With    fix: new scrollTop = 1500 - 1000 = 500 → same messages visible ✓
 *
 * ─── WHY useLayoutEffect FOR EFFECT 4, NOT useEffect ─────────────────────────
 * Both fire after React mutates the DOM, but:
 *   useEffect      runs AFTER the browser has painted (user sees the jump first)
 *   useLayoutEffect runs BEFORE the browser paints (jump is invisible to the user)
 *
 * For scroll corrections we always use useLayoutEffect so the position change
 * is applied before any pixels hit the screen.
 *
 * ─── DETECTING THE true→false TRANSITION OF isFetchingNextPage ───────────────
 * React Query's isFetchingNextPage goes:
 *   false → true  (fetch starts)
 *   true  → false (fetch ends, new data is in the DOM)
 *
 * We need to fire the scroll correction only on the true→false transition
 * (data just arrived). We track the previous value with prevIsFetchingRef.
 * When prevIsFetchingRef.current===true AND isFetchingNextPage===false,
 * we know older messages just finished loading.
 *
 * ─── isLoadingOlderRef — suppressing the "New message" button ────────────────
 * Effect 3 fires whenever `messages` changes. Older messages loading also
 * changes `messages`, so without a guard, Effect 3 would show the "New message"
 * button when the user is scrolled up and older messages arrive — even though
 * those messages are NOT new (they are older than everything already shown).
 *
 * isLoadingOlderRef.current is set to true when the user clicks "Load older"
 * and cleared in Effect 4 after the scroll correction is applied. Effect 3
 * checks this flag and returns early, preventing the false positive.
 *
 * ─── EFFECT ORDERING MATTERS ─────────────────────────────────────────────────
 * When older messages load, both Effect 3 (deps: [messages]) and Effect 4
 * (deps: [isFetchingNextPage]) fire in the SAME render pass because both
 * dependencies changed. React runs effects in the order they are defined.
 * Effect 3 MUST be defined before Effect 4 so:
 *   1. Effect 3 runs first, sees isLoadingOlderRef=true, returns early ✓
 *   2. Effect 4 runs, applies scroll correction, resets isLoadingOlderRef ✓
 * Reversing this order would let Effect 3 show the "New message" button before
 * Effect 4 clears the flag.
 *
 * ─── SMART SCROLL DESIGN ─────────────────────────────────────────────────────
 * The core challenge: how do we know whether the user is at the bottom?
 *
 * We listen to the container's 'scroll' event and compute:
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
 * ─── WHY REFS FOR isAtBottom, isLoadingOlder, NOT STATE ─────────────────────
 * These values are read and written inside event handlers and effects — not
 * in JSX. Updating them must NEVER cause a re-render (re-rendering would
 * reset scroll position). Refs give us mutable slots that React ignores.
 *
 * ─── CSS LAYOUT STRUCTURE ────────────────────────────────────────────────────
 *
 *   <div style={{ flex:1, position:'relative', overflow:'hidden' }}>   ← outer
 *     <div ref={listRef} style={{ overflowY:'auto', height:'100%' }}>  ← scroller
 *       [ Load older button | Beginning label | loading spinner ]      ← top items
 *       messages …
 *       <div ref={bottomRef} />                                        ← sentinel
 *     </div>
 *     {showNewButton && <button style={{ position:'absolute' }}>…}     ← float
 *   </div>
 *
 * Props:
 *   messages          — flat array of message objects, oldest-first
 *   isLoading         — true while the initial REST fetch is in flight
 *   isError           — true if the initial REST fetch failed
 *   roomId            — active room's UUID; used to reset scroll on room switch
 *   fetchNextPage     — React Query function to load the next older batch
 *   hasNextPage       — true when older messages still exist in the DB
 *   isFetchingNextPage — true while the "load older" fetch is in flight
 */
import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { useSelector }                                  from 'react-redux';
import MessageItem                                      from './MessageItem';

// How close to the bottom (in pixels) we consider "at bottom."
// 80 px gives a comfortable threshold so tiny accidental scrolls don't
// trigger the "New message" button.
const BOTTOM_THRESHOLD = 80;

export default function MessageList({
  messages,
  isLoading,
  isError,
  roomId,
  // ── US-502 props ─────────────────────────────────────────────────────────
  // Safe defaults mean this component still renders correctly if a parent
  // doesn't pass these (e.g., in an error or loading branch of ChatPanel).
  fetchNextPage      = () => {},
  hasNextPage        = false,
  isFetchingNextPage = false,
}) {
  // Read the current user's ID to determine which messages to right-align.
  const currentUserId = useSelector(state => state.auth.user?.id);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  // listRef        → the scrollable container div (used for scrollTop manipulation)
  // bottomRef      → invisible sentinel at the end; target of scrollIntoView()
  // isAtBottomRef  → tracks scroll position WITHOUT triggering re-renders
  const listRef       = useRef(null);
  const bottomRef     = useRef(null);
  const isAtBottomRef = useRef(true); // start true so initial load scrolls to bottom

  // prevScrollHeightRef — captures scrollHeight BEFORE "Load older" fires.
  // After the new older messages are painted, Effect 4 reads the new
  // scrollHeight, computes the diff, and adjusts scrollTop.
  // null means no correction is pending.
  const prevScrollHeightRef = useRef(null);

  // isLoadingOlderRef — a flag that tells Effect 3 to skip the "New message"
  // button logic when older messages (not new real-time messages) are the
  // reason messages changed. Set to true in handleLoadOlderClick, cleared in
  // Effect 4 after the scroll correction.
  const isLoadingOlderRef = useRef(false);

  // prevIsFetchingRef — remembers the previous value of isFetchingNextPage so
  // Effect 4 can detect the true→false transition (fetch completed).
  // Initialised to false to match React Query's initial state.
  const prevIsFetchingRef = useRef(false);

  // ── State ─────────────────────────────────────────────────────────────────────
  // showNewButton is the ONLY piece of scroll state that affects rendering.
  // It becomes true when new messages arrive while the user is scrolled up.
  const [showNewButton, setShowNewButton] = useState(false);

  // ── Helper: scroll to the bottom sentinel ─────────────────────────────────────
  // `behavior` is either 'smooth' (animated) or 'instant' (jump).
  function scrollToBottom(behavior = 'smooth') {
    bottomRef.current?.scrollIntoView({ behavior });
  }

  // ── handleLoadOlderClick — triggered by the "Load older messages" button ──────
  // Three things happen in sequence:
  //   1. Capture the current scrollHeight BEFORE React adds the new content.
  //      We need this baseline to compute how much the list grew after loading.
  //   2. Set the isLoadingOlder flag so Effect 3 skips the "New message" logic.
  //   3. Ask React Query to fetch the next older page (increases offset by 50).
  function handleLoadOlderClick() {
    if (!listRef.current) return;

    // scrollHeight is the total pixel height of all content in the scrollable
    // div, including the part that's off-screen above and below the viewport.
    // We save it now because once React re-renders with the new messages,
    // scrollHeight will be larger — we need the old value to compute the delta.
    prevScrollHeightRef.current = listRef.current.scrollHeight;

    // Flag Effect 3 to return early. If the user scrolled up to find the
    // "Load older" button, isAtBottomRef.current is false. Without this guard,
    // Effect 3 would see the messages array grow and immediately show the
    // "New message ↓" button — even though the arriving messages are OLD.
    isLoadingOlderRef.current = true;

    // Ask React Query to fetch the next page (older batch).
    // This sets isFetchingNextPage=true and eventually adds a new entry to
    // data.pages, which makes `messages` in ChatPanel grow with older items.
    fetchNextPage();
  }

  // ── Effect 1: scroll listener ─────────────────────────────────────────────────
  // Runs once on mount. Keeps isAtBottomRef.current in sync with the actual
  // scroll position of the container without causing re-renders.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    function handleScroll() {
      // distanceFromBottom tells us how many pixels of content are BELOW the
      // currently visible area.
      //
      //   scrollHeight  = total height of all content
      //   scrollTop     = pixels scrolled from the very top (0 when at the top)
      //   clientHeight  = visible height (the "viewport" of the list)
      //
      // When the user is exactly at the bottom: scrollTop + clientHeight === scrollHeight
      // so distanceFromBottom === 0.
      const distanceFromBottom =
        list.scrollHeight - list.scrollTop - list.clientHeight;

      isAtBottomRef.current = distanceFromBottom < BOTTOM_THRESHOLD;

      // If the user scrolled back down to the bottom, hide the notification button.
      if (isAtBottomRef.current) {
        setShowNewButton(false);
      }
    }

    // `passive: true` tells the browser this listener never calls preventDefault().
    // The browser can start scrolling immediately without waiting for the handler
    // to finish — a meaningful performance gain on mobile devices.
    list.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup: remove the listener when MessageList unmounts so we don't hold
    // a reference to a DOM node that no longer exists.
    return () => list.removeEventListener('scroll', handleScroll);
  }, []); // empty deps — runs once on mount

  // ── Effect 2: reset scroll state when the room changes ────────────────────────
  // When the user picks a different room, roomId changes.
  // Without this reset, stale scroll state from the previous room would persist
  // and the "New message" button might appear incorrectly in the new room.
  useEffect(() => {
    if (!roomId) return;

    isAtBottomRef.current = true;
    setShowNewButton(false);

    // 'instant' feels like a page navigation (no animation) — appropriate for
    // switching between rooms rather than scrolling within one.
    scrollToBottom('instant');
  }, [roomId]);

  // ── Effect 3: smart auto-scroll when messages change ──────────────────────────
  // Fires whenever the messages array changes — i.e., when:
  //   a) The initial history loads (React Query resolves the first REST fetch)
  //   b) A new 'new_message' socket event appends to the cache
  //   c) Older messages are prepended (US-502 "Load older" fetch resolves)
  //
  // For case (c) we SKIP this effect entirely: the user is scrolled up (they
  // clicked "Load older"), so isAtBottomRef is false. Without the guard we'd
  // show the "New message ↓" button for messages that are actually OLD.
  // isLoadingOlderRef is cleared by Effect 4 after the scroll correction.
  //
  // IMPORTANT: This effect must be defined BEFORE Effect 4. React runs effects
  // in definition order within the same render. When older messages load, both
  // effects fire in the same pass — Effect 3 must see isLoadingOlderRef=true
  // (set in handleLoadOlderClick) and return early BEFORE Effect 4 clears it.
  useEffect(() => {
    if (messages.length === 0) return;

    // Guard: older messages just loaded — Effect 4 will handle scroll,
    // so we must not interfere here by showing the "New message" button.
    if (isLoadingOlderRef.current) return;

    if (isAtBottomRef.current) {
      // User is at or near the bottom — safe to auto-scroll.
      // This keeps the chat "pinned to the bottom" as new messages arrive.
      scrollToBottom('smooth');
    } else {
      // User has scrolled up to read history.
      // Auto-scrolling here would yank them away from where they're reading.
      // Instead, show the "New message ↓" button so they can choose when to scroll.
      setShowNewButton(true);
    }
  }, [messages]);

  // ── Effect 4: restore scroll position after older messages load (US-502 AC3) ──
  //
  // When does this fire?
  //   React re-renders whenever isFetchingNextPage changes. This effect detects
  //   the true→false transition (the fetch just finished) by comparing the
  //   current value with the previous value stored in prevIsFetchingRef.
  //
  // Why useLayoutEffect instead of useEffect?
  //   useLayoutEffect fires synchronously AFTER React mutates the DOM but
  //   BEFORE the browser paints those changes to the screen.
  //   This means we adjust scrollTop while the frame is still being composed —
  //   the user never sees the "jump" that would be visible with useEffect.
  //
  // How the scroll correction works:
  //   Before the fetch: prevScrollHeightRef.current = 1000 (captured in handler)
  //   After  the fetch: list.scrollHeight = 1500 (new content was added above)
  //   Correction:       list.scrollTop = 1500 - 1000 = 500
  //
  //   Why does setting scrollTop = (newHeight - oldHeight) keep the same content
  //   visible? Because the new messages were inserted at the TOP of the list.
  //   That shifts all existing content DOWN by exactly (newHeight - oldHeight)
  //   pixels. Adding that same amount to scrollTop cancels the shift.
  useLayoutEffect(() => {
    const list = listRef.current;

    // Detect the isFetchingNextPage transition: true → false.
    // When isFetchingNextPage goes true (fetch started), prevIsFetchingRef is still
    // false, so justFinishedLoading = false → we skip. On the next render where it
    // goes false (fetch done), prevIsFetchingRef is true → justFinishedLoading = true.
    const justFinishedLoading = prevIsFetchingRef.current && !isFetchingNextPage;

    // Always keep prevIsFetchingRef up-to-date for the NEXT render.
    prevIsFetchingRef.current = isFetchingNextPage;

    // Only apply the correction when:
    //   1. The fetch JUST completed (true→false transition)
    //   2. We actually saved a baseline scroll height (handleLoadOlderClick ran)
    //   3. The DOM ref is available
    if (!justFinishedLoading || prevScrollHeightRef.current === null || !list) {
      return;
    }

    // scrollHeight has grown. The difference is exactly the height of the new
    // older messages that were inserted above the current viewport.
    // Adding this delta to scrollTop keeps the same messages visible.
    const scrollHeightDiff = list.scrollHeight - prevScrollHeightRef.current;
    list.scrollTop = scrollHeightDiff;

    // Reset both flags now that the correction is applied.
    // Next "Load older" click will set them again.
    prevScrollHeightRef.current = null;
    isLoadingOlderRef.current   = false;
  }, [isFetchingNextPage]); // re-run only when isFetchingNextPage changes

  // ── Loading state ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={styles.centeredOuter}>
        <span style={styles.centerText}>Loading messages…</span>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div style={styles.centeredOuter}>
        <span style={styles.centerText}>Could not load messages. Try again.</span>
      </div>
    );
  }

  // ── Empty state (room exists but no messages yet) ──────────────────────────────
  if (messages.length === 0) {
    return (
      <div style={styles.centeredOuter}>
        <span style={styles.centerText}>No messages yet — say hello!</span>
      </div>
    );
  }

  return (
    // ── Outer wrapper ────────────────────────────────────────────────────────────
    // position:'relative' contains the absolutely-positioned "New message" button.
    // flex:1 grows to fill the space between the room header and the input box.
    // overflow:'hidden' prevents the inner scrollbar from bleeding outside.
    // minHeight:0 allows flex shrinking below content size (flex layout quirk).
    <div style={styles.outer}>

      {/* ── Scrollable inner container ── */}
      {/*
       * ref={listRef} so Effect 1 can attach the scroll listener and Effects 2/4
       * can read/write scrollTop and scrollHeight.
       */}
      <div ref={listRef} style={styles.list}>

        {/*
         * ── Top-of-history controls (US-502) ──────────────────────────────────
         *
         * These items render at the very top of the scrollable content, ABOVE all
         * messages. The user sees them only after scrolling to the top.
         *
         * Three mutually exclusive states:
         *
         *   isFetchingNextPage === true
         *     A "load older" fetch is in flight. Show a subtle spinner text so the
         *     user knows something is happening and doesn't click the button again.
         *     The button is hidden to prevent duplicate requests.
         *
         *   hasNextPage === true (and not currently fetching)
         *     More history exists. Show the "Load older messages" button.
         *     When clicked → handleLoadOlderClick() → fetchNextPage().
         *
         *   hasNextPage === false
         *     React Query confirmed there are no more older messages (the last
         *     "load older" fetch returned fewer than 50 messages).
         *     Show "Beginning of conversation" to close the mental loop for the user.
         *     We guard with messages.length > 0 so this never shows in the empty state.
         */}

        {/* Loading spinner — shown while the older-messages fetch is in flight */}
        {isFetchingNextPage && (
          <div style={styles.loadingOlder}>
            Loading older messages…
          </div>
        )}

        {/* "Load older messages" button — shown when more history exists */}
        {hasNextPage && !isFetchingNextPage && (
          <button
            onClick={handleLoadOlderClick}
            style={styles.loadOlderButton}
          >
            Load older messages
          </button>
        )}

        {/*
         * "Beginning of conversation" label.
         *
         * Shown when hasNextPage is false AND we actually have messages.
         * (If we had 0 messages, the empty-state branch above would have
         * returned already, so this guard is technically redundant but
         * adds clarity when reading the code.)
         *
         * Why show this at all?
         *   Without it, the user would scroll to the top, see the oldest message,
         *   and wonder: "Is this really the start? Did the load fail?" The label
         *   gives a clear visual answer — no more history to load.
         */}
        {!hasNextPage && messages.length > 0 && (
          <div style={styles.beginning}>
            Beginning of conversation
          </div>
        )}

        {/* ── Message list ── */}
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
              key={message.id}
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
       * Shown only when showNewButton is true (a real-time message arrived
       * while the user was scrolled up). Floats over the bottom of the outer
       * div via position:absolute so it does not scroll with content.
       *
       * Clicking it:
       *   1. Resets isAtBottomRef to true (next new message will auto-scroll)
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
  // Outer wrapper — grows in the ChatPanel flex column; contains the float button
  outer: {
    flex:      1,
    position:  'relative', // required for the absolute-positioned "New message" button
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
  // flex:1 is needed so ChatPanel's layout doesn't collapse in these states.
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

  // ── US-502: top-of-history controls ─────────────────────────────────────────

  // "Load older messages" button — sits at the very top of the scrollable list.
  //
  // alignSelf:'center' centers it within the flex column (the list div uses
  // flexDirection:'column'). This is simpler than margin:auto because flex
  // alignment is aware of the column axis.
  //
  // Styled as a pill-shaped outline button so it is visually distinct from chat
  // messages but less prominent than a primary action button.
  loadOlderButton: {
    alignSelf:    'center',
    margin:       '0.25rem 0 0.5rem',
    padding:      '0.35rem 1.1rem',
    background:   'transparent',
    color:        '#6b7280',          // gray-500 — subtle, not alarming
    border:       '1px solid #d1d5db', // gray-300
    borderRadius: '999px',            // pill shape
    fontSize:     '0.8rem',
    cursor:       'pointer',
    flexShrink:   0,                  // never compress this row
    transition:   'background 0.1s',
  },

  // Loading indicator shown while the older-messages fetch is in flight.
  // Replaces the button so the user cannot click "Load older" twice.
  loadingOlder: {
    alignSelf:  'center',
    color:      '#9ca3af',  // gray-400 — clearly secondary
    fontSize:   '0.8rem',
    padding:    '0.4rem 0 0.5rem',
    flexShrink: 0,
  },

  // "Beginning of conversation" label — shown when hasNextPage is false.
  //
  // Styled to blend into the background (light gray, centered, small text)
  // so it reads as metadata rather than a UI element the user needs to interact with.
  beginning: {
    alignSelf:  'center',
    color:      '#9ca3af',  // gray-400
    fontSize:   '0.75rem',
    padding:    '0.4rem 0 0.5rem',
    flexShrink: 0,
  },

  // Floating "New message ↓" button — position:absolute over the bottom of the list.
  //
  // left:'50%' + transform:'translateX(-50%)' is the standard CSS trick for
  // centering an absolutely-positioned element horizontally:
  //   left:50%             moves the element's LEFT EDGE to the parent's center
  //   translateX(-50%)     shifts the element LEFT by half its own width
  //   Net result: element center === parent center, regardless of button width.
  newMessageButton: {
    position:     'absolute',
    bottom:       '1rem',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   '#3b82f6',          // blue-500
    color:        '#ffffff',
    border:       'none',
    borderRadius: '999px',            // pill shape
    padding:      '0.4rem 1.1rem',
    fontSize:     '0.8rem',
    fontWeight:   600,
    cursor:       'pointer',
    boxShadow:    '0 2px 8px rgba(0, 0, 0, 0.20)',
    zIndex:       10,                 // above the scrollable content
    animation:    'fadeIn 0.15s ease',
    whiteSpace:   'nowrap',
  },
};
