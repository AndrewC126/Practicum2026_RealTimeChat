/**
 * Chat Socket Handler (US-203, US-204, US-301, US-602)
 *
 * Registered once per connection inside initSocket. Handles three events:
 *
 *   join_room    — user opens a room in the sidebar (US-203)
 *   leave_room   — user confirms leaving a room (US-204)
 *   send_message — user sends a chat message (US-301)
 *
 * ─── UNREAD BADGE FLOW (US-602) ───────────────────────────────────────────────
 *
 *   When a message is sent:
 *     1. incrementUnread(roomId, senderId) bumps room_members.unread_count += 1
 *        for every member EXCEPT the sender.
 *     2. For each updated row we emit 'badge_update' to that user's private
 *        socket channel: io.to('user:<userId>').emit('badge_update', { roomId, unreadCount })
 *     3. The client's useUnreadBadges hook receives it and patches the React
 *        Query rooms cache so the badge re-renders without a full refetch.
 *
 *   When the user opens a room:
 *     1. resetUnread(roomId, userId) sets room_members.unread_count = 0 in the DB.
 *     2. The client zeroes the badge optimistically the moment it emits 'join_room'
 *        (see useMessages.js), so no extra server → client event is needed here.
 *
 * ─── SOCKET.IO ROOMS vs CHAT ROOMS ───────────────────────────────────────────
 * Socket.io has its own concept of "rooms" — named channels that sockets can
 * subscribe to. They are completely separate from our app's chat rooms table,
 * but we use the same UUID as the channel name so they map 1-to-1:
 *
 *   socket.join(roomId)
 *     → This socket now receives any event emitted to io.to(roomId)
 *
 *   socket.leave(roomId)
 *     → This socket stops receiving events emitted to io.to(roomId)
 *
 *   io.to(roomId).emit('new_message', msg)
 *     → Delivers 'new_message' to EVERY socket in the room, including sender
 *
 *   socket.to(roomId).emit('new_message', msg)
 *     → Delivers 'new_message' to all sockets in the room EXCEPT the sender
 *
 * ─── WHY io.to() for system messages but socket.to() for user messages ────────
 *
 *   System messages (join/leave):
 *     Use io.to(roomId) so the person joining/leaving also sees the message
 *     in their own feed. Their message history needs to include it.
 *
 *   User messages (send_message) and typing events (typing_start/stop):
 *     Use socket.to(roomId) so the event is NOT sent back to the emitting
 *     socket. For send_message, the sender gets their own message via the ack.
 *     For typing events, the typer must NEVER see their own indicator —
 *     AC4 of US-303: "The indicator does not appear to the user who is typing."
 *
 * ─── TYPING EVENT FLOW (US-303) ───────────────────────────────────────────────
 * The server acts as a pure relay for typing events — no state is stored:
 *
 *   Client emits 'typing_start' → { roomId }
 *     Server: socket.to(roomId).emit('typing_update', { username, isTyping: true })
 *     Others: their useTyping hook receives 'typing_update', dispatches setTyping
 *             → Redux adds username to typingUsers[roomId]
 *             → TypingIndicator re-renders with "Alice is typing…"
 *
 *   Client emits 'typing_stop' → { roomId }
 *     Server: socket.to(roomId).emit('typing_update', { username, isTyping: false })
 *     Others: setTyping removes username from typingUsers[roomId]
 *             → TypingIndicator re-renders with nothing (or fewer names)
 *
 * The client is responsible for debouncing (only emitting typing_start once,
 * then typing_stop after 3 seconds of silence). The server just forwards.
 *
 * Why no server-side typing state?
 *   Storing who is typing on the server would require cleanup logic for when
 *   users disconnect without sending typing_stop (browser crash, network drop).
 *   Keeping it stateless on the server avoids that complexity entirely.
 *   The client-side debounce handles the "stopped typing" case for normal usage.
 *
 * ─── SOCKET.IO ACKNOWLEDGMENTS ───────────────────────────────────────────────
 * The client can pass a callback as the last argument to socket.emit():
 *
 *   // Client
 *   socket.emit('send_message', { roomId, body }, function(response) {
 *     // response = { ok: true, message: {...} } on success
 *     // Called when the SERVER calls ack(response) below
 *   });
 *
 *   // Server
 *   socket.on('send_message', async ({ roomId, body }, ack) => {
 *     const message = await save();
 *     ack({ ok: true, message }); // fires the client callback
 *   });
 *
 * Benefits of acks for send_message:
 *   1. The sender gets back the REAL message (with DB-generated id + created_at)
 *      to replace their optimistic message in the cache.
 *   2. The sender's optimistic message appears BEFORE the server round-trip —
 *      satisfying the "appears immediately" AC.
 *   3. If saving fails, ack({ ok: false }) lets the client show an error and
 *      remove the optimistic message.
 *
 * ─── ERROR HANDLING IN SOCKET EVENTS ─────────────────────────────────────────
 * There is no res.status(400) in Socket.io. Errors go back via:
 *   - ack({ ok: false, message: '…' }) for promise-based callers
 *   - socket.emit('error', { message: '…' }) for generic error listeners
 */
