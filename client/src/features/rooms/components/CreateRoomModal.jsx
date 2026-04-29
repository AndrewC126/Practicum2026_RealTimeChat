/**
 * CreateRoomModal — New Room Creation Dialog (US-202)
 *
 * Acceptance criteria covered:
 *   ✓ Opens when the "Create Room" button in the sidebar is clicked
 *   ✓ Fields: room name (required) and description (optional)
 *   ✓ Name required — inline error shown without submitting to the server
 *   ✓ Name max 50 characters — inline error + live character counter
 *   ✓ Duplicate name — server returns 409, error is shown on the name field
 *   ✓ On success: modal closes, sidebar list updates (via invalidateQueries),
 *     and the new room becomes active (via setActiveRoom dispatch)
 *   ✓ Creator auto-joined and designated owner (handled server-side)
 *
 * ─── WHAT IS A MODAL ─────────────────────────────────────────────────────────
 * A "modal" is a dialog that sits on top of the rest of the page. While it is
 * open, the user cannot interact with anything behind it. It is built from:
 *
 *   Overlay  — a full-screen semi-transparent div that blocks clicks on the
 *              content behind it. Clicking the overlay closes the modal.
 *   Box      — the white card centered in the overlay containing the form.
 *              Clicking inside the box does NOT close the modal (stopPropagation).
 *
 *   ┌──────────────────────────────────────────────┐  ← overlay (100vw × 100vh)
 *   │                                              │
 *   │   ┌──────────────────────────────────────┐   │  ← box (centered card)
 *   │   │  Create a room                  ✕   │   │
 *   │   │  Name ____________________________  │   │
 *   │   │  Description ____________________ │   │
 *   │   │                        [ Create ] │   │
 *   │   └──────────────────────────────────────┘   │
 *   │                                              │
 *   └──────────────────────────────────────────────┘
 *
 * ─── CLOSING WITH THE ESCAPE KEY ─────────────────────────────────────────────
 * Pressing Escape should close a modal — it's a universal UX convention.
 * We add a keydown event listener to window when the modal mounts, and remove
 * it when the modal unmounts. This is a common useEffect pattern:
 *
 *   useEffect(() => {
 *     const handler = e => { if (e.key === 'Escape') onClose(); };
 *     window.addEventListener('keydown', handler);
 *     return () => window.removeEventListener('keydown', handler);  ← cleanup
 *   }, [onClose]);
 *
 * The function returned from useEffect is the "cleanup" function. React calls
 * it when the component unmounts. Without this cleanup, the old listener would
 * pile up every time the modal re-opened.
 *
 * ─── stopPropagation ────────────────────────────────────────────────────────
 * DOM events "bubble" up from the target element to its ancestors. If the user
 * clicks inside the modal box, the click event fires on the box AND then bubbles
 * up to the overlay — which would close the modal.
 *
 * e.stopPropagation() on the box's onClick handler stops the event from
 * bubbling, so only a click directly on the overlay (not the box) closes it.
 *
 * ─── mutateAsync vs mutate ───────────────────────────────────────────────────
 * React Query's useMutation gives you two ways to trigger a mutation:
 *   mutate(vars)       — fire-and-forget; you can't await it
 *   mutateAsync(vars)  — returns a Promise; you can await it and catch errors
 *
 * We use mutateAsync here because we need to:
 *   1. Await the result to get the new room's id (for setActiveRoom)
 *   2. Catch errors and display them in the form
 *
 * ─── PROPS ───────────────────────────────────────────────────────────────────
 * onClose — called by the modal when it wants to close itself (either after
 *           successful creation or when the user dismisses it). The parent
 *           component (Sidebar) owns the open/closed state; the modal just
 *           asks to be closed via this callback.
 */
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useRooms } from '../hooks/useRooms';
import { setActiveRoom } from '../roomsSlice';

const MAX_NAME_LENGTH = 50;

