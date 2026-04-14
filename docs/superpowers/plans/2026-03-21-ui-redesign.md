# Nexus UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Nexus trader dashboard with Vibrant Dark theme, DM Sans font, adaptive responsive layout (mobile/tablet/desktop), interactive filter bars on every data page, and a new Notion-style Ideas & Research page.

**Architecture:** Shell-swap approach — replace Layout, Sidebar, and navigation components while leaving the data layer (store.ts, types, Tauri backend) completely untouched. A single `theme.ts` token file drives all per-page accent colours so rethemes require only one file change. Pages are redesigned iteratively after the shell is in place.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS 3, Framer Motion, Recharts, Lucide React, DM Sans (Google Fonts). No test runner — verify with `npm run dev` (runs at http://localhost:1420).

**Spec:** `docs/superpowers/specs/2026-03-21-ui-redesign-design.md`

---

## File Map

### New files
- `src/lib/theme.ts` — per-page accent colour tokens (single source of truth)
- `src/components/MobileNav.tsx` — bottom tab bar for mobile
- `src/components/FilterBar.tsx` — shared filter component used by all data pages
- `src/pages/Ideas.tsx` — new Ideas & Research page
- `src/components/NoteEditor.tsx` — block-based note editor (used by Ideas page)
- `src/components/BlockRenderer.tsx` — renders a single NoteBlock (used by NoteEditor)

### Modified files
- `src/index.css` — swap Inter → DM Sans, updated type scale, raised text contrast tokens
- `tailwind.config.js` — font family update
- `src/lib/store.ts` — no logic changes; AppData already handles new keys via mergeWithSeed
- `src/types/index.ts` — add IdeaNote, IdeaTopic, NoteBlock types; add to AppData
- `src/App.tsx` — add /ideas route
- `src/components/Layout.tsx` — responsive shell (replace entirely)
- `src/components/Sidebar.tsx` — adaptive sidebar (replace entirely)
- `src/pages/Dashboard.tsx` — redesigned with Vibrant Dark + FilterBar
- `src/pages/Journal.tsx` — redesigned with Vibrant Dark + FilterBar
- `src/pages/PropAccounts.tsx` — redesigned with Vibrant Dark + FilterBar
- `src/pages/Market.tsx` — redesigned with Vibrant Dark + FilterBar
- `src/pages/Expenses.tsx` — redesigned with Vibrant Dark + FilterBar
- `src/pages/Investments.tsx` — redesigned with Vibrant Dark + FilterBar
- `src/pages/Debt.tsx` — redesigned with Vibrant Dark + FilterBar
- `src/pages/Tax.tsx` — redesigned with Vibrant Dark (no filters needed)
- `src-tauri/tauri.conf.json` — remove minWidth/minHeight constraints
- `index.html` — add DM Sans Google Fonts link

---

## Task 1: Design Tokens & Font

**Files:**
- Modify: `src/index.css`
- Modify: `tailwind.config.js`
- Modify: `index.html`
- Create: `src/lib/theme.ts`

- [ ] **Step 1: Add DM Sans to index.html**

Replace the Google Fonts import in `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Update index.css — font, base variables, type scale**

Replace the `@import` line at the top of `src/index.css`:
```css
/* Remove the existing @import url("https://fonts.googleapis.com/...") line */
```

Update the `body` font in the `@layer base` section:
```css
body {
  background-color: var(--bg-base);
  color: var(--tx-1);
  font-family: "DM Sans", system-ui, sans-serif;
  overflow: hidden;
  user-select: none;
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

Update the `:root` text variables to raise contrast:
```css
/* text — raised contrast vs original */
--tx-1: #f8fafc;
--tx-2: rgba(255,255,255,0.75);
--tx-3: rgba(255,255,255,0.55);
--tx-4: rgba(255,255,255,0.40);
```

- [ ] **Step 3: Update tailwind.config.js font family**

Replace the `fontFamily` block:
```js
fontFamily: {
  sans: ['"DM Sans"', "system-ui", "sans-serif"],
  mono: ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', "monospace"],
},
```

- [ ] **Step 4: Create src/lib/theme.ts**

```ts
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
```

- [ ] **Step 5: Verify visually**

Run `npm run dev` in `D:/2 Claude/NewDashDesign/nexus`. Open http://localhost:1420.
Expected: DM Sans font visible — body text will look slightly rounder/cleaner than Inter. Text contrast slightly higher.

---

## Task 2: Type Additions

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add Ideas types to src/types/index.ts**

Append to the end of the file (before the last export):
```ts
// ── Ideas & Research page types ─────────────────────────────────────────────

export type NoteBlockType =
  | "text" | "h1" | "h2" | "h3"
  | "bullet" | "numbered" | "todo"
  | "quote" | "callout" | "code"
  | "divider" | "image" | "link-bookmark"
  | "columns";

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  content: string;          // plain text, or JSON string for columns/link-bookmark
  checked?: boolean;        // todo blocks
  language?: string;        // code blocks
  emoji?: string;           // callout blocks
  meta?: {                  // link-bookmark: { title, description, favicon }
    title?: string;
    description?: string;
    favicon?: string;
    url?: string;
  };
}

export interface IdeaTopic {
  id: string;
  name: string;
  emoji: string;
}

export interface IdeaNote {
  id: string;
  topicId: string;
  title: string;
  blocks: NoteBlock[];
  tags: string[];
  createdAt: string;   // ISO string
  updatedAt: string;   // ISO string
}
```

- [ ] **Step 2: Add ideaTopics and ideaNotes to AppData interface**

In `src/types/index.ts`, find the `AppData` interface and add two new optional fields:
```ts
ideaTopics?: IdeaTopic[];
ideaNotes?: IdeaNote[];
```

---

## Task 3: Adaptive Layout Shell

**Files:**
- Modify: `src/components/Layout.tsx` (replace entirely)
- Modify: `src/components/Sidebar.tsx` (replace entirely)
- Create: `src/components/MobileNav.tsx`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Remove minWidth/minHeight from tauri.conf.json**

In `src-tauri/tauri.conf.json`, update the windows config:
```json
{
  "title": "Nexus — Trader Dashboard",
  "width": 1440,
  "height": 900,
  "resizable": true,
  "fullscreen": false,
  "decorations": true,
  "transparent": false
}
```
(Remove `minWidth` and `minHeight` entirely.)

- [ ] **Step 2: Create MobileNav.tsx**

Create `src/components/MobileNav.tsx`:
```tsx
import { NavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  LayoutGrid, LineChart, NotebookPen, Briefcase,
  Wallet, Landmark, Scale, PieChart, Lightbulb,
  MoreHorizontal, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_THEMES } from "@/lib/theme";

// Primary tabs shown in the bottom bar (max 5)
const PRIMARY_NAV = [
  { path: "/",        label: "Dashboard", Icon: LayoutGrid,  theme: PAGE_THEMES.dashboard },
  { path: "/market",  label: "Market",    Icon: LineChart,   theme: PAGE_THEMES.market    },
  { path: "/journal", label: "Journal",   Icon: NotebookPen, theme: PAGE_THEMES.journal   },
  { path: "/prop",    label: "Prop",      Icon: Briefcase,   theme: PAGE_THEMES.prop      },
];

// Overflow pages in the "More" sheet
const MORE_NAV = [
  { path: "/expenses",    label: "Expenses",    Icon: Wallet,   theme: PAGE_THEMES.expenses    },
  { path: "/debt",        label: "Debt",        Icon: Landmark, theme: PAGE_THEMES.debt        },
  { path: "/tax",         label: "Tax",         Icon: Scale,    theme: PAGE_THEMES.tax         },
  { path: "/investments", label: "Investments", Icon: PieChart, theme: PAGE_THEMES.investments },
  { path: "/ideas",       label: "Ideas",       Icon: Lightbulb,theme: PAGE_THEMES.ideas       },
];

export default function MobileNav() {
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_NAV.some(n => loc.pathname.startsWith(n.path));

  return (
    <>
      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          background: "#070810",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-center justify-around px-2 h-16">
          {PRIMARY_NAV.map(({ path, label, Icon, theme }) => {
            const isActive = path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(path);
            return (
              <NavLink
                key={path}
                to={path}
                className="flex flex-col items-center gap-1 flex-1 py-2"
                onClick={() => setMoreOpen(false)}
              >
                <div
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                  style={isActive ? { background: theme.dim, border: `1px solid ${theme.border}` } : {}}
                >
                  <Icon size={16} style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.35)" }} />
                </div>
                <span className="text-[10px] font-semibold" style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.35)" }}>
                  {label}
                </span>
              </NavLink>
            );
          })}

          {/* More button */}
          <button
            className="flex flex-col items-center gap-1 flex-1 py-2"
            onClick={() => setMoreOpen(v => !v)}
          >
            <div
              className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
              style={isMoreActive || moreOpen ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" } : {}}
            >
              {moreOpen
                ? <X size={16} style={{ color: "rgba(255,255,255,0.7)" }} />
                : <MoreHorizontal size={16} style={{ color: isMoreActive ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)" }} />
              }
            </div>
            <span className="text-[10px] font-semibold" style={{ color: isMoreActive || moreOpen ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)" }}>
              More
            </span>
          </button>
        </div>
      </nav>

      {/* More sheet overlay */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 rounded-t-2xl p-4"
            style={{ background: "#0a0c18", borderTop: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-3">
              {MORE_NAV.map(({ path, label, Icon, theme }) => {
                const isActive = loc.pathname.startsWith(path);
                return (
                  <NavLink
                    key={path}
                    to={path}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl transition-all"
                    style={isActive
                      ? { background: theme.dim, border: `1px solid ${theme.border}` }
                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }
                    }
                    onClick={() => setMoreOpen(false)}
                  >
                    <Icon size={20} style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.5)" }} />
                    <span className="text-[11px] font-semibold" style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.5)" }}>
                      {label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Replace Layout.tsx**

Replace `src/components/Layout.tsx` entirely:
```tsx
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

export default function Layout() {
  const loc = useLocation();
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      {/* Sidebar — hidden on mobile, visible md+ */}
      <div className="hidden md:flex h-full flex-shrink-0">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div key={loc.pathname} className="page-enter min-h-full p-4 md:p-6 pb-20 md:pb-12">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav — visible only on mobile */}
      <MobileNav />
    </div>
  );
}
```

- [ ] **Step 4: Replace Sidebar.tsx**

Replace `src/components/Sidebar.tsx` entirely with the new adaptive sidebar. This is a significant rewrite — the sidebar now uses `PAGE_THEMES` for the active item accent colour and supports tablet (icon-only) mode via CSS:

```tsx
import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutGrid, LineChart, NotebookPen, Briefcase,
  Wallet, Landmark, Scale, PieChart, Lightbulb,
  ChevronLeft, ChevronRight, Zap, Settings,
} from "lucide-react";
import { cn, fmtGBP, toNum } from "@/lib/utils";
import { useAppData } from "@/lib/store";
import { PAGE_THEMES, type PageThemeKey } from "@/lib/theme";
import NotificationBell from "@/components/NotificationBell";
import SettingsModal from "@/components/SettingsModal";

