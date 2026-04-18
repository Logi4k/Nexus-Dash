// Single source of truth for per-page accent colours.
// To retheme any page or do a full colour rework, change this file only.

export const PAGE_THEMES = {
  dashboard:   { accent: "#b98b54", dim: "rgba(185,139,84,0.12)",  border: "rgba(185,139,84,0.26)",  glow: "rgba(185,139,84,0.13)",  name: "Ledger"   },
  market:      { accent: "#86939f", dim: "rgba(134,147,159,0.11)", border: "rgba(134,147,159,0.24)", glow: "rgba(134,147,159,0.11)", name: "Steel"    },
  journal:     { accent: "#6ba5a5", dim: "rgba(107,165,165,0.12)", border: "rgba(107,165,165,0.25)", glow: "rgba(107,165,165,0.12)", name: "Teal"     },
  prop:        { accent: "#7f9084", dim: "rgba(127,144,132,0.11)", border: "rgba(127,144,132,0.23)", glow: "rgba(127,144,132,0.11)", name: "Sage"     },
  expenses:    { accent: "#aa7b60", dim: "rgba(170,123,96,0.11)",  border: "rgba(170,123,96,0.23)",  glow: "rgba(170,123,96,0.11)",  name: "Copper"   },
  debt:        { accent: "#927375", dim: "rgba(146,115,117,0.11)", border: "rgba(146,115,117,0.23)", glow: "rgba(146,115,117,0.11)", name: "Merlot"   },
  investments: { accent: "#789191", dim: "rgba(120,145,145,0.11)", border: "rgba(120,145,145,0.23)", glow: "rgba(120,145,145,0.11)", name: "Patina"   },
  tax:         { accent: "#8a7ab5", dim: "rgba(138,122,181,0.11)", border: "rgba(138,122,181,0.23)", glow: "rgba(138,122,181,0.11)", name: "Violet"   },
  ideas:       { accent: "#85879a", dim: "rgba(133,135,154,0.11)", border: "rgba(133,135,154,0.23)", glow: "rgba(133,135,154,0.11)", name: "Dusk"     },
} as const;

export type PageThemeKey = keyof typeof PAGE_THEMES;
export type PageTheme = typeof PAGE_THEMES[PageThemeKey];

/** Map URL path to the page theme key (longest-prefix wins before `/`). */
export function getPageThemeKeyForPath(pathname: string): PageThemeKey {
  const p = pathname || "/";
  if (p === "/") return "dashboard";
  const routes: [string, PageThemeKey][] = [
    ["/market", "market"],
    ["/journal", "journal"],
    ["/ideas", "ideas"],
    ["/prop", "prop"],
    ["/expenses", "expenses"],
    ["/debt", "debt"],
    ["/tax", "tax"],
    ["/investments", "investments"],
  ];
  for (const [prefix, key] of routes) {
    if (p.startsWith(prefix)) return key;
  }
  return "dashboard";
}

/** `#rrggbb` → `r,g,b` for `rgba(var(--accent-rgb), a)` (6-digit hex only after BW transform). */
export function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "").slice(0, 6);
  if (h.length !== 6 || !/^[0-9a-f]+$/i.test(h)) return "196,160,107";
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
