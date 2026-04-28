/**
 * TypingIndicator — "Alice is typing..." Display (US-303)
 *
 * Reads the typing state from Redux and renders a small animated indicator
 * below the message list when one or more users are typing.
 *
 * Props:
 *   roomId — used to select the right typing users from the Redux store
 *
 * Reading from Redux:
 *   const typingUsers = useSelector(state => state.chat.typingUsers[roomId] ?? []);
 *
 * Display logic:
 *   - 0 users typing   → render nothing (null)
 *   - 1 user typing    → "Alice is typing..."
 *   - 2 users typing   → "Alice and Bob are typing..."
 *   - 3+ users typing  → "Several people are typing..."
 *
 * Animation:
 *   The "..." can be animated with a CSS keyframe (three dots pulsing) to
 *   match the familiar chat UX pattern. Apply the animation class to a <span>.
 *
 * Important: Filter the current user out of typingUsers so you don't see
 * "You are typing..." in your own UI.
 *
 * Implementation checklist:
 *   - Accept { roomId } as a prop
 *   - useSelector to get typingUsers[roomId]
 *   - useSelector to get current user id (to filter yourself out)
 *   - Implement the 1/2/3+ display logic
 *   - Return null when no one is typing
 *   - Add a CSS animation for the dots
 */
export default function TypingIndicator() {}
