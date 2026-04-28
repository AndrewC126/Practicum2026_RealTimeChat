2. Chat Rooms

US-201 — Browse available rooms

As a logged-in user, I want to see a list of available chat rooms so that I can choose one to join.

Acceptance Criteria:

The sidebar displays a list of all public chat rooms
Each room shows its name and optionally a short description
The list updates if a new room is created without requiring a page refresh
If no rooms exist, a message like "No rooms yet — create one!" is shown


US-202 — Create a room

As a logged-in user, I want to create a new chat room so that I can start a conversation around a topic.

Acceptance Criteria:

A "Create Room" button is visible in the sidebar
Clicking it opens a form/modal with fields for room name and optional description
Room name is required; submitting without it shows an inline error
Room name must be unique; duplicates show an error message
Room name has a maximum length of 50 characters
On success, the new room appears in the sidebar and the user is automatically joined to it
The creator is designated as the room owner


US-203 — Join a room

As a logged-in user, I want to join a chat room so that I can participate in its conversation.

Acceptance Criteria:

Clicking a room in the sidebar joins the user to that room and loads its message history
The active room is visually highlighted in the sidebar
A system message appears in the chat (e.g. "Alex has joined the room")
The user can only be actively viewing one room at a time


US-204 — Leave a room

As a logged-in user, I want to leave a chat room so that I'm no longer part of its conversation.

Acceptance Criteria:

A "Leave Room" option is accessible while inside a room
Confirming the action removes the user from the room and returns them to a default/empty state
A system message appears in the room (e.g. "Alex has left the room")
The room is removed from the user's sidebar list after leaving