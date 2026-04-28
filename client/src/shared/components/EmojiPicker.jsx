/**
 * EmojiPicker — Emoji Selection Wrapper (US-603)
 *
 * Rather than building an emoji picker from scratch, this component wraps a
 * third-party library. A popular choice is `emoji-picker-react`.
 *   npm install emoji-picker-react
 *
 * This wrapper exists so the rest of the codebase only imports <EmojiPicker />,
 * not the raw library component. If you ever swap the library, you only change
 * this one file.
 *
 * Props this component should accept:
 *   onEmojiSelect(emoji: string) — callback invoked when the user picks an emoji
 *   onClose()                   — callback to close the picker (e.g., clicking away)
 *
 * How it fits in the chat flow:
 *   1. User clicks the emoji button in <MessageInput />
 *   2. MessageInput sets local state: showPicker = true
 *   3. <EmojiPicker onEmojiSelect={emoji => appendToInput(emoji)} onClose={...} />
 *      renders as a floating panel above the input
 *   4. User picks an emoji → onEmojiSelect appends it to the draft message
 *
 * Implementation checklist:
 *   - Accept { onEmojiSelect, onClose } as props
 *   - Render the library's component and forward the onEmojiClick callback
 *   - Add a click-outside handler (useRef + useEffect on 'mousedown') to
 *     call onClose when the user clicks anywhere outside the picker
 */

// Emoji picker wrapper (US-603)
export default function EmojiPicker() {}
