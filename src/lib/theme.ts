// Single source of truth for per-page accent colours.
// To retheme any page or do a full colour rework, change this file only.

export const PAGE_THEMES = {
  dashboard:   { accent: "#8b9eb5", dim: "rgba(139,158,181,0.08)",  border: "rgba(139,158,181,0.18)",  glow: "rgba(139,158,181,0.08)",  name: "Slate"     },
  market:      { accent: "#7ea8b8", dim: "rgba(126,168,184,0.08)",  border: "rgba(126,168,184,0.18)",  glow: "rgba(126,168,184,0.08)",  name: "Steel Blue"},
  journal:     { accent: "#c4a35a", dim: "rgba(196,163,90,0.07)",   border: "rgba(196,163,90,0.15)",   glow: "rgba(196,163,90,0.07)",   name: "Antique"   },
  prop:        { accent: "#5a9e8f", dim: "rgba(90,158,143,0.08)",   border: "rgba(90,158,143,0.16)",   glow: "rgba(90,158,143,0.07)",   name: "Jade"      },
  expenses:    { accent: "#b87070", dim: "rgba(184,112,112,0.08)",  border: "rgba(184,112,112,0.16)",  glow: "rgba(184,112,112,0.07)",  name: "Dusty Rose"},
  debt:        { accent: "#a05050", dim: "rgba(160,80,80,0.08)",     border: "rgba(160,80,80,0.16)",    glow: "rgba(160,80,80,0.07)",    name: "Brick"     },
  investments: { accent: "#5a8f8f", dim: "rgba(90,143,143,0.08)",    border: "rgba(90,143,143,0.16)",   glow: "rgba(90,143,143,0.07)",   name: "Patina"    },
  tax:         { accent: "#b09060", dim: "rgba(176,144,96,0.08)",   border: "rgba(176,144,96,0.16)",   glow: "rgba(176,144,96,0.07)",   name: "Bronze"    },
  ideas:       { accent: "#7882b0", dim: "rgba(120,130,176,0.08)",   border: "rgba(120,130,176,0.16)",   glow: "rgba(120,130,176,0.07)",   name: "Storm"     },
} as const;

export type PageThemeKey = keyof typeof PAGE_THEMES;
export type PageTheme = typeof PAGE_THEMES[PageThemeKey];
