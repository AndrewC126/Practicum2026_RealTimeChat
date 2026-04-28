/**
 * MessageList — Scrollable Message History Display
 *
 * Renders the list of messages for the active room. Receives the messages
 * array from ChatPanel (which gets it from useMessages) and renders a
 * <MessageItem /> for each one.
 *
 * Props:
 *   messages      — array of message objects from the API/React Query cache
 *   isLoading     — bool: show a spinner while the first page loads
 *   fetchNextPage — function: called when the user scrolls to the top
 *   hasNextPage   — bool: whether more messages exist above
 *
 * Infinite scroll (load older messages):
 *   Attach an IntersectionObserver to a sentinel div at the TOP of the list.
 *   When that div enters the viewport (user scrolled up to the top), call
 *   fetchNextPage(). This avoids adding a "load more" button.
 *     const topRef = useRef(null);
 *     useEffect(() => {
 *       const observer = new IntersectionObserver(([entry]) => {
 *         if (entry.isIntersecting && hasNextPage) fetchNextPage();
 *       });
 *       if (topRef.current) observer.observe(topRef.current);
 *       return () => observer.disconnect();
 *     }, [hasNextPage, fetchNextPage]);
 *
 * Message grouping:
 *   If consecutive messages come from the same sender within a short time,
 *   hide the avatar/name on the second+ messages (like Slack/Discord).
 *   Compare message[i].sender_id === message[i-1].sender_id.
 *
 * Implementation checklist:
 *   - Accept { messages, isLoading, fetchNextPage, hasNextPage } as props
 *   - Render a scrollable container (overflow-y: auto, flex-column)
 *   - Top sentinel div for IntersectionObserver
 *   - Map messages to <MessageItem key={msg.id} message={msg} />
 *   - Bottom sentinel div (passed from ChatPanel for auto-scroll)
 */
export default function MessageList() {}