const NAV: { path: string; label: string; Icon: React.ElementType; themeKey: PageThemeKey }[] = [
  { path: "/",            label: "Dashboard",     Icon: LayoutGrid,   themeKey: "dashboard"   },
  { path: "/market",      label: "Market",        Icon: LineChart,     themeKey: "market"      },
  { path: "/journal",     label: "Journal",       Icon: NotebookPen,   themeKey: "journal"     },
  { path: "/prop",        label: "Prop Accounts", Icon: Briefcase,     themeKey: "prop"        },
  { path: "/expenses",    label: "Expenses",      Icon: Wallet,        themeKey: "expenses"    },
  { path: "/debt",        label: "Debt",          Icon: Landmark,      themeKey: "debt"        },
  { path: "/tax",         label: "Tax",           Icon: Scale,         themeKey: "tax"         },
  { path: "/investments", label: "Investments",   Icon: PieChart,      themeKey: "investments" },
  { path: "/ideas",       label: "Ideas",         Icon: Lightbulb,     themeKey: "ideas"       },
];

export default function Sidebar() {
  const { data } = useAppData();
  const loc = useLocation();
  const [now, setNow] = useState(new Date());
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebarCollapsed") === "true"; } catch { return false; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebarCollapsed", String(next)); } catch {}
      return next;
    });
  }

  // Computed values
  const totalWithdrawals = data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
  const totalExpenses    = data.expenses.reduce((s, e) => s + toNum(e.amount), 0);
  const totalDebt        = (data.debts || []).reduce((s, d) => s + d.currentBalance, 0)
                         + (data.otherDebts || []).reduce((s, d) => s + d.currentBalance, 0);
  const investVal        = data.investments.reduce((s, i) => s + toNum(i.units) * toNum(i.cur), 0);
  const t212Val          = data.t212?.total_value || 0;
  const netWorth         = totalWithdrawals - totalExpenses + investVal + t212Val - totalDebt;

  const activeFunded     = data.accounts.filter(a => ["funded","Funded"].includes(a.status)).length;
  const activeChallenges = data.accounts.filter(a => a.status === "Challenge").length;

  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  const username    = data.userProfile?.username ?? "Trader";
  const avatarColor = data.userProfile?.avatarColor ?? "#f472b6";
  const avatarUrl   = data.userProfile?.avatarUrl;
  const initials    = username.slice(0, 2).toUpperCase();

  // Determine active theme for accent colouring
  const activeNavItem = NAV.find(n => n.path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.path));
  const activeTheme   = activeNavItem ? PAGE_THEMES[activeNavItem.themeKey] : PAGE_THEMES.dashboard;

  // Tablet = collapsed but forced (md breakpoint logic handled by parent hiding/showing)
  const isCollapsed = collapsed;

  return (
    <>
      <aside
        className="flex flex-col h-full select-none flex-shrink-0 transition-all duration-200"
        style={{
          width: isCollapsed ? 64 : 240,
          background: "#07080f",
          borderRight: "1px solid rgba(255,255,255,0.07)",
          overflow: "hidden",
        }}
      >
        {/* ── Logo + Toggle ── */}
        <div className="px-3 pt-4 pb-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", minHeight: 56 }}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: activeTheme.dim, border: `1px solid ${activeTheme.border}` }}>
              <Zap size={13} style={{ color: activeTheme.accent }} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="font-black text-sm tracking-[0.18em] leading-none whitespace-nowrap" style={{ color: "#f8fafc" }}>
                  NEXUS
                </div>
                <div className="text-[9px] font-medium mt-0.5 whitespace-nowrap" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Trader Dashboard
                </div>
              </div>
            )}
          </div>
          <button onClick={toggleCollapse}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-all"
            style={{ color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {isCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
          </button>
        </div>

        {/* ── Net Worth Card (expanded only) ── */}
        {!isCollapsed && (
          <div className="px-3 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="rounded-xl p-3" style={{ background: activeTheme.dim, border: `1px solid ${activeTheme.border}` }}>
              <div className="text-[10px] font-medium mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>Net Worth</div>
              <div className="text-[22px] font-extrabold tabular-nums leading-tight tracking-tight"
                style={{ color: netWorth >= 0 ? "#f8fafc" : "#f87171" }}>
                {fmtGBP(netWorth)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg p-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.18)" }}>
                  <div className="text-[9px] font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Funded</div>
                  <div className="text-base font-black leading-none" style={{ color: "#4ade80" }}>{activeFunded}</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.16)" }}>
                  <div className="text-[9px] font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Challenges</div>
                  <div className="text-base font-black leading-none" style={{ color: "#fbbf24" }}>{activeChallenges}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV.map(({ path, label, Icon, themeKey }) => {
            const theme    = PAGE_THEMES[themeKey];
            const isActive = path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(path);
            return (
              <NavLink
                key={path}
                to={path}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden",
                  isCollapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
                )}
                style={isActive
                  ? { background: theme.dim, color: theme.accent, border: `1px solid ${theme.border}` }
                  : { color: "rgba(255,255,255,0.4)", border: "1px solid transparent" }
                }
              >
                {/* Active left bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                    style={{ height: "55%", background: theme.accent }} />
                )}
                {/* Icon */}
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg"
                  style={isActive ? { background: theme.glow } : {}}>
                  <Icon size={14} style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.4)" }} strokeWidth={isActive ? 2 : 1.75} />
                </div>
                {!isCollapsed && (
                  <span className="flex-1 truncate text-[13px]">{label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="px-3 py-2.5 flex flex-col gap-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs select-none overflow-hidden"
                style={avatarUrl ? {} : { background: avatarColor + "20", border: `1.5px solid ${avatarColor}50`, color: avatarColor }}>
                {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "#f8fafc" }}>{username}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{dateStr} · {timeStr}</p>
              </div>
              <div className="flex items-center gap-1">
                <NotificationBell collapsed={false} />
                <button onClick={() => setSettingsOpen(true)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg"
                  style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Settings size={11} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs select-none overflow-hidden"
                style={avatarUrl ? {} : { background: avatarColor + "20", border: `1.5px solid ${avatarColor}50`, color: avatarColor }}
                title={username}>
                {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : initials}
              </div>
              <NotificationBell collapsed={true} />
              <button onClick={() => setSettingsOpen(true)}
                className="w-6 h-6 flex items-center justify-center rounded-lg"
                style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <Settings size={11} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
```

- [ ] **Step 5: Verify shell**

Run `npm run dev`. Expected: sidebar visible on desktop with new accent colours, bottom nav visible when browser is resized below 768px, all existing pages still load.

---

## Task 4: FilterBar Component

**Files:**
- Create: `src/components/FilterBar.tsx`

- [ ] **Step 1: Create FilterBar.tsx**

Create `src/components/FilterBar.tsx`:
```tsx
import { useState, useRef, useEffect } from "react";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageTheme } from "@/lib/theme";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PillGroupOption = { label: string; value: string };

export type FilterDef =
  | { type: "pills";    key: string; options: PillGroupOption[] }
  | { type: "dropdown"; key: string; label: string; options: PillGroupOption[] }
  | { type: "search";   key: string; placeholder?: string }
  | { type: "sort";     key: string; options: PillGroupOption[] };

export type FilterState = Record<string, string>;

interface FilterBarProps {
  filters: FilterDef[];
  values: FilterState;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  theme: PageTheme;
  summary?: string;   // e.g. "Showing 14 of 42 trades · Win rate: 71%"
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FilterBar({ filters, values, onChange, onClear, theme, summary }: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = Object.values(values).filter(v => v && v !== "all" && v !== "").length;
  const hasActive   = activeCount > 0;

  return (
    <>
      {/* ── Desktop filter bar ─────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <div className="flex items-center gap-2 flex-wrap">
          {filters.map(f => {
            if (f.type === "search") return (
              <SearchFilter key={f.key} def={f} value={values[f.key] || ""} onChange={v => onChange(f.key, v)} theme={theme} />
            );
            if (f.type === "pills") return (
              <PillGroup key={f.key} def={f} value={values[f.key] || "all"} onChange={v => onChange(f.key, v)} theme={theme} />
            );
            if (f.type === "dropdown") return (
              <DropdownFilter key={f.key} def={f} value={values[f.key] || "all"} onChange={v => onChange(f.key, v)} theme={theme} />
            );
            if (f.type === "sort") return (
              <SortFilter key={f.key} def={f} value={values[f.key] || f.options[0]?.value || ""} onChange={v => onChange(f.key, v)} theme={theme} />
            );
            return null;
          })}
          {hasActive && (
            <button onClick={onClear} className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              Clear
            </button>
          )}
        </div>
        {summary && hasActive && (
          <div className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium"
            style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}>
            {summary}
          </div>
        )}
      </div>

      {/* ── Mobile filter trigger ──────────────────────────────────────────── */}
      <div className="flex md:hidden items-center gap-2">
        <button onClick={() => setMobileOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold"
          style={hasActive
            ? { background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }
            : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
          }>
          <SlidersHorizontal size={13} />
          Filter
          {hasActive && (
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
              style={{ background: theme.accent, color: "#070810" }}>
              {activeCount}
            </span>
          )}
        </button>
        {summary && hasActive && (
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{summary}</span>
        )}
      </div>

      {/* ── Mobile bottom sheet ────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setMobileOpen(false)}>
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-5 space-y-4"
            style={{ background: "#0a0c18", border: "1px solid rgba(255,255,255,0.08)" }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm" style={{ color: "#f8fafc" }}>Filters</span>
              <button onClick={() => setMobileOpen(false)}>
                <X size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
              </button>
            </div>
            {filters.map(f => {
              if (f.type === "search") return (
                <SearchFilter key={f.key} def={f} value={values[f.key] || ""} onChange={v => onChange(f.key, v)} theme={theme} />
              );
              if (f.type === "pills") return (
                <div key={f.key} className="space-y-1.5">
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {f.key.charAt(0).toUpperCase() + f.key.slice(1)}
                  </div>
                  <PillGroup def={f} value={values[f.key] || "all"} onChange={v => onChange(f.key, v)} theme={theme} />
                </div>
              );
              if (f.type === "dropdown") return (
                <div key={f.key} className="space-y-1.5">
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>{f.label}</div>
                  <PillGroup
                    def={{ type: "pills", key: f.key, options: [{ label: "All", value: "all" }, ...f.options] }}
                    value={values[f.key] || "all"}
                    onChange={v => onChange(f.key, v)}
                    theme={theme}
                  />
                </div>
              );
              if (f.type === "sort") return (
                <div key={f.key} className="space-y-1.5">
                  <div className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>Sort by</div>
                  <PillGroup
                    def={{ type: "pills", key: f.key, options: f.options }}
                    value={values[f.key] || f.options[0]?.value || ""}
                    onChange={v => onChange(f.key, v)}
                    theme={theme}
                  />
                </div>
              );
              return null;
            })}
            {hasActive && (
              <button onClick={() => { onClear(); setMobileOpen(false); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PillGroup({ def, value, onChange, theme }: { def: { options: PillGroupOption[] }; value: string; onChange: (v: string) => void; theme: PageTheme }) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      {def.options.map(opt => {
        const isActive = value === opt.value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
            style={isActive
              ? { background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }
              : { color: "rgba(255,255,255,0.4)", border: "1px solid transparent" }
            }>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SearchFilter({ def, value, onChange, theme }: { def: FilterDef & { type: "search" }; value: string; onChange: (v: string) => void; theme: PageTheme }) {
  return (
    <div className="relative flex items-center">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={def.placeholder || "Search..."}
        className="pl-8 pr-3 py-2 rounded-xl text-[12px] font-medium outline-none w-40 md:w-48"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: value ? `1px solid ${theme.border}` : "1px solid rgba(255,255,255,0.08)",
          color: "#f8fafc",
        }}
      />
      <SlidersHorizontal size={12} className="absolute left-2.5" style={{ color: "rgba(255,255,255,0.3)" }} />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2.5">
          <X size={11} style={{ color: "rgba(255,255,255,0.4)" }} />
        </button>
      )}
    </div>
  );
}

function DropdownFilter({ def, value, onChange, theme }: { def: FilterDef & { type: "dropdown" }; value: string; onChange: (v: string) => void; theme: PageTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = def.options.find(o => o.value === value);
  const isActive = value && value !== "all";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
        style={isActive
          ? { background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }
          : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }
        }>
        {def.label}{isActive && selected ? `: ${selected.label}` : ""}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 rounded-xl overflow-hidden min-w-[140px]"
          style={{ background: "#0e1018", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {[{ label: "All", value: "all" }, ...def.options].map(opt => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-[12px] font-medium transition-all"
              style={value === opt.value
                ? { background: theme.dim, color: theme.accent }
                : { color: "rgba(255,255,255,0.6)" }
              }>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SortFilter({ def, value, onChange, theme }: { def: FilterDef & { type: "sort" }; value: string; onChange: (v: string) => void; theme: PageTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = def.options.find(o => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative ml-auto">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
        ↓ {selected?.label || "Sort"}
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-30 rounded-xl overflow-hidden min-w-[140px]"
          style={{ background: "#0e1018", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {def.options.map(opt => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full px-3 py-2 text-left text-[12px] font-medium transition-all"
              style={value === opt.value
                ? { background: theme.dim, color: theme.accent }
                : { color: "rgba(255,255,255,0.6)" }
              }>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run `npm run dev`. No errors expected at this point (FilterBar not yet used).

---

## Task 5: Dashboard Page Redesign

**Files:**
- Modify: `src/pages/Dashboard.tsx` (replace page header + stat cards + layout)

The Dashboard is the most complex page. The strategy is: keep all existing data logic and charts intact, replace only the visual wrapper/layout (page title, stat cards, filter bar header).

- [ ] **Step 1: Add filter state and FilterBar to Dashboard**

At the top of the Dashboard component function, add filter state and imports:
```tsx
import FilterBar, { type FilterState } from "@/components/FilterBar";
import { PAGE_THEMES } from "@/lib/theme";

// Inside component:
const theme = PAGE_THEMES.dashboard;
const [filters, setFilters] = useState<FilterState>({ period: "1m" });
function handleFilter(key: string, value: string) { setFilters(prev => ({ ...prev, [key]: value })); }
function clearFilters() { setFilters({ period: "1m" }); }
```

- [ ] **Step 2: Replace page header section**

Find the opening JSX return and replace the page header with:
```tsx
{/* Page header */}
<div className="mb-6">
  <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>
    Dashboard
  </div>
  <div className="flex items-start justify-between gap-4 mb-4">
    <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "#f8fafc", letterSpacing: "-0.02em" }}>
      Portfolio Overview
    </h1>
  </div>
  <FilterBar
    filters={[
      { type: "pills", key: "period", options: [
        { label: "1W", value: "1w" },
        { label: "1M", value: "1m" },
        { label: "3M", value: "3m" },
        { label: "All", value: "all" },
      ]},
    ]}
    values={filters}
    onChange={handleFilter}
    onClear={clearFilters}
    theme={theme}
  />
</div>
```

- [ ] **Step 3: Update stat cards to use theme accent colours**

For each stat card in the Dashboard, replace the card `style` to use `PAGE_THEMES` patterns. Example for the net worth card:
```tsx
<div className="rounded-2xl p-4" style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
  <div className="text-[11px] font-medium mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>Net Worth</div>
  <div className="text-[26px] font-extrabold tabular-nums tracking-tight" style={{ color: "#f8fafc", letterSpacing: "-0.03em" }}>
    {fmtGBP(netWorth)}
  </div>
</div>
```
Apply similar treatment to each of the other stat cards using the appropriate semantic colour (`profit` for positive, `loss` for negative, `warn` for challenges).

- [ ] **Step 4: Verify**

Run `npm run dev` and open http://localhost:1420. Expected: Dashboard shows new header, period filter pills, and accent-coloured stat cards.

---

## Task 6: Ideas Page

**Files:**
- Create: `src/pages/Ideas.tsx`
- Create: `src/components/NoteEditor.tsx`
- Create: `src/components/BlockRenderer.tsx`
- Modify: `src/App.tsx`

This is the most complex new page. Build in three parts: routing first, then the shell layout, then the editor.

- [ ] **Step 1: Add /ideas route to App.tsx**

In `src/App.tsx`, add the import and route:
```tsx
import Ideas from "@/pages/Ideas";
// Inside <Routes>:
<Route path="ideas" element={<Ideas />} />
```

- [ ] **Step 2: Create Ideas.tsx shell**

Create `src/pages/Ideas.tsx` with the 3-column layout and topic/note management. The editor itself is a separate component:

```tsx
import { useState, useMemo } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { useAppData } from "@/lib/store";
import { PAGE_THEMES } from "@/lib/theme";
import { cn, generateId } from "@/lib/utils";
import NoteEditor from "@/components/NoteEditor";
import type { IdeaTopic, IdeaNote, NoteBlock } from "@/types";

const theme = PAGE_THEMES.ideas;

const DEFAULT_TOPICS: IdeaTopic[] = [
  { id: "t1", name: "AI Research",       emoji: "🤖" },
  { id: "t2", name: "Trading Strategies", emoji: "📈" },
  { id: "t3", name: "Market Analysis",    emoji: "📊" },
  { id: "t4", name: "Book Notes",         emoji: "📚" },
];

export default function Ideas() {
  const { data, update } = useAppData();
  const topics: IdeaTopic[] = data.ideaTopics ?? DEFAULT_TOPICS;
  const notes:  IdeaNote[]  = data.ideaNotes  ?? [];

  const [activeTopicId, setActiveTopicId] = useState<string>(topics[0]?.id ?? "");
  const [activeNoteId,  setActiveNoteId]  = useState<string | null>(null);
  const [search, setSearch]               = useState("");
  const [tagFilter, setTagFilter]         = useState("all");
  const [newTopicName, setNewTopicName]   = useState("");
  const [addingTopic, setAddingTopic]     = useState(false);

  // Mobile view stack: "topics" | "notes" | "editor"
  const [mobileView, setMobileView]       = useState<"topics" | "notes" | "editor">("topics");

  const topicNotes = useMemo(() =>
    notes.filter(n => n.topicId === activeTopicId)
         .filter(n => tagFilter === "all" || n.tags.includes(tagFilter))
         .filter(n => !search || n.title.toLowerCase().includes(search.toLowerCase()))
         .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [notes, activeTopicId, tagFilter, search]
  );

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;
  const allTags    = useMemo(() => [...new Set(notes.filter(n => n.topicId === activeTopicId).flatMap(n => n.tags))], [notes, activeTopicId]);

  function createNote() {
    const note: IdeaNote = {
      id: generateId(), topicId: activeTopicId, title: "Untitled note",
      blocks: [{ id: generateId(), type: "text", content: "" }],
      tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    update(d => ({ ...d, ideaNotes: [note, ...(d.ideaNotes ?? [])] }));
    setActiveNoteId(note.id);
    setMobileView("editor");
  }

  function updateNote(id: string, patch: Partial<IdeaNote>) {
    update(d => ({
      ...d,
      ideaNotes: (d.ideaNotes ?? []).map(n => n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n),
    }));
  }

  function deleteNote(id: string) {
    update(d => ({ ...d, ideaNotes: (d.ideaNotes ?? []).filter(n => n.id !== id) }));
    if (activeNoteId === id) { setActiveNoteId(null); setMobileView("notes"); }
  }

  function createTopic() {
    if (!newTopicName.trim()) return;
    const t: IdeaTopic = { id: generateId(), name: newTopicName.trim(), emoji: "📝" };
    update(d => ({ ...d, ideaTopics: [...(d.ideaTopics ?? DEFAULT_TOPICS), t] }));
    setActiveTopicId(t.id);
    setNewTopicName(""); setAddingTopic(false);
  }

  function deleteTopic(id: string) {
    update(d => ({
      ...d,
      ideaTopics: (d.ideaTopics ?? DEFAULT_TOPICS).filter(t => t.id !== id),
      ideaNotes: (d.ideaNotes ?? []).filter(n => n.topicId !== id),
    }));
    if (activeTopicId === id) setActiveTopicId(topics.find(t => t.id !== id)?.id ?? "");
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] flex flex-col">

      {/* Page title (desktop only) */}
      <div className="hidden md:block mb-4">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Ideas</div>
        <h1 className="text-[22px] font-extrabold tracking-tight" style={{ color: "#f8fafc", letterSpacing: "-0.02em" }}>Research & Brainstorm</h1>
      </div>

      {/* 3-column layout (desktop) / stacked screens (mobile) */}
      <div className="flex flex-1 rounded-2xl overflow-hidden min-h-0"
        style={{ border: "1px solid rgba(255,255,255,0.07)", background: "#070810" }}>

        {/* ── Topics sidebar ────────────────────────────────────────────────── */}
        <div className={cn("flex-col border-r", mobileView === "topics" ? "flex" : "hidden md:flex")}
          style={{ width: 200, minWidth: 200, borderColor: "rgba(255,255,255,0.07)", background: "#0a0c18" }}>
          {/* Header */}
          <div className="px-3 pt-4 pb-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[11px] font-black tracking-[0.12em] uppercase mb-1" style={{ color: "#f8fafc" }}>IDEAS</div>
            <div className="text-[10px]" style={{ color: theme.accent }}>Research & brainstorm</div>
          </div>
          {/* Search */}
          <div className="px-2.5 py-2 flex-shrink-0">
            <div className="relative flex items-center">
              <Search size={11} className="absolute left-2.5" style={{ color: "rgba(255,255,255,0.25)" }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search topics..."
                className="w-full pl-7 pr-2.5 py-1.5 rounded-lg text-[11px] outline-none"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "#f8fafc" }} />
            </div>
          </div>
          {/* Topic list */}
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {topics.map(topic => {
              const count = notes.filter(n => n.topicId === topic.id).length;
              const isActive = topic.id === activeTopicId;
              return (
                <div key={topic.id} className={cn("flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer group transition-all")}
                  style={isActive ? { background: theme.dim, border: `1px solid ${theme.border}` } : { border: "1px solid transparent" }}
                  onClick={() => { setActiveTopicId(topic.id); setActiveNoteId(null); setMobileView("notes"); }}>
                  <span className="text-sm flex-shrink-0">{topic.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate" style={{ color: isActive ? "#f8fafc" : "rgba(255,255,255,0.55)" }}>{topic.name}</div>
                    <div className="text-[10px]" style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.25)" }}>{count} notes</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteTopic(topic.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={11} style={{ color: "rgba(255,255,255,0.35)" }} />
                  </button>
                </div>
              );
            })}
            {/* Add topic */}
            {addingTopic ? (
              <div className="px-2.5 py-2">
                <input autoFocus value={newTopicName} onChange={e => setNewTopicName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createTopic(); if (e.key === "Escape") setAddingTopic(false); }}
                  placeholder="Topic name..."
                  className="w-full px-2 py-1 rounded-lg text-[11px] outline-none"
                  style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: "#f8fafc" }} />
              </div>
            ) : (
              <button onClick={() => setAddingTopic(true)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-medium transition-all"
                style={{ background: theme.dim + "60", border: `1px dashed ${theme.border}`, color: theme.accent }}>
                <Plus size={12} /> New topic
              </button>
            )}
          </div>
        </div>

        {/* ── Note list ─────────────────────────────────────────────────────── */}
        <div className={cn("flex-col border-r", mobileView === "notes" ? "flex" : "hidden md:flex")}
          style={{ width: 220, minWidth: 220, borderColor: "rgba(255,255,255,0.06)" }}>
          {/* Header */}
          <div className="px-3 pt-3 pb-2 flex items-center justify-between flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <div className="text-[13px] font-bold" style={{ color: "#f8fafc" }}>
                {topics.find(t => t.id === activeTopicId)?.name ?? "Notes"}
              </div>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{topicNotes.length} notes</div>
            </div>
            <button onClick={createNote}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}>
              <Plus size={11} /> Note
            </button>
          </div>
          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="px-2.5 py-1.5 flex gap-1.5 flex-wrap flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["all", ...allTags].map(tag => (
                <button key={tag} onClick={() => setTagFilter(tag)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all"
                  style={tagFilter === tag
                    ? { background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }
                    : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                  {tag === "all" ? "All" : `#${tag}`}
                </button>
              ))}
            </div>
          )}
          {/* Note list */}
          <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1">
            {topicNotes.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-8 gap-2">
                <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>No notes yet</div>
                <button onClick={createNote} className="text-[11px] font-semibold" style={{ color: theme.accent }}>Create one →</button>
              </div>
            )}
            {topicNotes.map(note => {
              const isActive = note.id === activeNoteId;
              const preview  = note.blocks.find(b => b.type === "text" || b.type === "h1" || b.type === "h2")?.content ?? "";
              const ago      = new Date(note.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
              return (
                <div key={note.id}
                  className="px-2.5 py-2.5 rounded-xl cursor-pointer group transition-all"
                  style={isActive ? { background: theme.dim, border: `1px solid ${theme.border}` } : { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}
                  onClick={() => { setActiveNoteId(note.id); setMobileView("editor"); }}>
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <div className="text-[12px] font-bold truncate flex-1" style={{ color: isActive ? "#f8fafc" : "rgba(255,255,255,0.7)" }}>
                      {note.title || "Untitled"}
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Trash2 size={10} style={{ color: "rgba(255,255,255,0.35)" }} />
                    </button>
                  </div>
                  {preview && (
                    <div className="text-[10px] truncate mb-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>{preview}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1 flex-wrap">
                      {note.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded-full text-[9px] font-medium"
                          style={{ background: theme.dim, color: theme.accent }}>#{tag}</span>
                      ))}
                    </div>
                    <span className="text-[9px] ml-auto" style={{ color: "rgba(255,255,255,0.2)" }}>{ago}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Editor pane ───────────────────────────────────────────────────── */}
        <div className={cn("flex-1 min-w-0 flex flex-col", mobileView === "editor" ? "flex" : "hidden md:flex")}>
          {activeNote ? (
            <NoteEditor
              note={activeNote}
              theme={theme}
              onUpdate={(patch) => updateNote(activeNote.id, patch)}
              onBack={() => setMobileView("notes")}
            />
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <div className="text-[13px]" style={{ color: "rgba(255,255,255,0.25)" }}>Select a note or create one</div>
              <button onClick={createNote}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold"
                style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}>
                <Plus size={14} /> New note
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create BlockRenderer.tsx**

Create `src/components/BlockRenderer.tsx` — renders a single block, used by NoteEditor:
```tsx
import type { NoteBlock } from "@/types";
import type { PageTheme } from "@/lib/theme";

interface Props {
  block: NoteBlock;
  theme: PageTheme;
  onChange: (content: string, extra?: Partial<NoteBlock>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  onFocus: () => void;
  autoFocus?: boolean;
}

export default function BlockRenderer({ block, theme, onChange, onKeyDown, onFocus, autoFocus }: Props) {
  const baseInputStyle: React.CSSProperties = {
    width: "100%", background: "transparent", outline: "none",
    color: "#f8fafc", resize: "none", fontFamily: "inherit",
  };

  function TextArea({ style, rows = 1, placeholder = "Type something..." }: { style?: React.CSSProperties; rows?: number; placeholder?: string }) {
    return (
      <textarea
        autoFocus={autoFocus}
        value={block.content}
        rows={rows}
        placeholder={placeholder}
        style={{ ...baseInputStyle, ...style }}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown as React.KeyboardEventHandler<HTMLTextAreaElement>}
        onFocus={onFocus}
        onInput={e => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = el.scrollHeight + "px";
        }}
      />
    );
  }

  switch (block.type) {
    case "h1": return <TextArea style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }} placeholder="Heading 1" />;
    case "h2": return <TextArea style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em" }} placeholder="Heading 2" />;
    case "h3": return <TextArea style={{ fontSize: 15, fontWeight: 600 }} placeholder="Heading 3" />;

    case "bullet": return (
      <div className="flex gap-2 items-start">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: theme.accent }} />
        <TextArea style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }} placeholder="List item" />
      </div>
    );

    case "numbered": return (
      <div className="flex gap-2 items-start">
        <span className="mt-0.5 text-[12px] font-semibold flex-shrink-0 w-4" style={{ color: theme.accent }}>•</span>
        <TextArea style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }} placeholder="List item" />
      </div>
    );

    case "todo": return (
      <div className="flex gap-2.5 items-start">
        <button
          className="mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
          style={block.checked
            ? { background: theme.accent, border: `1.5px solid ${theme.accent}` }
            : { border: `1.5px solid rgba(255,255,255,0.2)` }
          }
          onClick={() => onChange(block.content, { checked: !block.checked })}
        >
          {block.checked && <span className="text-[8px] font-black" style={{ color: "#070810" }}>✓</span>}
        </button>
        <TextArea
          style={{ fontSize: 13, lineHeight: 1.6, color: block.checked ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.8)", textDecoration: block.checked ? "line-through" : "none" }}
          placeholder="To-do item"
        />
      </div>
    );

    case "quote": return (
      <div className="flex gap-3 items-start pl-1" style={{ borderLeft: `3px solid ${theme.accent}` }}>
        <TextArea style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.65)", fontStyle: "italic" }} placeholder="Quote..." />
      </div>
    );

    case "callout": return (
      <div className="flex gap-2.5 items-start p-3 rounded-xl" style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
        <span className="text-base flex-shrink-0">{block.emoji || "💡"}</span>
        <TextArea style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }} placeholder="Callout text..." />
      </div>
    );

    case "code": return (
      <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="px-3 py-1.5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.3)" }}>{block.language || "code"}</span>
        </div>
        <TextArea style={{ fontSize: 12, lineHeight: 1.6, color: "#4ade80", fontFamily: "'JetBrains Mono', monospace", padding: "8px 12px" }} placeholder="// code here..." />
      </div>
    );

    case "divider": return (
      <div className="py-1.5">
        <div className="w-full h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
      </div>
    );

    case "image": return (
      <div className="flex items-center justify-center p-6 rounded-xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}>
        <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.3)" }}>Image block — click to add</span>
      </div>
    );

    case "link-bookmark": return (
      <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {block.meta?.title ? (
          <div>
            <div className="text-[12px] font-semibold" style={{ color: "#f8fafc" }}>{block.meta.title}</div>
            {block.meta.description && <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{block.meta.description}</div>}
            <div className="text-[10px] mt-1" style={{ color: theme.accent }}>{block.content}</div>
          </div>
        ) : (
          <TextArea style={{ fontSize: 12, color: theme.accent }} placeholder="Paste a URL..." />
        )}
      </div>
    );

    default: return (
      <TextArea style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.8)" }} placeholder="Type '/' for commands..." />
    );
  }
}
```

- [ ] **Step 4: Create NoteEditor.tsx**

Create `src/components/NoteEditor.tsx`:
```tsx
import { useState, useRef, useCallback } from "react";
import { ArrowLeft, Plus, Hash, X } from "lucide-react";
import { generateId } from "@/lib/utils";
import BlockRenderer from "@/components/BlockRenderer";
import type { IdeaNote, NoteBlock, NoteBlockType } from "@/types";
import type { PageTheme } from "@/lib/theme";

// Slash command menu items
const BLOCK_TYPES: { type: NoteBlockType; label: string; icon: string; shortcut?: string }[] = [
  { type: "text",         label: "Text",          icon: "¶",   shortcut: "text" },
  { type: "h1",           label: "Heading 1",     icon: "H1",  shortcut: "h1"   },
  { type: "h2",           label: "Heading 2",     icon: "H2",  shortcut: "h2"   },
  { type: "h3",           label: "Heading 3",     icon: "H3",  shortcut: "h3"   },
  { type: "bullet",       label: "Bullet list",   icon: "•"                      },
  { type: "numbered",     label: "Numbered list", icon: "1."                     },
  { type: "todo",         label: "To-do",         icon: "☑"                      },
  { type: "quote",        label: "Quote",         icon: """                      },
  { type: "callout",      label: "Callout",       icon: "💡"                     },
  { type: "code",         label: "Code block",    icon: "<>"                     },
  { type: "divider",      label: "Divider",       icon: "—"                      },
  { type: "link-bookmark",label: "Link / URL",    icon: "🔗"                     },
  { type: "image",        label: "Image",         icon: "🖼"                     },
];

interface Props {
  note: IdeaNote;
  theme: PageTheme;
  onUpdate: (patch: Partial<IdeaNote>) => void;
  onBack: () => void;
}

export default function NoteEditor({ note, theme, onUpdate, onBack }: Props) {
  const [slashMenu, setSlashMenu]     = useState<{ blockId: string; query: string } | null>(null);
  const [tagInput, setTagInput]       = useState("");
  const [addingTag, setAddingTag]     = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(note.blocks[0]?.id ?? null);
  const titleRef = useRef<HTMLInputElement>(null);

  function updateBlocks(blocks: NoteBlock[]) { onUpdate({ blocks }); }

  function updateBlock(id: string, content: string, extra?: Partial<NoteBlock>) {
    // Detect slash command
    if (content === "/") {
      setSlashMenu({ blockId: id, query: "" });
    } else if (slashMenu?.blockId === id) {
      if (content.endsWith(" ") || content === "") {
        setSlashMenu(null);
      } else {
        setSlashMenu({ blockId: id, query: content.slice(1) });
      }
    } else {
      setSlashMenu(null);
    }
    updateBlocks(note.blocks.map(b => b.id === id ? { ...b, content, ...extra } : b));
  }

  function insertBlock(afterId: string, type: NoteBlockType = "text") {
    const newBlock: NoteBlock = { id: generateId(), type, content: "" };
    const idx = note.blocks.findIndex(b => b.id === afterId);
    const updated = [...note.blocks];
    updated.splice(idx + 1, 0, newBlock);
    updateBlocks(updated);
    setFocusedBlockId(newBlock.id);
    setSlashMenu(null);
  }

  function replaceBlockType(id: string, type: NoteBlockType) {
    updateBlocks(note.blocks.map(b => b.id === id ? { ...b, type, content: "" } : b));
    setSlashMenu(null);
    setFocusedBlockId(id);
  }

  function deleteBlock(id: string) {
    if (note.blocks.length <= 1) return;
    const idx = note.blocks.findIndex(b => b.id === id);
    const updated = note.blocks.filter(b => b.id !== id);
    updateBlocks(updated);
    setFocusedBlockId(updated[Math.max(0, idx - 1)]?.id ?? null);
  }

  function handleKeyDown(blockId: string, e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      insertBlock(blockId);
    }
    if (e.key === "Backspace") {
      const block = note.blocks.find(b => b.id === blockId);
      if (block?.content === "") {
        e.preventDefault();
        deleteBlock(blockId);
      }
    }
    if (e.key === "Escape") { setSlashMenu(null); }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!t || note.tags.includes(t)) { setTagInput(""); setAddingTag(false); return; }
    onUpdate({ tags: [...note.tags, t] });
    setTagInput(""); setAddingTag(false);
  }

  const filteredSlashItems = slashMenu
    ? BLOCK_TYPES.filter(bt => bt.label.toLowerCase().includes(slashMenu.query.toLowerCase()))
    : [];

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Back button (mobile only) */}
        <button onClick={onBack} className="md:hidden flex-shrink-0">
          <ArrowLeft size={16} style={{ color: "rgba(255,255,255,0.5)" }} />
        </button>
        {/* Title */}
        <input
          ref={titleRef}
          value={note.title}
          onChange={e => onUpdate({ title: e.target.value })}
          placeholder="Note title..."
          className="flex-1 text-[18px] font-extrabold tracking-tight outline-none bg-transparent"
          style={{ color: "#f8fafc", letterSpacing: "-0.02em" }}
        />
      </div>

      {/* ── Tags row ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-4 py-2 flex-wrap flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        {note.tags.map(tag => (
          <div key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
            style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}>
            #{tag}
            <button onClick={() => onUpdate({ tags: note.tags.filter(t => t !== tag) })}>
              <X size={9} />
            </button>
          </div>
        ))}
        {addingTag ? (
          <input autoFocus value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addTag(); if (e.key === "Escape") { setTagInput(""); setAddingTag(false); } }}
            onBlur={addTag}
            placeholder="tag name"
            className="px-2 py-0.5 rounded-full text-[10px] outline-none w-20"
            style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }} />
        ) : (
          <button onClick={() => setAddingTag(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.35)" }}>
            <Hash size={9} /> tag
          </button>
        )}
      </div>

      {/* ── Block editor ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 relative">
        {note.blocks.map((block) => (
          <div key={block.id} className="group relative">
            <BlockRenderer
              block={block}
              theme={theme}
              onChange={(content, extra) => updateBlock(block.id, content, extra)}
              onKeyDown={(e) => handleKeyDown(block.id, e)}
              onFocus={() => setFocusedBlockId(block.id)}
              autoFocus={focusedBlockId === block.id}
            />
            {/* Add block button on hover */}
            <button
              onClick={() => insertBlock(block.id)}
              className="absolute -left-5 top-1 opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 flex items-center justify-center rounded"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              <Plus size={12} />
            </button>
          </div>
        ))}

        {/* Slash command menu */}
        {slashMenu && filteredSlashItems.length > 0 && (
          <div className="absolute z-50 rounded-xl overflow-hidden shadow-xl"
            style={{ background: "#0e1018", border: "1px solid rgba(255,255,255,0.1)", minWidth: 200, maxHeight: 240, overflowY: "auto" }}>
            {filteredSlashItems.map(bt => (
              <button key={bt.type}
                onClick={() => replaceBlockType(slashMenu.blockId, bt.type)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-all"
                style={{ color: "rgba(255,255,255,0.7)" }}
                onMouseEnter={e => (e.currentTarget.style.background = theme.dim)}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <span className="w-6 text-center text-[12px] font-mono" style={{ color: theme.accent }}>{bt.icon}</span>
                <span className="text-[12px] font-medium">{bt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile toolbar ──────────────────────────────────────────────────── */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderTop: `1px solid ${theme.border}`, background: "#0a0c18" }}>
        <div className="flex items-center gap-3">
          {[["B","bold"], ["I","italic"]].map(([label, _]) => (
            <button key={label} className="w-7 h-7 flex items-center justify-center rounded-lg text-[12px] font-bold"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => focusedBlockId && insertBlock(focusedBlockId)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold"
          style={{ background: theme.dim, border: `1px solid ${theme.border}`, color: theme.accent }}>
          / blocks
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify Ideas page**

Run `npm run dev`. Navigate to `/ideas`. Expected: 3-column layout on desktop, topic list visible, clicking a topic shows notes, clicking New Note opens editor, typing `/` shows slash command menu.

---

## Tasks 7–12: Remaining Page Redesigns

Each remaining page follows the same pattern. The key changes per page:
1. Add page header with accent colour label + `h1` title
2. Import `FilterBar` + `PAGE_THEMES`
3. Add `useState<FilterState>` for filters
4. Add `<FilterBar>` before the page content
5. Update card `style` props to use `theme.dim` / `theme.border` / `theme.accent`
6. Update text colours to use the improved contrast scale

### Task 7: Journal Page

**Theme:** `PAGE_THEMES.journal` (Amber)
**Filters:**
```tsx
{ type: "pills",    key: "direction", options: [{ label: "All", value: "all" }, { label: "Long", value: "long" }, { label: "Short", value: "short" }] },
{ type: "dropdown", key: "instrument", label: "Instrument", options: INSTRUMENTS.map(i => ({ label: i, value: i.toLowerCase() })) },
{ type: "pills",    key: "outcome",   options: [{ label: "All", value: "all" }, { label: "Win", value: "win" }, { label: "Loss", value: "loss" }] },
{ type: "sort",     key: "sort",      options: [{ label: "Date", value: "date" }, { label: "P&L", value: "pnl" }, { label: "Fees", value: "fees" }] },
```
**Summary string:** `"Showing X trades · Win rate: Y% · Total P&L: £Z"`

Apply filter values to the existing `useMemo` that computes `filteredTrades`.

### Task 8: Prop Accounts Page

**Theme:** `PAGE_THEMES.prop` (Green)
**Filters:**
```tsx
{ type: "dropdown", key: "firm",   label: "Firm",   options: uniqueFirms.map(f => ({ label: f, value: f.toLowerCase() })) },
{ type: "pills",    key: "status", options: [{ label: "All", value: "all" }, { label: "Funded", value: "funded" }, { label: "Challenge", value: "challenge" }, { label: "Breached", value: "breached" }] },
{ type: "sort",     key: "sort",   options: [{ label: "Balance", value: "balance" }, { label: "P&L", value: "pnl" }] },
```

### Task 9: Market Page

**Theme:** `PAGE_THEMES.market` (Sky)
**Filters:**
```tsx
{ type: "pills", key: "session", options: [{ label: "All", value: "all" }, { label: "London", value: "london" }, { label: "New York", value: "newyork" }, { label: "Asia", value: "asia" }] },
```

### Task 10: Expenses Page

**Theme:** `PAGE_THEMES.expenses` (Teal)
**Filters:**
```tsx
{ type: "pills",    key: "period",   options: [{ label: "All", value: "all" }, { label: "This month", value: "month" }, { label: "This year", value: "year" }] },
{ type: "dropdown", key: "category", label: "Category", options: EXPENSE_CATS.map(c => ({ label: c, value: c })) },
{ type: "dropdown", key: "firm",     label: "Firm",     options: FIRMS.map(f => ({ label: f, value: f.toLowerCase().replace(/\s/g, "-") })) },
{ type: "sort",     key: "sort",     options: [{ label: "Date", value: "date" }, { label: "Amount", value: "amount" }] },
```

### Task 11: Investments Page

**Theme:** `PAGE_THEMES.investments` (Purple)
**Filters:**
```tsx
{ type: "pills",    key: "type",        options: [{ label: "All", value: "all" }, { label: "ETF", value: "etf" }, { label: "Stock", value: "stock" }] },
{ type: "pills",    key: "performance", options: [{ label: "All", value: "all" }, { label: "Gain", value: "gain" }, { label: "Loss", value: "loss" }] },
{ type: "sort",     key: "sort",        options: [{ label: "Value", value: "value" }, { label: "Return %", value: "return" }] },
```

### Task 12: Debt Page

**Theme:** `PAGE_THEMES.debt` (Red)
**Filters:**
```tsx
{ type: "pills",    key: "type",        options: [{ label: "All", value: "all" }, { label: "Credit card", value: "credit" }, { label: "Other", value: "other" }] },
{ type: "pills",    key: "utilisation", options: [{ label: "All", value: "all" }, { label: "High >75%", value: "high" }, { label: "Mid", value: "mid" }, { label: "Low <25%", value: "low" }] },
{ type: "sort",     key: "sort",        options: [{ label: "Balance", value: "balance" }, { label: "APR", value: "apr" }] },
```

### Task 13: Tax Page

**Theme:** `PAGE_THEMES.tax` (Orange)
No filters — static profile page. Add page header only:
```tsx
<div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Tax</div>
<h1 className="text-[22px] font-extrabold tracking-tight mb-6" style={{ color: "#f8fafc", letterSpacing: "-0.02em" }}>Tax Profile</h1>
```
Update card styles to use `theme.dim` / `theme.border`.

---

## Final Verification

- [ ] Run `npm run dev`
- [ ] Navigate to every page — no TypeScript errors in terminal
- [ ] Resize browser to < 768px — bottom nav appears, sidebar disappears
- [ ] Resize to 768–1199px — icon-only sidebar
- [ ] Resize to > 1200px — full sidebar
- [ ] Test FilterBar on Journal: filter by Long, instrument, Win — result count updates
- [ ] Test Ideas page: create topic, create note, type `/` to open slash menu, add tags
- [ ] Run `npm run build` — clean build with no errors
