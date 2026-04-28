/**
 * useRooms — Room List and Mutations Hook
 *
 * Uses React Query to fetch the list of available rooms and to expose
 * create/join/leave operations. React Query's mutation system handles
 * loading/error states for write operations automatically.
 *
 * Fetching rooms (useQuery):
 *   const { data: rooms, isLoading } = useQuery({
 *     queryKey: ['rooms'],
 *     queryFn: () => api.get('/rooms').then(r => r.data),
 *   });
 *
 * Creating a room (useMutation):
 *   const { mutate: createRoom } = useMutation({
 *     mutationFn: (data) => api.post('/rooms', data).then(r => r.data),
 *     onSuccess: () => {
 *       queryClient.invalidateQueries({ queryKey: ['rooms'] });
 *       // invalidateQueries tells React Query the 'rooms' cache is stale,
 *       // which triggers an automatic refetch so the new room appears.
 *     },
 *   });
 *
 * Leaving a room (useMutation):
 *   DELETE /api/rooms/:id/members
 *   Same pattern: mutationFn calls the API, onSuccess invalidates ['rooms'].
 *
 * Joining a room:
 *   The server auto-joins the user when they send their first message, or
 *   you can add a join action that calls POST /api/rooms/:id/members.
 *
 * What this hook returns:
 *   {
 *     rooms,        // array of room objects
 *     isLoading,
 *     createRoom,   // (name, description, isPrivate) => void
 *     leaveRoom,    // (roomId) => void
 *   }
 */
export function useRooms() {}
