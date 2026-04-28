/**
 * ChatPanel — Main Chat Area
 *
 * This is the primary content component rendered by the active route. It
 * composes the message display and input into one panel for the active room.
 *
 * Data flow:
 *   1. Read the active room ID from Redux: useSelector(state => state.rooms.activeRoomId)
 *   2. Pass roomId to useMessages(roomId) → get the list of messages
 *   3. Pass roomId to useTyping(roomId) → get onKeyDown handler
 *   4. Render <MessageList>, <TypingIndicator>, <MessageInput> stacked vertically
 *
 * Layout structure:
 *   <div className="chat-panel">
 *     <header>Room name + member count</header>
 *     <MessageList messages={messages} ... />   ← scrollable, flex-grow
 *     <TypingIndicator roomId={roomId} />
 *     <MessageInput roomId={roomId} onKeyDown={onKeyDown} />
 *   </div>
 *
 * Empty state:
 *   If no room is selected (activeRoomId is null), render a placeholder
 *   like "Select a room to start chatting."
 *
 * Auto-scroll to bottom:
 *   When new messages arrive, the view should scroll to the bottom. Use a
 *   ref on a sentinel div at the end of MessageList and call .scrollIntoView()
 *   in a useEffect whenever the messages array changes.
 *     const bottomRef = useRef(null);
 *     useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages]);
 *
 * Implementation checklist:
 *   - useSelector for activeRoomId
 *   - useMessages(activeRoomId) for data and loading state
 *   - Render loading spinner while isLoading
 *   - Render error message if isError
 *   - Compose MessageList, TypingIndicator, MessageInput
 */
export default function ChatPanel() {}
