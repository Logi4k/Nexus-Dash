# Nexus UI/UX Redesign — Design Spec

**Date:** 2026-03-21
**Approach:** Shell Swap + Pages Iteratively (Approach C)
**Status:** Approved

---

## Overview

Full UI/UX redesign of the Nexus trader dashboard to support web, mobile, and desktop platforms. The data layer (`store.ts`, `types/index.ts`, `lib/utils.ts`, `src-tauri/`) is completely untouched. Only the shell, design system, and page components change.

A new **Ideas & Research** page is added as the ninth page.

---

## 1. Design System

### 1.1 Font

Replace **Inter** with **DM Sans** (Google Fonts).

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Keep **JetBrains Mono** for numeric/code contexts (unchanged).

### 1.2 Type Scale

| Role | Size | Weight | Letter-spacing |
|------|------|--------|----------------|
| Hero numbers | 22–26px | 800 | −0.03em |
| Page title | 18–20px | 800 | −0.02em |
| Section heading | 14px | 700 | −0.01em |
| Body / content | 13px | 400 | 0 |
| Label / meta | 11px | 500–600 | 0.03em |

Rules:
- Labels use **sentence-case** — never ALL CAPS with heavy tracking
- Secondary text: `rgba(255,255,255,0.55)` — must pass WCAG AA
- Tertiary / meta text: `rgba(255,255,255,0.40)`
- Primary text: `#f8fafc`

### 1.3 Colour Tokens

#### Base tokens — `tailwind.config.js` (unchanged structure, values may be refined)

```js
bg: { base, card, elevated, input, hover, subtle }  // CSS variable driven
tx: { 1, 2, 3, 4 }                                   // CSS variable driven
profit: "#22c55e"
loss:   "#ef4444"
warn:   "#f59e0b"
```

#### Per-page accent tokens — `src/lib/theme.ts` (single source of truth)

```ts
export const PAGE_THEMES = {
  dashboard:   { accent: "#818cf8", dim: "rgba(129,140,248,0.08)", border: "rgba(129,140,248,0.18)", name: "Indigo"  },
  market:      { accent: "#38bdf8", dim: "rgba(14,165,233,0.08)",  border: "rgba(14,165,233,0.18)",  name: "Sky"     },
  journal:     { accent: "#fbbf24", dim: "rgba(251,191,36,0.07)",  border: "rgba(251,191,36,0.15)",  name: "Amber"   },
  prop:        { accent: "#4ade80", dim: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.16)",   name: "Green"   },
  expenses:    { accent: "#2dd4bf", dim: "rgba(20,184,166,0.08)",  border: "rgba(20,184,166,0.16)",  name: "Teal"    },
  debt:        { accent: "#f87171", dim: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.15)",   name: "Red"     },
  investments: { accent: "#c084fc", dim: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.16)",  name: "Purple"  },
  tax:         { accent: "#fb923c", dim: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.15)",  name: "Orange"  },
  ideas:       { accent: "#f472b6", dim: "rgba(236,72,153,0.08)",  border: "rgba(236,72,153,0.15)",  name: "Pink"    },
} as const;

export type PageThemeKey = keyof typeof PAGE_THEMES;
```

**To retheme any page or do a full colour rework: change `theme.ts` only. No other files need touching.**

---

## 2. Adaptive Shell

### 2.1 Breakpoints

| Breakpoint | Range | Navigation |
|------------|-------|------------|
| Mobile | `< 768px` | Bottom tab bar (5 primary tabs + "More") |
| Tablet | `768px – 1199px` | Collapsed icon-only sidebar (64px) with tooltips |
| Desktop | `≥ 1200px` | Full sidebar (240px, collapsible to 64px) |

### 2.2 Layout.tsx (replaced)

```tsx
// Responsive shell — sidebar on md+, bottom tabs on mobile
<div className="flex h-screen w-screen overflow-hidden bg-bg-base">
  <Sidebar />                          {/* hidden on mobile */}
  <main className="flex-1 overflow-y-auto pb-safe">
    <Outlet />
  </main>
  <MobileNav />                        {/* visible on mobile only */}
</div>
```

### 2.3 Sidebar.tsx (replaced)

