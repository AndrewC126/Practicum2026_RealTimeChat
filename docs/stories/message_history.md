5. Message History

US-501 — Load message history on join

As a user joining a chat room, I want to see previous messages so that I have context for the conversation.

Acceptance Criteria:

When a user joins a room, the most recent 50 messages are loaded automatically
Messages are displayed in chronological order, oldest at the top
Each message shows the sender's username and timestamp
If fewer than 50 messages exist, all available messages are shown


US-502 — Load older messages

As a user, I want to load older messages so that I can read the full conversation history.

Acceptance Criteria:

A "Load older messages" button or infinite scroll trigger appears at the top of the chat panel
Clicking/triggering it loads the previous 50 messages above the current ones
The scroll position is preserved after older messages load (user is not snapped to the top)
When no more history exists, the button/trigger is hidden and a "Beginning of conversation" label is shown