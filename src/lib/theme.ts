// Single source of truth for per-page accent colours.
// To retheme any page or do a full colour rework, change this file only.

export const PAGE_THEMES = {
  dashboard:   { accent: "#4f7cff", dim: "rgba(79,124,255,0.08)",  border: "rgba(79,124,255,0.18)",  glow: "rgba(79,124,255,0.12)",  name: "Cobalt"  },
  market:      { accent: "#7dd3fc", dim: "rgba(125,211,252,0.08)", border: "rgba(125,211,252,0.18)", glow: "rgba(125,211,252,0.12)", name: "Ice Cyan" },
  journal:     { accent: "#fbbf24", dim: "rgba(251,191,36,0.07)",  border: "rgba(251,191,36,0.15)",  glow: "rgba(251,191,36,0.10)",  name: "Amber"   },
  prop:        { accent: "#34d399", dim: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.16)",  glow: "rgba(52,211,153,0.10)",  name: "Emerald" },
  expenses:    { accent: "#fb7185", dim: "rgba(251,113,133,0.08)", border: "rgba(251,113,133,0.16)", glow: "rgba(251,113,133,0.10)", name: "Coral"   },
  debt:        { accent: "#ef4444", dim: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.16)",   glow: "rgba(239,68,68,0.10)",   name: "Crimson" },
  investments: { accent: "#14b8a6", dim: "rgba(20,184,166,0.08)",  border: "rgba(20,184,166,0.16)",  glow: "rgba(20,184,166,0.10)",  name: "Teal"    },
  tax:         { accent: "#d6a44d", dim: "rgba(214,164,77,0.08)",  border: "rgba(214,164,77,0.16)",  glow: "rgba(214,164,77,0.10)",  name: "Brass"   },
  ideas:       { accent: "#6366f1", dim: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.16)",  glow: "rgba(99,102,241,0.10)",  name: "Indigo"  },
} as const;

export type PageThemeKey = keyof typeof PAGE_THEMES;
export type PageTheme = typeof PAGE_THEMES[PageThemeKey];
