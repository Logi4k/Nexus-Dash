import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(__dirname, "index.html"),
    path.join(__dirname, "src/**/*.{js,ts,jsx,tsx}"),
  ],
  theme: {
    extend: {
      colors: {
        // ── Backgrounds (CSS-variable driven for theme switching) ─────
        bg: {
          base:     "var(--bg-base)",
          card:     "var(--bg-card)",
          elevated: "var(--bg-elevated)",
          input:    "var(--bg-input)",
          hover:    "var(--bg-hover)",
          subtle:   "var(--bg-subtle)",
        },
        // ── Borders ──────────────────────────────────────────────────
        border: {
          subtle:   "rgba(var(--border-rgb),0.07)",
          DEFAULT:  "rgba(var(--border-rgb),0.09)",
          strong:   "rgba(var(--border-rgb),0.16)",
          accent:   "rgba(var(--border-rgb),0.20)",
        },
        // ── Text ─────────────────────────────────────────────────────
        tx: {
          1: "var(--tx-1)",
          2: "var(--tx-2)",
          3: "var(--tx-3)",
          4: "var(--tx-4)",
        },
        // ── Accent ───────────────────────────────────────────────────
        accent: {
          DEFAULT: "var(--accent)",
          strong:  "var(--accent-strong)",
          bright:  "var(--accent-bright)",
          dim:     "var(--accent-dim)",
          muted:   "rgba(var(--surface-rgb),0.08)",
          glow:    "var(--accent-glow)",
          border:  "var(--accent-border)",
        },
        // ── Semantic (CSS-var driven — single source of truth) ───────
        profit: "var(--color-profit)",
        loss:   "var(--color-loss)",
        warn:   "var(--color-warn)",
        info:   "var(--color-blue)",
        purple: "var(--color-purple)",
      },

      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', "monospace"],
      },

      fontSize: {
        "xxs":     "var(--text-xs)",
        "display": "var(--text-display)",
      },

      borderRadius: {
        "md":  "var(--radius-md)",
        "lg":  "var(--radius-lg)",
        "xl":  "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        "4xl": "28px",
      },

      transitionDuration: {
        "instant": "80ms",
        "fast":    "160ms",
        "base":    "220ms",
        "medium":  "280ms",
        "slow":    "420ms",
      },

      transitionTimingFunction: {
        "standard":  "var(--motion-curve)",
        "entrance":  "var(--motion-entrance)",
        "exit":      "var(--motion-exit)",
      },

      zIndex: {
        "base":        "var(--z-base)",
        "dropdown":    "var(--z-dropdown)",
        "sticky":      "var(--z-sticky)",
        "mobile-nav":  "var(--z-mobile-nav)",
        "fab":         "var(--z-fab)",
        "drawer":      "var(--z-drawer)",
        "palette":     "var(--z-cmd-palette)",
        "modal-bg":    "var(--z-modal-bg)",
        "modal":       "var(--z-modal)",
        "picker-bg":   "var(--z-picker-bg)",
        "picker":      "var(--z-picker)",
        "lightbox":    "var(--z-lightbox)",
        "toast":       "var(--z-toast)",
      },

      boxShadow: {
        "card":       "var(--elev-1)",
        "card-lg":    "var(--elev-2)",
        "card-hover": "var(--elev-3)",
        "modal":      "var(--elev-4)",
        "glow-teal":  "0 0 8px rgba(var(--color-teal-rgb), 0.08)",
        "glow-green": "0 0 8px rgba(var(--color-profit-rgb), 0.08)",
        "glow-red":   "0 0 8px rgba(var(--color-loss-rgb), 0.08)",
        "inner-glow": "inset 0 1px 0 rgba(var(--surface-rgb), 0.07)",
      },

      backgroundImage: {
        "card-shine":  "linear-gradient(135deg, rgba(var(--surface-rgb),0.06) 0%, rgba(var(--surface-rgb),0.02) 50%, rgba(var(--surface-rgb),0.04) 100%)",
        "accent-grad": "linear-gradient(135deg, var(--accent-bright) 0%, var(--accent) 100%)",
        "profit-grad": "linear-gradient(135deg, var(--color-profit) 0%, color-mix(in srgb, var(--color-profit) 78%, black) 100%)",
        "loss-grad":   "linear-gradient(135deg, var(--color-loss) 0%, color-mix(in srgb, var(--color-loss) 78%, black) 100%)",
      },

      animation: {
        "fade-up":    "fadeUp 0.18s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in":    "fadeIn 0.28s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-in":   "slideIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-up":   "slideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "shimmer":    "shimmer 2.2s linear infinite",
        "pulse-dot":  "pulseDot 2s ease-in-out infinite",
        "float":      "float 6s ease-in-out infinite",
        "spin-slow":  "spin 8s linear infinite",
      },

      keyframes: {
        fadeUp:   { "0%": { opacity:"0" }, "100%": { opacity:"1" } },
        fadeIn:   { "0%": { opacity:"0" }, "100%": { opacity:"1" } },
        slideIn:  { "0%": { opacity:"0", transform:"translateX(-10px)" }, "100%": { opacity:"1", transform:"translateX(0)" } },
        slideUp:  { "0%": { opacity:"0", transform:"translateY(8px)" }, "100%": { opacity:"1", transform:"translateY(0)" } },
        shimmer:  { "0%": { backgroundPosition:"-200% 0" }, "100%": { backgroundPosition:"200% 0" } },
        pulseDot: { "0%, 100%": { opacity:"1", transform:"scale(1)" }, "50%": { opacity:"0.4", transform:"scale(0.85)" } },
        float:    { "0%, 100%": { transform:"translateY(0)" }, "50%": { transform:"translateY(-8px)" } },
      },
    },
  },
  plugins: [],
};