export default function CreateRoomModal({ onClose }) {
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError]     = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading]         = useState(false);

  const { createRoom } = useRooms();
  const dispatch = useDispatch();

  // ── Close on Escape key ────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    // addEventListener attaches the handler for the lifetime of this component
    window.addEventListener('keydown', handleKeyDown);
    // The returned cleanup function runs when the component unmounts, removing
    // the listener so it doesn't fire after the modal is gone
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]); // re-run only if onClose changes (it won't in practice)

  // ── Client-side validation ─────────────────────────────────────────────────
  function validate() {
    if (!name.trim()) {
      setNameError('Room name is required');
      return false;
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      setNameError(`Room name must be ${MAX_NAME_LENGTH} characters or fewer`);
      return false;
    }
    return true;
  }

  // ── Form submit ────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();

    // Clear previous errors before re-validating
    setNameError('');
    setServerError('');

    if (!validate()) return; // stop if client-side validation fails

    setLoading(true);
    try {
      // mutateAsync returns the new room object { id, name, description, ... }
      // returned by POST /api/rooms. We use the id to set the active room.
      const newRoom = await createRoom({
        name: name.trim(),
        description: description.trim() || undefined,
        isPrivate: false,
      });

      // Switch the sidebar highlight and (soon) the chat panel to the new room
      dispatch(setActiveRoom(newRoom.id));

      // Close the modal — the parent (Sidebar) will hide it
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Could not create room. Try again.';

      // Map the server's duplicate-name error back to the name field
      if (msg.toLowerCase().includes('name')) {
        setNameError(msg);
      } else {
        setServerError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Name field change handler ──────────────────────────────────────────────
  function handleNameChange(e) {
    const value = e.target.value;
    setName(value);
    // Clear the name error as soon as the user starts editing again
    if (nameError) setNameError('');
    if (serverError) setServerError('');
  }

  // Characters remaining — used for the live counter below the name input
  const charsLeft = MAX_NAME_LENGTH - name.length;

  return (
    /*
     * Overlay — the semi-transparent backdrop.
     * onClick on the overlay calls onClose, but onClick on the box calls
     * e.stopPropagation() to prevent that click from reaching the overlay.
     */
    <div style={styles.overlay} onClick={onClose}>

      {/* Box — the white card */}
      <div
        style={styles.box}
        onClick={e => e.stopPropagation()} // prevent overlay's onClick firing
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* ── Header ── */}
        <div style={styles.header}>
          <h2 id="modal-title" style={styles.title}>Create a room</h2>
          {/*
           * The close button (✕) is an alternative to Escape / overlay-click.
           * Always give users multiple ways to dismiss a modal.
           */}
          <button
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate>

          {/* General server error (not field-specific) */}
          {serverError && (
            <p role="alert" style={styles.alert}>{serverError}</p>
          )}

          {/* ── Name field ── */}
          <div style={styles.fieldGroup}>
            <label htmlFor="room-name" style={styles.label}>
              Room name <span style={styles.required}>*</span>
            </label>
            <input
              id="room-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              maxLength={MAX_NAME_LENGTH + 10} // allow typing past the limit so the
              // error is visible, but validate on submit
              placeholder="e.g. general"
              autoFocus   // focus this field the moment the modal opens
              aria-describedby="name-error name-counter"
              aria-invalid={!!nameError}
              style={{ ...styles.input, ...(nameError ? styles.inputInvalid : {}) }}
            />
            {/* Field-level error */}
            {nameError && (
              <span id="name-error" role="alert" style={styles.fieldError}>
                {nameError}
              </span>
            )}
            {/*
             * Live character counter — turns red when approaching the limit.
             * This satisfies the "max 50 characters" AC with visible feedback
             * before the user hits the limit.
             */}
            <span
              id="name-counter"
              style={{
                ...styles.counter,
                ...(charsLeft <= 10 ? styles.counterWarning : {}),
              }}
            >
              {charsLeft} / {MAX_NAME_LENGTH}
            </span>
          </div>

          {/* ── Description field ── */}
          <div style={styles.fieldGroup}>
            <label htmlFor="room-description" style={styles.label}>
              Description <span style={styles.optional}>(optional)</span>
            </label>
            <input
              id="room-description"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this room for?"
              maxLength={255} // matches DB column length
              style={styles.input}
            />
          </div>

          {/* ── Actions ── */}
          <div style={styles.actions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={styles.submitButton}
            >
              {loading ? 'Creating…' : 'Create room'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = {
  // Full-screen dark overlay — position: fixed takes it out of normal flow
  // and places it over everything including position: sticky elements
  overlay: {
    position: 'fixed',
    inset: 0,                          // shorthand for top/right/bottom/left: 0
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,                      // above everything else
  },
  box: {
    background: '#fff',
    borderRadius: '8px',
    padding: '1.5rem',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.25rem',
  },
  title: {
    margin: 0,
    fontSize: '1.2rem',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    color: '#666',
    padding: '0.2rem 0.4rem',
    lineHeight: 1,
  },
  alert: {
    margin: '0 0 1rem',
    padding: '0.6rem 0.75rem',
    background: '#fdecea',
    color: '#c62828',
    borderRadius: '4px',
    fontSize: '0.875rem',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '1rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  required: {
    color: '#c62828',
  },
  optional: {
    fontWeight: 400,
    color: '#888',
    fontSize: '0.8rem',
  },
  input: {
    padding: '0.5rem 0.75rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem',
  },
  inputInvalid: {
    borderColor: '#c62828',
  },
  fieldError: {
    color: '#c62828',
    fontSize: '0.8rem',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: '0.75rem',
    color: '#999',
  },
  counterWarning: {
    color: '#c62828',
    fontWeight: 600,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  cancelButton: {
    padding: '0.5rem 1rem',
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '0.9rem',
    cursor: 'pointer',
    color: '#333',
  },
  submitButton: {
    padding: '0.5rem 1.25rem',
    background: '#1976d2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
};
