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
          bright:  "var(--accent-bright)",
          dim:     "var(--accent-dim)",
          muted:   "rgba(var(--surface-rgb),0.08)",
          glow:    "rgba(var(--surface-rgb),0.10)",
        },
        // ── Semantic ─────────────────────────────────────────────────
        profit: "#22c55e",
        loss:   "#ef4444",
        warn:   "#f59e0b",
        info:   "#3b82f6",
        purple: "#a855f7",
      },

      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', "monospace"],
      },

      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
        "4xl": "24px",
      },

      boxShadow: {
        "card":       "0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)",
        "card-lg":    "0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
        "card-hover": "0 12px 40px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.5)",
        "glow-teal":  "0 0 8px rgba(255,255,255,0.04)",
        "glow-green": "0 0 8px rgba(34,197,94,0.08)",
        "glow-red":   "0 0 8px rgba(239,68,68,0.08)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.07)",
        "modal":      "0 24px 64px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5)",
      },

      backgroundImage: {
        "hero":         "linear-gradient(135deg, #111520 0%, #0d1018 45%, #080a10 100%)",
        "hero-teal":    "linear-gradient(135deg, #111520 0%, #0d1018 50%, #080a10 100%)",
        "card-shine":   "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.04) 100%)",
        "accent-grad":  "linear-gradient(135deg, #f1f5f9 0%, #ffffff 100%)",
        "profit-grad":  "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
        "loss-grad":    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
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
