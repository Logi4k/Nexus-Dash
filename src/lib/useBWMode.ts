import { useSyncExternalStore } from "react";

// ──────────────────────────────────────────────────────────────────────────────
// BW-mode detection hook + colour helpers
//
// Usage:
//   const isBW = useBWMode();
//   const color = bwColor("#3b82f6", isBW);  // returns grayscale in BW mode
//
//   // For semantic P&L colors that should KEEP their hue even in BW mode:
//   const c = semanticColor(pnl >= 0 ? "#22c55e" : "#ef4444"); // always colored
// ──────────────────────────────────────────────────────────────────────────────

/** Subscribe to the `theme-bw` class on <html>. Re-renders when it changes. */
function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("theme-bw");
}

function getServerSnapshot() {
  return false;
}

/** React hook – returns `true` when B&W theme is active. */
export function useBWMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ── Colour conversion ────────────────────────────────────────────────────────

/** Parse a hex colour (#rgb or #rrggbb) to [r, g, b]. */
function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length >= 6) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return null;
}

/** Convert [r,g,b] to perceptual luminance (0-255) using ITU-R BT.601. */
function luminance(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

/**
 * Convert a hex colour to its grayscale equivalent.
 * Preserves any trailing alpha hex digits (e.g. `#3b82f680` → `#7a7a7a80`).
 */
function toGrayscale(hex: string): string {
  const clean = hex.replace("#", "");
  const hasAlpha = clean.length === 8;
  const alphaHex = hasAlpha ? clean.slice(6, 8) : "";
  const rgb = hexToRgb("#" + clean.slice(0, 6));
  if (!rgb) return hex; // can't parse – return as-is
  const g = luminance(...rgb);
  const gray = g.toString(16).padStart(2, "0");
  return `#${gray}${gray}${gray}${alphaHex}`;
}

/**
 * Convert a color to grayscale when BW mode is active.
 * Pass-through when BW mode is off.
 *
 * Handles:
 * - `#rrggbb` / `#rrggbbaa` hex → grayscale hex
 * - `rgba(r,g,b,a)` → grayscale rgba
 * - CSS variables `var(--xxx)` → returned as-is (already themed)
 *
 * @param color The color string
 * @param isBW  Whether BW mode is active
 */
export function bwColor(color: string, isBW: boolean): string {
  if (!isBW) return color;
  if (!color) return color;

  // Already a CSS variable – let CSS handle it
  if (color.startsWith("var(")) return color;

  // Hex colour
  if (color.startsWith("#")) return toGrayscale(color);

  // linear-gradient — convert all hex/rgba inside (check before bare rgba)
  if (color.startsWith("linear-gradient")) {
    return color.replace(/#[0-9a-fA-F]{3,8}/g, (match) => toGrayscale(match))
                .replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/g,
                  (_match, r, g, b, a) => {
                    const gray = luminance(parseInt(r), parseInt(g), parseInt(b));
                    return a !== undefined
                      ? `rgba(${gray},${gray},${gray},${a})`
                      : `rgb(${gray},${gray},${gray})`;
                  });
  }

  // rgba(r,g,b,a) or rgb(r,g,b)
  const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]);
    const g = parseInt(rgbaMatch[2]);
    const b = parseInt(rgbaMatch[3]);
    const a = rgbaMatch[4];
    const gray = luminance(r, g, b);
    return a !== undefined
      ? `rgba(${gray},${gray},${gray},${a})`
      : `rgb(${gray},${gray},${gray})`;
  }

  return color;
}

/**
 * Returns BW-aware versions of a PAGE_THEME object.
 * In BW mode, all colours become grayscale.
 * Preserves all other properties (e.g. `name`).
 */
export function bwPageTheme<T extends { accent: string; dim: string; border: string; glow: string }>(
  theme: T,
  isBW: boolean,
): T {
  if (!isBW) return theme;
  return {
    ...theme,
    accent: bwColor(theme.accent, true),
    dim: bwColor(theme.dim, true),
    border: bwColor(theme.border, true),
    glow: bwColor(theme.glow, true),
  };
}
