/**
 * PresenceIndicator — Single User Online/Offline Row
 *
 * A small, purely presentational component: an avatar (or initials) with a
 * colored dot indicating online (green) or offline (gray) status.
 *
 * Props:
 *   user     — { id, username }
 *   isOnline — bool
 *
 * Avatar fallback:
 *   If no profile picture is available, display the user's initials inside
 *   a colored circle (pick a color deterministically from the username so it
 *   stays consistent across renders):
 *     const colors = ['#e63946', '#457b9d', '#2a9d8f', ...];
 *     const colorIndex = user.username.charCodeAt(0) % colors.length;
 *
 * Presence dot:
 *   A small (8px × 8px) circle overlaid on the bottom-right of the avatar.
 *   Green (#44b700) for online, gray (#bdbdbd) for offline.
 *   Use position: relative on the avatar wrapper and position: absolute
 *   on the dot to place it correctly.
 *
 * Accessibility:
 *   Add aria-label={`${user.username} is ${isOnline ? 'online' : 'offline'}`}
 *   so screen readers can convey the same information as the color dot.
 *
 * Implementation checklist:
 *   - Accept { user, isOnline } as props
 *   - Render avatar (initials in a circle) with presence dot
 *   - Apply green/gray color based on isOnline
 *   - Add aria-label for accessibility
 */
export default function PresenceIndicator() {}
