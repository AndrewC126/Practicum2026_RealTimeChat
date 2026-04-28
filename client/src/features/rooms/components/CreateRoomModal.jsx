/**
 * CreateRoomModal — New Room Creation Dialog
 *
 * A modal form that collects room name, description, and visibility (public
 * vs private), then calls useRooms().createRoom() to create it via the API.
 *
 * Props:
 *   onClose — function: called after successful creation or when dismissed
 *
 * Modal behavior:
 *   A modal sits on top of the rest of the UI. Two ways to implement it:
 *   1. A fixed-position overlay div with a centered content box (simple CSS)
 *   2. React Portals — render the modal into document.body via createPortal()
 *      so it escapes the stacking context of parent elements. Preferred for
 *      real apps to avoid z-index issues.
 *
 *   Dismiss on click-outside:
 *     Wrap the modal in an overlay div. If the user clicks the overlay (not
 *     the content box), call onClose(). Use onClick on the overlay and
 *     stopPropagation on the content box.
 *
 *   Dismiss on Escape key:
 *     useEffect(() => {
 *       const handler = e => { if (e.key === 'Escape') onClose(); };
 *       window.addEventListener('keydown', handler);
 *       return () => window.removeEventListener('keydown', handler);
 *     }, [onClose]);
 *
 * Form fields:
 *   - Name (required, 1–50 chars — matches DB constraint)
 *   - Description (optional, max 255 chars)
 *   - Private checkbox (maps to is_private on the server)
 *
 * On submit:
 *   - Validate name is not empty
 *   - Call createRoom({ name, description, isPrivate })
 *   - On success: call onClose() — React Query invalidation handles the refresh
 *   - On error: display the server's error message
 *
 * Implementation checklist:
 *   - Accept { onClose } as a prop
 *   - useState for name, description, isPrivate, error, loading
 *   - useRooms() for the createRoom mutation function
 *   - Overlay + content box structure
 *   - Escape key and click-outside handlers
 *   - Form with validation and submit
 */
export default function CreateRoomModal() {}
