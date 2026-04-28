/**
 * MessageItem — Single Message Row
 *
 * Renders one message bubble. The layout differs based on whether the message
 * was sent by the current user (right-aligned) or another user (left-aligned),
 * similar to iMessage or WhatsApp.
 *
 * Props:
 *   message — { id, body, sender_id, sender_username, created_at, is_system_message }
 *   isOwn   — bool: true if message.sender_id === current user's id
 *   isGrouped — bool: true if this message follows one from the same sender
 *               (suppress avatar and username in grouped messages)
 *
 * Rendering rules:
 *   - System messages (is_system_message === true): centered, gray, italic
 *     Example: "Alice joined the room"
 *   - Own messages: right-aligned, primary color bubble, no username shown
 *   - Other messages: left-aligned, gray bubble, show avatar + username
 *     on the first message in a group, hide on subsequent ones (isGrouped)
 *
 * Timestamp formatting:
 *   Use the Intl.DateTimeFormat API (built into the browser) or a small lib
 *   like date-fns to format created_at. Show relative time for recent messages
 *   ("2 minutes ago") and an absolute time for older ones.
 *
 * Implementation checklist:
 *   - Accept { message, isOwn, isGrouped } as props
 *   - Branch on message.is_system_message for the system message style
 *   - Apply conditional CSS classes for alignment and grouping
 *   - Render avatar placeholder (initials or icon) when not isGrouped and not isOwn
 *   - Format the timestamp
 */
export default function MessageItem() {}
