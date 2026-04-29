/**
 * useMobile — Responsive Breakpoint Hook (US-601)
 *
 * Returns true when the browser's viewport width is less than 768 pixels,
 * and updates automatically if the user rotates their device or resizes
 * the browser window.
 *
 * ─── WHY A CUSTOM HOOK INSTEAD OF CSS MEDIA QUERIES ─────────────────────────
 * The project uses React inline styles (style={{ ... }}) throughout, which
 * are plain JavaScript objects. CSS media queries (@media) only work in actual
 * CSS stylesheets or <style> tags — they have no effect on inline styles.
 *
 * To conditionally apply different inline styles based on screen size, we need
 * a JavaScript value (true/false) that we can use in JSX conditions:
 *
 *   const isMobile = useMobile();
 *   <aside style={isMobile ? mobileStyle : desktopStyle} />
 *
 * ─── INITIALIZER FUNCTION ────────────────────────────────────────────────────
 * useState() accepts either an initial value OR an initializer function.
 * The function form is "lazy" — React calls it ONCE during the very first
 * render and never again. This is perfect here because reading window.innerWidth
 * is a DOM access that we only need to perform once on mount, not on every render.
 *
 *   useState(() => window.innerWidth < 768)
 *   ↑ function                               ← called once
 *
 * Compare to:
 *   useState(window.innerWidth < 768)
 *   ↑ expression                              ← evaluated on every render call
 *                                               (even though useState ignores
 *                                                subsequent values, the read still
 *                                                happens — wasteful)
 *
 * ─── RESIZE LISTENER ─────────────────────────────────────────────────────────
 * The useEffect attaches one event listener for 'resize'. When the user changes
 * the window size, handleResize re-checks window.innerWidth and updates state
 * only if the mobile/desktop status changed (React skips re-renders for identical
 * state values automatically — no extra guard needed).
 *
 * The effect's cleanup function (return () => ...) removes the listener when
 * the component that called useMobile() unmounts. Without this, the listener
 * would try to call setIsMobile on an unmounted component — a React warning.
 *
 * ─── BREAKPOINT VALUE ────────────────────────────────────────────────────────
 * 768px is the conventional "tablet" breakpoint used by Bootstrap, Tailwind,
 * and most design systems. Below it we treat the device as mobile and show
 * the drawer sidebar; at or above it we show the persistent sidebar.
 */
import { useState, useEffect } from 'react';

// The viewport width below which we consider the device "mobile."
// Exported so Layout.jsx and Sidebar.jsx both use the same constant —
// one place to change it if the breakpoint ever needs to shift.
export const MOBILE_BREAKPOINT = 768;

/**
 * useMobile — returns true when viewport width < MOBILE_BREAKPOINT.
 *
 * @returns {boolean}
 */
export function useMobile() {
  // Lazy initializer: reads window.innerWidth exactly once on mount.
  // This ensures the component renders with the correct value immediately —
  // no flash of wrong layout on the first paint.
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    // handleResize is called every time the browser fires the 'resize' event
    // (which happens when the window is resized or the device is rotated).
    function handleResize() {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      // React batches state updates, so even if 'resize' fires rapidly
      // (dozens of times per second during a drag), React only re-renders
      // once per animation frame — no performance concern here.
    }

    window.addEventListener('resize', handleResize);

    // Cleanup: remove the listener when the component unmounts so we don't
    // hold a stale reference to setIsMobile after the component is gone.
    return () => window.removeEventListener('resize', handleResize);
  }, []); // empty deps — set up once on mount, tear down on unmount

  return isMobile;
}