- Desktop (≥1200px): 240px expanded, 64px collapsed, toggle button
- Tablet (768–1199px): always 64px, icons only, label tooltips on hover
- Mobile: hidden — navigation handled by `MobileNav`
- Contains: logo, net worth card (expanded only), nav links, user profile, settings, live clock
- Accent colour: inherits from active page via `PAGE_THEMES`

### 2.4 MobileNav.tsx (new component)

- Fixed bottom bar, `h-16`, `z-50`, safe area inset for iPhone home bar
- Shows 5 primary tabs: Dashboard, Market, Journal, Prop, More
- "More" opens a bottom sheet with remaining pages (Expenses, Debt, Tax, Investments, Ideas)
- Active tab indicator: small dot + accent colour tint
- Hides when keyboard is open (detected via `visualViewport` resize)

---

## 3. FilterBar Component

### 3.1 Architecture

Single `<FilterBar>` component at `src/components/FilterBar.tsx`. Each page passes a config array — no per-page filter component needed.

```ts
type FilterConfig = {
  type: "pills" | "dropdown" | "search" | "sort";
  key: string;
  label?: string;
  options?: { label: string; value: string }[];
};
```

### 3.2 Behaviour

- Active filters displayed as removable chips (accent-coloured border + × button)
- **Result summary bar** beneath filter row: `"Showing X of Y results"` + live aggregate stats
- Clear all button when any filter is active
- Accent colour auto-inherited from `PAGE_THEMES[currentPage]`

### 3.3 Mobile behaviour

- Collapses to a single `"⚙ Filter"` button with active-filter count badge
- Tapping opens a **bottom sheet** with full filter controls
- Sort control always visible in the top-right (most commonly used)

### 3.4 Per-page filter configs

| Page | Filters |
|------|---------|
| Dashboard | Period (1W / 1M / 3M / All), View (Overview / Detail) |
| Market | Session, Instrument |
| Journal | Date range, Direction (Long/Short), Instrument, Session, Outcome (Win/Loss), Setup tag, Sort (Date / P&L / Fees) |
| Prop Accounts | Firm, Status (Funded / Challenge / Breached), Sort (Balance / P&L) |
| Expenses | Month/Year, Category, Firm, Sort (Date / Amount) |
| Debt | Type (Credit card / Other), Utilisation (High / Mid / Low), Sort (Balance / APR) |
| Investments | Type (ETF / Stock), Performance (Gain / Loss), Sort (Value / Return %) |
| Tax | None (static profile page) |
| Ideas | Handled within the page (topic tabs + tag filters) |

---

## 4. Ideas & Research Page (`/ideas`)

### 4.1 Route

`/ideas` — added to `App.tsx` router. Added to sidebar nav and mobile bottom sheet.

### 4.2 Data model

```ts
// Addition to types/index.ts
export interface IdeaNote {
  id: string;
  topicId: string;
  title: string;
  blocks: NoteBlock[];   // ordered array of content blocks
  tags: string[];
  createdAt: string;     // ISO string
  updatedAt: string;     // ISO string
}

export interface IdeaTopic {
  id: string;
  name: string;
  emoji: string;
  noteCount?: number;    // derived
}

export type NoteBlockType =
  | "text" | "h1" | "h2" | "h3"
  | "bullet" | "numbered" | "todo"
  | "quote" | "callout" | "code"
  | "divider" | "image" | "link-bookmark"
  | "columns";

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  content: string;
  checked?: boolean;       // for todo blocks
  language?: string;       // for code blocks
  emoji?: string;          // for callout blocks
  url?: string;            // for link-bookmark blocks
  meta?: Record<string, unknown>;
}
```

Added to `AppData`:
```ts
ideaTopics?: IdeaTopic[];
ideaNotes?: IdeaNote[];
```

### 4.3 Layout — Desktop (3-column)

```
┌─────────────────────────────────────────────────────────┐
│  Topics sidebar (180px)  │  Note list (200px)  │  Editor │
│  ─────────────────────── │ ─────────────────── │ ─────── │
│  Search bar              │  Topic title + +btn │ Title   │
│  Topic list              │  Tag filter pills   │ Tags    │
│  + New topic             │  Note cards         │ Toolbar │
│                          │  (sorted by updatedAt)│ Blocks │
└─────────────────────────────────────────────────────────┘
```

### 4.4 Layout — Mobile (3 full-screen views)

