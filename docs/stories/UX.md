6. UI / UX

US-601 — Responsive layout

As a user, I want the app to work on both desktop and mobile so that I can chat from any device.

Acceptance Criteria:

On desktop, the sidebar and chat panel are displayed side by side
On mobile (< 768px), the sidebar is hidden by default and toggled via a menu button
All buttons and inputs are touch-friendly (minimum 44px tap target)
Text is legible at all screen sizes without horizontal scrolling


US-602 — Unread message badge

As a user, I want to see a badge on rooms with unread messages so that I don't miss anything.

Acceptance Criteria:

Rooms with unread messages show a numeric badge in the sidebar
The badge clears when the user opens that room
The badge count is accurate across sessions (stored server-side)


US-603 — Emoji support

As a user, I want to send emoji in messages so that I can express tone and reactions.

Acceptance Criteria:

An emoji picker button is accessible next to the message input
Clicking an emoji inserts it into the message input at the cursor position
Emoji render correctly for all users across different devices and browsers
Emoji-only messages are allowed and display at a slightly larger size
