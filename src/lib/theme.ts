// Single source of truth for per-page accent colours.
// To retheme any page or do a full colour rework, change this file only.

export const PAGE_THEMES = {
  dashboard:   { accent: "#818cf8", dim: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.18)", glow: "rgba(129,140,248,0.12)", name: "Indigo"  },
  market:      { accent: "#38bdf8", dim: "rgba(14,165,233,0.08)",  border: "rgba(14,165,233,0.18)",  glow: "rgba(14,165,233,0.12)",  name: "Sky"     },
  journal:     { accent: "#fbbf24", dim: "rgba(251,191,36,0.07)",  border: "rgba(251,191,36,0.15)",  glow: "rgba(251,191,36,0.10)",  name: "Amber"   },
  prop:        { accent: "#4ade80", dim: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.16)",   glow: "rgba(34,197,94,0.10)",   name: "Green"   },
  expenses:    { accent: "#2dd4bf", dim: "rgba(20,184,166,0.08)",  border: "rgba(20,184,166,0.16)",  glow: "rgba(20,184,166,0.10)",  name: "Teal"    },
  debt:        { accent: "#f87171", dim: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.15)",   glow: "rgba(239,68,68,0.10)",   name: "Red"     },
  investments: { accent: "#c084fc", dim: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.16)",  glow: "rgba(168,85,247,0.10)",  name: "Purple"  },
  tax:         { accent: "#fb923c", dim: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.15)",  glow: "rgba(249,115,22,0.10)",  name: "Orange"  },
  ideas:       { accent: "#f472b6", dim: "rgba(236,72,153,0.08)",  border: "rgba(236,72,153,0.15)",  glow: "rgba(236,72,153,0.10)",  name: "Pink"    },
} as const;

export type PageThemeKey = keyof typeof PAGE_THEMES;
export type PageTheme = typeof PAGE_THEMES[PageThemeKey];