1. **Topics screen** — full-width topic list, "+ Topic" button in header
2. **Notes screen** — back button, topic name, tag filter pills, note card list
3. **Editor screen** — back button, note title, scrollable blocks, formatting toolbar **pinned above keyboard**

Navigation: push/pop pattern (React Router or local state stack).

### 4.5 Block editor

- **Slash command** (`/`): typing `/` opens an inline menu of all block types
- **Formatting toolbar**: Bold, Italic, Strikethrough, Inline code, Link
- **Auto-save**: debounced 500ms after last keystroke — no save button
- **Paste detection**: pasting a URL triggers a prompt "Convert to bookmark card?"
- **Drag to reorder**: blocks are draggable on desktop (touch-drag on mobile)
- **Image blocks**: file picker + paste from clipboard, stored in existing `imageStore` (IndexedDB)

### 4.6 Block types

| Block | Slash trigger | Notes |
|-------|--------------|-------|
| Text | `/text` | Default |
| Heading 1–3 | `/h1` `/h2` `/h3` | |
| Bullet list | `/bullet` or `-` | |
| Numbered list | `/num` or `1.` | |
| To-do | `/todo` or `[]` | Checkbox toggle |
| Quote | `/quote` or `>` | Left border accent |
| Callout | `/callout` | Emoji + coloured bg |
| Code block | `/code` | Syntax highlight via highlight.js |
| Divider | `/divider` or `---` | |
| Image | `/image` | File picker or paste |
| Link bookmark | `/link` | URL → title/description card. Implementation: on Tauri desktop, fetch OG tags via a Tauri shell command to avoid CORS. On web, store URL only and show a plain link card (no OG fetch). The `meta` field on `NoteBlock` stores `{ title, description, favicon }` once resolved. |
| 2 columns | `/columns` | Desktop only. Data model: `content` stores a JSON array `[leftBlocks[], rightBlocks[]]` serialised as a string — each sub-array is a recursive `NoteBlock[]`. Implementer note: columns are only rendered on tablet/desktop; on mobile they render as a single stacked column. |

---

## 5. Page Redesigns

All 8 existing pages are redesigned with:
- Vibrant Dark accent colour from `PAGE_THEMES`
- DM Sans font
- Updated type scale and contrast
- `<FilterBar>` component (where applicable)
- Responsive layout (mobile-first)

### Build order (recommended)

1. Design system tokens + `theme.ts`
2. `Layout.tsx` + `Sidebar.tsx` + `MobileNav.tsx`
3. `FilterBar.tsx` component
4. `Ideas.tsx` page (new)
5. `Dashboard.tsx`
6. `Journal.tsx`
7. `PropAccounts.tsx`
8. `Market.tsx`
9. `Expenses.tsx`
10. `Investments.tsx`
11. `Debt.tsx`
12. `Tax.tsx`

---

## 6. What Changes vs What Stays

### Changed
- `src/components/Layout.tsx` — responsive shell
- `src/components/Sidebar.tsx` — adaptive navigation
- `src/components/MobileNav.tsx` — new mobile bottom bar
- `src/components/FilterBar.tsx` — new shared filter component
- `src/lib/theme.ts` — new colour token file
- `tailwind.config.js` — font update, minor token refinements
- `src/pages/*.tsx` — all 8 pages redesigned
- `src/pages/Ideas.tsx` — new page
- `src/App.tsx` — add `/ideas` route
- `index.html` — add DM Sans Google Fonts link
- `src/types/index.ts` — add `IdeaNote`, `IdeaTopic`, `NoteBlock` types
- `src-tauri/tauri.conf.json` — remove `minWidth`/`minHeight` constraints for web compatibility

### Untouched
- `src/lib/store.ts`
- `src/lib/utils.ts`
- `src/lib/imageStore.ts`
- `src-tauri/src/` (Rust backend)
- `src/data/data.json`
- All API integrations (Trading212, yfinance, Gemini)

---

## 7. Cross-Platform Notes

- **Desktop (Tauri)**: Remove `minWidth: 1200` / `minHeight: 720` from `tauri.conf.json` — the app now works at any size
- **Web**: `store.ts` already has `isTauri` detection and localStorage fallback — no changes needed
- **Mobile (future)**: Capacitor or Tauri Mobile can wrap the same React app. Bottom nav and responsive layouts are already in place.
