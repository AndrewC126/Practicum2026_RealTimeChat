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


US-205 — Browse and join public rooms

As a logged-in user, I want to browse all public rooms so that I can discover and join conversations I am not yet a part of.

Acceptance Criteria:

A "Browse Rooms" button or entry point is accessible from the sidebar
The browser view lists every public room in the application, including rooms the user has not joined
Each room entry displays its name, optional description, and current member count
Rooms the user is already a member of are visually distinguished (e.g. a "Joined" label) and cannot be joined again
The user can join any public room they are not already a member of with a single click, requiring no confirmation dialog
After joining, the room immediately appears in the user's sidebar room list and the user is automatically navigated into it
A system message appears in the newly joined room (e.g. "Alex has joined the room")
The room list can be filtered by typing a room name into a search field, with results updating as the user types
If no joinable public rooms exist, a helpful empty-state message is shown (e.g. "No other rooms available — create one!")


US-206 — Invite users to a room

As a room member, I want to invite other registered users to a room so that I can bring specific people into the conversation without them having to find it themselves.

Acceptance Criteria:

An "Invite" button is accessible from within the active room's header
Clicking it opens a search interface where the member can look up other registered users by username
The search returns matching results as the user types, excluding users who are already members of the room
Selecting a user and confirming the invite immediately adds them to the room's member list
The invited user receives a real-time notification that they have been added to the room
The room appears in the invited user's sidebar immediately upon being invited, without requiring a page refresh
A system message is posted in the room visible to all members (e.g. "Alex was added to the room by Jordan")
If a search query matches no registered users, a clear message is shown (e.g. "No users found")
Only current members of the room can invite others