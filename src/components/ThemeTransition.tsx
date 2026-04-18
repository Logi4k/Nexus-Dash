import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────────────────────────────────────
   Theme Transition — Radial reveal
   Button press:
     1. Old-theme bg is captured; CSS transitions are suppressed
     2. Theme class (.theme-bw) switches immediately on the DOM
     3. An overlay in the OLD bg covers the now-new-colored page
     4. A circle in the NEW bg expands from the button, revealing the
        new theme as it grows — like a hole punching through the overlay
     5. At animation end, overlay is removed and transitions are restored
   The visual effect: new theme "washes in" from the button as a circle.
───────────────────────────────────────────────────────────────────────────── */

const ANIM_DURATION = 420; // ms — visible enough to read, still short enough to stay responsive
const RIPPLE_SIZE = "200vmax";

/** Capture current --bg-base before the switch */
function getBaseBg(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--bg-base").trim() || "#080a10";
}

/**
 * Remove any stale inline CSS custom-property overrides on :root.
 * Previous versions of this module set vars via style.setProperty which
 * persist across toggles and conflict with the CSS cascade — clean them up.
 */
const PRESERVED_ROOT_VARS = new Set(["--accent", "--accent-rgb", "--accent-bright", "--accent-dim"]);

function clearInlineVars() {
  const root = document.documentElement;
  const toRemove: string[] = [];
  for (let i = 0; i < root.style.length; i++) {
    const prop = root.style[i];
    if (prop.startsWith("--") && !PRESERVED_ROOT_VARS.has(prop)) toRemove.push(prop);
  }
  toRemove.forEach(p => root.style.removeProperty(p));
}

// Singleton state
let activeRipple: { x: number; y: number; id: number; oldBg: string } | null = null;
let rippleListeners: Array<(r: typeof activeRipple) => void> = [];

function subscribeRipple(cb: (r: typeof activeRipple) => void) {
  rippleListeners.push(cb);
  return () => { rippleListeners = rippleListeners.filter(l => l !== cb); };
}

function emitRipple(x: number, y: number, oldBg: string) {
  const id = Date.now();
  activeRipple = { x, y, id, oldBg };
  rippleListeners.forEach(cb => cb(activeRipple));
  setTimeout(() => {
    if (activeRipple?.id === id) {
      activeRipple = null;
      rippleListeners.forEach(cb => cb(null));
    }
  }, ANIM_DURATION + 80);
}

// Inject keyframes once
function ensureAnimStyle() {
  if (document.getElementById("tt-anim")) return;
  const s = document.createElement("style");
  s.id = "tt-anim";
  s.textContent = `
    @keyframes tt-radial {
      0%   { transform: translate(-50%,-50%) scale(0); }
      100% { transform: translate(-50%,-50%) scale(1); }
    }
  `;
  document.head.appendChild(s);
}

function ThemeRipplePortal() {
  const [ripple, setRipple] = useState<typeof activeRipple>(null);

  useEffect(() => {
    ensureAnimStyle();
    return subscribeRipple(setRipple);
  }, []);

  if (!ripple) return null;

  return createPortal(
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-theme-flash)",
        pointerEvents: "none",
        overflow: "hidden",
        // OLD theme bg — covers the now-new-colored page
        background: ripple.oldBg,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: ripple.x,
          top: ripple.y,
          width: RIPPLE_SIZE,
          height: RIPPLE_SIZE,
          // NEW theme bg — the circle reveals new theme as it grows
          background: "var(--bg-base)",
          borderRadius: "50%",
          transform: "translate(-50%,-50%) scale(0)",
          animation: `tt-radial ${ANIM_DURATION}ms cubic-bezier(0.3, 0, 0.1, 1) forwards`,
          willChange: "transform",
        }}
      />
    </div>,
    document.body
  );
}

/**
 * useThemeTransition
 *
 * onToggle — called with the new theme ("dark" | "bw").
 *
 * Returns:
 *   activate(el) — call with the toggle button element.
 *   ripple      — portal element. Render once in component tree.
 */
export function useThemeTransition(onToggle: (newTheme: string) => void) {
  const onToggleRef = useRef(onToggle);
  useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);

  const activate = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width  / 2;
    const y = rect.top  + rect.height / 2;

    const root = document.documentElement;
    const current = root.getAttribute("data-theme") ?? "dark";
    const next = current === "dark" ? "bw" : "dark";

    // 1. Capture old base bg BEFORE anything changes
    const oldBg = getBaseBg();

    // 2. Suppress CSS transitions so background/color don't animate independently
    //    of the ripple overlay (prevents the white flash)
    root.classList.add("theme-transitioning");

    // 3. Clear any stale inline CSS var overrides from previous toggle cycles
    clearInlineVars();

    // 4. Switch theme immediately on the DOM — class toggle is synchronous so
    //    every CSS var resolves to the new theme before the next paint
    root.classList.toggle("theme-bw", next === "bw");
    root.setAttribute("data-theme", next);

    // 5. Fire the overlay + ripple animation
    emitRipple(x, y, oldBg);

    // 6. Notify React state — deferred one frame to avoid re-render jank
    //    during animation start. ThemeApplier in App.tsx will also toggle
    //    .theme-bw but it's idempotent (same value we already set above).
    requestAnimationFrame(() => {
      onToggleRef.current(next);
    });

    // 7. Re-enable CSS transitions after the ripple animation completes
    setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, ANIM_DURATION + 80);
  }, []);

  return { activate, ripple: <ThemeRipplePortal /> };
}
