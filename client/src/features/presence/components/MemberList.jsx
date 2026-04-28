/**
 * MemberList — Room Member Presence Panel
 *
 * Shows the members of the currently active room, divided into "Online" and
 * "Offline" sections, using presence state from Redux.
 *
 * Data sources:
 *   Active room members: fetched via REST (GET /api/rooms/:id/members or
 *     included in the room object from useRooms())
 *   Online status: from Redux — useSelector(state => state.presence.onlineUsers)
 *
 * Combining the two:
 *   Map over room.members and check onlineUsers[member.id]?.isOnline to
 *   determine whether to place each member in the online or offline bucket.
 *
 * Layout:
 *   <div className="member-list">
 *     <section>
 *       <h3>Online — {onlineMembers.length}</h3>
 *       {onlineMembers.map(m => <PresenceIndicator key={m.id} user={m} isOnline />)}
 *     </section>
 *     <section>
 *       <h3>Offline — {offlineMembers.length}</h3>
 *       {offlineMembers.map(m => <PresenceIndicator key={m.id} user={m} isOnline={false} />)}
 *     </section>
 *   </div>
 *
 * Implementation checklist:
 *   - useSelector for onlineUsers and activeRoomId
 *   - Get member list from useRooms() or a separate useQuery for members
 *   - Partition members into online/offline arrays
 *   - Render two sections using PresenceIndicator
 */
export default function MemberList() {}