import * as roomsRepo      from '../../repositories/rooms.repository.js';
import * as messagesRepo   from '../../repositories/messages.repository.js';
import * as messagesService from '../../services/messages.service.js';
import * as usersRepo       from '../../repositories/users.repository.js';

export function registerChatHandlers(io, socket) {
  // ── join_room ──────────────────────────────────────────────────────────────
  //
  // ─── OPTIONAL ACKNOWLEDGMENT (US-205) ─────────────────────────────────────
  // Socket.io passes an `ack` callback ONLY when the client provides one:
  //
  //   socket.emit('join_room', { roomId })            → ack is undefined
  //   socket.emit('join_room', { roomId }, callback)  → ack is callback
  //
  // This is fully backward-compatible: existing callers (useMessages.js) that
  // don't pass a callback are unaffected. The Browse modal (US-205) passes a
  // callback so it can wait for DB confirmation before navigating the user into
  // the room and updating the sidebar.
  socket.on('join_room', async ({ roomId }, ack) => {
    try {
      const { id: userId, username } = socket.data.user;

      // Subscribe this socket to the Socket.io channel for the room.
      // After this, io.to(roomId).emit() will reach this client.
      socket.join(roomId);

      // ── US-602: Clear the unread counter for this user ─────────────────────
      // The user is now looking at the room, so any previously unread messages
      // are no longer unread. Reset their counter to 0 in the DB.
      //
      // This runs on EVERY join_room — both first-ever joins and re-opens —
      // because the user might have accumulated unread messages between visits.
      //
      // The client zeroes the badge optimistically the moment it emits
      // 'join_room' (see useMessages.js), so the user sees immediate feedback
      // without waiting for this DB call to complete.
      await roomsRepo.resetUnread(roomId, userId);

      // Idempotently add the user to room_members.
      // Returns true only when a NEW row was inserted (first-ever join).
      const isNewMember = await roomsRepo.addMember(roomId, userId);

      // Only broadcast a "joined" system message on the very first join.
      // Re-opening a room the user already belongs to is silent.
      if (isNewMember) {
        const saved = await messagesRepo.create({
          roomId,
          senderId: userId,
          body: `${username} has joined the room`,
          isSystemMessage: true,
        });

        // Attach username manually — INSERT RETURNING doesn't JOIN users.
        const message = { ...saved, sender_username: username };

        // io.to() includes the joining socket so they also see the system message.
        io.to(roomId).emit('new_message', message);

        // ── US-402: Notify all room members that the member list changed ──────
        // The MemberList component on each client listens for 'members_updated'
        // and invalidates its React Query cache, triggering a fresh fetch of
        // GET /api/rooms/:id/members so the new member appears immediately.
        //
        // We only emit this when isNewMember is true — re-opening a room you
        // already belong to does NOT change the member list.
        io.to(roomId).emit('members_updated', { roomId });
      }

      // Signal success to the caller if they provided an ack callback.
      // The Browse modal awaits this before invalidating the rooms cache and
      // navigating the user into the room (US-205).
      if (typeof ack === 'function') ack({ ok: true });

    } catch (err) {
      console.error('join_room error:', err);
      if (typeof ack === 'function') ack({ ok: false, message: 'Could not join room' });
      socket.emit('error', { message: 'Could not join room' });
    }
  });

  // ── leave_room ─────────────────────────────────────────────────────────────
  socket.on('leave_room', async ({ roomId }, ack) => {
    console.log(`[leave_room] received — roomId: ${roomId}, user: ${socket.data.user?.username}`);
    try {
      const { id: userId, username } = socket.data.user;

      // Remove from room_members — after this, GET /api/rooms no longer
      // includes this room for this user (filtered by membership).
      await roomsRepo.removeMember(roomId, userId);

      // Create the "has left" system message.
      const saved = await messagesRepo.create({
        roomId,
        senderId: userId,
        body:     `${username} has left the room`,
        isSystemMessage: true,
      });

      const message = { ...saved, sender_username: username };

      // Broadcast BEFORE socket.leave() so the leaving user also receives
      // the system message and sees it in their feed before the panel closes.
      io.to(roomId).emit('new_message', message);

      // ── US-402: Notify remaining members the list has changed ─────────────
      // Must also emit BEFORE socket.leave() so the leaving socket still receives
      // the event and can update its own MemberList view while it's visible.
      io.to(roomId).emit('members_updated', { roomId });

      // Unsubscribe from the Socket.io channel.
      // Future io.to(roomId) calls will no longer reach this client.
      socket.leave(roomId);

      // Signal success to the client's ack callback.
      if (typeof ack === 'function') ack({ ok: true });

    } catch (err) {
      console.error('leave_room error:', err);
      if (typeof ack === 'function') ack({ ok: false, message: 'Could not leave room' });
      socket.emit('error', { message: 'Could not leave room' });
    }
  });

  // ── typing_start ───────────────────────────────────────────────────────────
  // Emitted by the client when the user begins typing (first keystroke after
  // being idle). The client is responsible for not emitting this repeatedly —
  // it uses a ref (isTypingRef) to track whether it has already sent it.
  //
  // socket.to(roomId) excludes the sender so the typer never sees their own
  // indicator — satisfying AC4: "does not appear to the user who is typing."
  socket.on('typing_start', ({ roomId }) => {
    const { username } = socket.data.user;
    socket.to(roomId).emit('typing_update', { username, isTyping: true });
  });

  // ── typing_stop ────────────────────────────────────────────────────────────
  // Emitted by the client in two situations:
  //   1. The user sends a message (immediately clears the indicator)
  //   2. The user stops typing for 3 seconds (debounce timer fires)
  //
  // The server is stateless — it just relays the event. No cleanup is needed
  // on the server even if the user disconnects while the indicator is shown,
  // because disconnect events are handled separately (future US-401).
  socket.on('typing_stop', ({ roomId }) => {
    const { username } = socket.data.user;
    socket.to(roomId).emit('typing_update', { username, isTyping: false });
  });

  // ── invite_user ────────────────────────────────────────────────────────────
  //
  // Emitted by the InviteModal when the inviter clicks the "Invite" button.
  //
  // Payload: { roomId: string, userId: string }
  //   roomId — the room to invite the user into
  //   userId — the UUID of the user being invited
  //
  // ─── FULL INVITE FLOW ──────────────────────────────────────────────────────
  //
  //   1. Verify the INVITER is a current member of the room.
  //      AC: "Only current members of the room can invite others."
  //      A malicious client could emit this event for any room — we must
  //      always verify server-side, never trust the client for authorization.
  //
  //   2. Look up the INVITEE's username from the database.
  //      We trust the userId the client sends, but we re-fetch the username
  //      from the DB rather than accepting it from the client, so the system
  //      message cannot be spoofed.
  //
  //   3. Call addMember(roomId, userId) — idempotent INSERT.
  //      Returns true if a new row was inserted, false if already a member.
  //      We only proceed to broadcast if the user was truly new (prevents
  //      duplicate system messages if the invite button is clicked twice).
  //
  //   4. Create and broadcast the system message.
  //      "Alice was added to the room by Jordan"
  //      io.to(roomId) includes ALL current members AND the joining socket
  //      (if the invitee is online and already subscribed to this room).
  //      In practice the invitee is NOT yet subscribed — they will see the
  //      system message when they open the room after the sidebar updates.
  //
  //   5. Emit 'room_added' to the invitee's private channel 'user:<uuid>'.
  //      AC: "The room appears in the invited user's sidebar immediately."
  //      The invitee's useRoomInvites hook listens for this event and calls
  //      queryClient.invalidateQueries(['rooms']) so their sidebar refetches
  //      and shows the new room — all without a page refresh.
  //      If the invitee has multiple tabs open, ALL of them update because
  //      every tab joins 'user:<uuid>' on connect (see socket/index.js).
  //
  //   6. Call ack({ ok: true }) so the InviteModal knows the invite succeeded
  //      and can show "Invited ✓" on the button.
  //
  // ─── WHY A SOCKET EVENT AND NOT A REST ENDPOINT? ──────────────────────────
  // A socket event lets us do everything in one server-side operation:
  //   • DB write (addMember)
  //   • Real-time broadcast to the room (system message via io.to(roomId))
  //   • Real-time push to the invitee (room_added via io.to('user:<uuid>'))
  //
  // With a REST endpoint we could do the DB write, but we would still need
  // a separate socket emit from somewhere to notify the invitee. Using a
  // socket event throughout is simpler and more consistent with how
  // join_room and leave_room are already implemented.
  socket.on('invite_user', async ({ roomId, userId: inviteeId }, ack) => {
    try {
      const { id: inviterId, username: inviterUsername } = socket.data.user;

      // ── Step 1: Verify inviter is a room member ─────────────────────────────
      // isMember runs a quick indexed SELECT — very cheap.
      const inviterIsMember = await roomsRepo.isMember(roomId, inviterId);
      if (!inviterIsMember) {
        // Return an error via ack — the client shows it to the user.
        // We do NOT use socket.emit('error') here because this is an expected
        // authorization failure, not an unexpected server error.
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'You must be a member of this room to invite others' });
        }
        return; // stop processing — do not add the user or send any messages
      }

      // ── Step 2: Look up the invitee's username ──────────────────────────────
      // We re-fetch from the DB rather than trusting the client-supplied userId.
      // If the user doesn't exist, respond gracefully instead of crashing.
      const invitee = await usersRepo.findById(inviteeId);
      if (!invitee) {
        if (typeof ack === 'function') {
          ack({ ok: false, message: 'User not found' });
        }
        return;
      }

      // ── Step 3: Add invitee to room_members ────────────────────────────────
      // addMember is idempotent (ON CONFLICT DO NOTHING) and returns:
      //   true  → a new row was inserted (first-ever join — proceed)
      //   false → user was already a member (nothing to do — early return)
      const isNewMember = await roomsRepo.addMember(roomId, inviteeId);
      if (!isNewMember) {
        // Already a member — silently succeed so the UI can still show "Invited"
        // (the invite-search filters existing members, but race conditions could
        // cause this path. Treating it as success is the right UX.)
        if (typeof ack === 'function') ack({ ok: true });
        return;
      }

      // ── Step 4: Create and broadcast the system message ────────────────────
      // "Alice was added to the room by Jordan"
      // The message body follows the format in the AC.
      const saved = await messagesRepo.create({
        roomId,
        senderId:        inviterId,
        body:            `${invitee.username} was added to the room by ${inviterUsername}`,
        isSystemMessage: true,
      });

      // Attach sender username — INSERT RETURNING doesn't JOIN users.
      const message = { ...saved, sender_username: inviterUsername };

      // io.to(roomId) broadcasts to all sockets currently subscribed to this
      // room channel (all members who have the room open).
      io.to(roomId).emit('new_message', message);

      // ── US-402: Tell everyone in the room that the member list changed ─────
      // The invited user is now in room_members, so every client's MemberList
      // should refetch so the new member appears in the panel.
      io.to(roomId).emit('members_updated', { roomId });

      // ── Step 5: Notify the invited user in real time ────────────────────────
      // 'user:<uuid>' is a private per-user Socket.io channel that every socket
      // joins on connect (see socket/index.js).
      //
      // Emitting 'room_added' here is what causes the invited user's sidebar to
      // update immediately — their useRoomInvites hook receives this event and
      // invalidates the ['rooms'] React Query cache, triggering a refetch.
      //
      // We also send the room object itself (from room_summary) so the client
      // can optimistically add it to the sidebar without waiting for the refetch.
      // For simplicity we just send the roomId and let the client refetch — this
      // keeps the server logic simple and avoids a second DB query here.
      io.to(`user:${inviteeId}`).emit('room_added', { roomId });

      // ── Step 6: Acknowledge success to the inviter ─────────────────────────
      if (typeof ack === 'function') ack({ ok: true });

    } catch (err) {
      console.error('invite_user error:', err);
      if (typeof ack === 'function') {
        ack({ ok: false, message: 'Could not invite user. Please try again.' });
      }
    }
  });

  // ── send_message ───────────────────────────────────────────────────────────
  //
  // Flow:
  //   1. Client optimistically adds message to local cache (appears immediately)
  //   2. Client emits 'send_message' with an ack callback
  //   3. Server validates + saves the message to the DB
  //   4. Server broadcasts to everyone in the room EXCEPT the sender
  //      (socket.to() excludes the sender — they already have the optimistic copy)
  //   5. Server calls ack({ ok: true, message: savedMessage })
  //   6. Client replaces their optimistic message with the real saved message
  //      (which has the actual DB-generated id and created_at)
  //
  // Why socket.to() instead of io.to() here?
  //   The sender receives their message via the ack — not via the broadcast.
  //   If we used io.to() the sender would get a DUPLICATE via 'new_message'.
  socket.on('send_message', async ({ roomId, body }, ack) => {
    try {
      const { id: userId, username } = socket.data.user;

      // saveMessage validates the body (non-empty, max 1000 chars) and persists.
      // Using the service here ensures the same validation rules apply whether
      // the message comes from a socket event or any future REST endpoint.
      const saved = await messagesService.saveMessage({
        roomId,
        senderId: userId,
        body,
      });

      // Attach username — INSERT RETURNING doesn't JOIN users, so we add it
      // from the already-known socket identity (no extra DB query needed).
      const message = { ...saved, sender_username: username };

      // Broadcast to everyone in the room EXCEPT the sending socket.
      // Other users receive the message via their 'new_message' listener
      // (wired in useMessages on the client).
      socket.to(roomId).emit('new_message', message);

      // ── US-602: Increment unread counts and push badge updates ─────────────
      //
      // incrementUnread returns one row per member whose counter was bumped:
      //   [{ user_id: 'abc', unread_count: 3 }, ...]
      //
      // For each row we emit 'badge_update' to that user's private socket
      // channel ('user:<uuid>' — joined in socket/index.js on connect).
      // io.to('user:<uuid>') reaches ALL of that user's sockets (multiple tabs).
      //
      // The client's useUnreadBadges hook listens for 'badge_update' and
      // patches the React Query rooms cache to re-render the sidebar badge
      // without a full refetch of the rooms list.
      //
      // We do NOT increment the sender (incrementUnread excludes them via
      // WHERE user_id != $2) because they can see their own message immediately.
      const updatedMembers = await roomsRepo.incrementUnread(roomId, userId);

      for (const { user_id, unread_count } of updatedMembers) {
        // 'user:<uuid>' is the private channel each socket joins in index.js.
        // This reaches the user even if they have zero or multiple tabs open.
        io.to(`user:${user_id}`).emit('badge_update', {
          roomId,
          unreadCount: unread_count,
        });
      }

      // Return the saved message to the sender via the ack callback.
      // The client uses this to replace the optimistic (temp-id) message
      // with the real message (DB id + server timestamp).
      if (typeof ack === 'function') ack({ ok: true, message });

    } catch (err) {
      console.error('send_message error:', err);
      // ok: false lets the client remove the optimistic message and show an error.
      if (typeof ack === 'function') {
        ack({ ok: false, message: err.message ?? 'Could not send message' });
      }
      socket.emit('error', { message: 'Could not send message' });
    }
  });
}
