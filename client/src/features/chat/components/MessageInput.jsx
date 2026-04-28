/**
 * MessageInput — Chat Message Composer (US-301)
 *
 * The text area at the bottom of ChatPanel where the user types and sends
 * messages. Also hosts the emoji picker button.
 *
 * Props:
 *   roomId    — the room to send the message to
 *   onKeyDown — the debounced typing handler from useTyping()
 *
 * Sending a message:
 *   Messages are sent via Socket.io (real-time), NOT via a REST API call.
 *   The server persists the message and broadcasts it to all room members.
 *     socket.emit('send_message', { roomId, body: draft });
 *   After emitting, clear the input and stop the typing indicator.
 *
 * Local state:
 *   draft        — the current text in the input
 *   showPicker   — bool to show/hide the EmojiPicker
 *
 * Validation before sending:
 *   - body.trim().length === 0 → don't send (disable the button)
 *   - body.length > 1000 → show a character counter warning (matches DB constraint)
 *
 * Keyboard shortcuts:
 *   - Enter (without Shift) → send the message
 *   - Shift+Enter → insert a newline (use a <textarea> not <input>)
 *
 * Implementation checklist:
 *   - useState for draft and showPicker
 *   - useSocket() to get the socket
 *   - handleSubmit: validate → emit → clear draft → emit typing_stop
 *   - handleKeyDown: call onKeyDown(e), and if Enter without Shift call handleSubmit
 *   - Emoji button toggles showPicker; onEmojiSelect appends emoji to draft
 *   - Disable send button when draft.trim() is empty or draft.length > 1000
 *   - Character count display when approaching 1000 (e.g., show at 800+)
 */
export default function MessageInput() {}
