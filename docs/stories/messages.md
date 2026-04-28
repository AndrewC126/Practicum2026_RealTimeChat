3. Real-Time Messaging

US-301 — Send a message

As a user in a chat room, I want to send a message so that others in the room can see it.

Acceptance Criteria:

A text input and send button are visible at the bottom of the chat panel
Pressing Enter or clicking Send submits the message
The message input clears after sending
Submitting an empty message does nothing
Messages have a maximum length of 1,000 characters; exceeding it disables the send button and shows a character count warning
The sent message appears in the chat immediately for the sender without waiting for a server round-trip


US-302 — Receive messages in real time

As a user in a chat room, I want to see new messages from others appear instantly so that the conversation flows naturally.

Acceptance Criteria:

New messages from other users appear without any page refresh
Each message displays the sender's username and a timestamp
Messages appear in chronological order
The chat panel auto-scrolls to the latest message when a new one arrives
If the user has scrolled up, auto-scroll does not force them back down; instead a "New message ↓" button appears


US-303 — Typing indicator

As a user in a chat room, I want to see when someone else is typing so that I know a message is coming.

Acceptance Criteria:

When a user begins typing, a "Username is typing..." indicator appears for other room members
The indicator disappears when the user sends the message or stops typing for 3 seconds
Multiple typers are handled gracefully (e.g. "Alex and Jordan are typing...")
The indicator does not appear to the user who is typing, only to others