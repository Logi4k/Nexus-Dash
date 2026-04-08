# Nexus — Full App Audit (7 Apr 2026)

Project: D:\Codex New Dash build - Copy
Stack: React + TS + Vite + Tailwind + Tauri (desktop + Android)
Auditor: Hermes

---

## 1. Codebase Inspection

Total: 28,980 LOC across 62 src files.

Largest files (architecture risk = anything > 1000 LOC):

| File                          |   LOC | Risk     |
|-------------------------------|------:|----------|
| pages/Journal.tsx             | 3,083 | CRITICAL |
| pages/PropAccounts.tsx        | 3,079 | CRITICAL |
| pages/Dashboard.tsx           | 2,671 | CRITICAL |
| pages/Investments.tsx         | 1,903 | HIGH     |
| pages/Market.tsx              | 1,813 | HIGH     |
| pages/Expenses.tsx            | 1,264 | HIGH     |
| lib/propRules.ts              | 1,258 | HIGH     |
| pages/Debt.tsx                | 1,117 | HIGH     |
| pages/Tax.tsx                 | 1,107 | HIGH     |
| components/SettingsModal.tsx  |   998 | MEDIUM   |
| components/QuickActionHost    |   865 | MEDIUM   |
| components/MobileNav.tsx      |   832 | MEDIUM   |

Code smells:
- Hardcoded hex in tsx: 167 occurrences (should use CSS vars — design system already exists)
- console.* in tsx: 16 (mostly legitimate console.error in catch blocks — fine)
- z-index occurrences: 51 across tsx + css
- createPortal sites: 7 components
- TODO/FIXME: 0 (clean)
- `any` types: 0 (clean — strict TS)

Positive: strong design token system in `src/index.css` (`--bg-base`, `--tx-1..4`, semantic colours with -rgb / -bg / -border variants, full light theme at line 109+).

---

## 2. Systematic Debugging — Findings

### CRITICAL: Z-Index Architecture Chaos

51 z-index declarations with no coherent scale. Mix of Tailwind `z-[N]`, inline `zIndex:N`, and CSS class z-indices.

| Component                     | Z-Index            | Mechanism      | Notes |
|-------------------------------|-------------------:|----------------|-------|
| MobileNav (FAB ring)          |                  1 | inline         | |
| FilterBar dropdowns           |                 20 | Tailwind       | |
| Dashboard pin badge           |                 50 | Tailwind       | |
| MobileNav bar                 |                 50 | inline         | |
| MobileNav FAB                 |                 51 | inline         | |
| MobileNav backdrop            |                 48 | Tailwind `z-[48]` | |
| MobileNav sheet               |             55, 56 | Tailwind       | |
| MobileNav drawers             |           199, 200 | inline         | |
| NoteEditor menu               |                 50 | Tailwind       | |
| CommandPalette                |             10,000 | Tailwind `z-[10000]` | |
| Journal lightbox              |             10,001 | Tailwind `z-[10001]` | |
| CustomSelect / Date / Time backdrop | 11,000       | inline         | desktop |
| CustomSelect / Date / Time menu     | 11,001       | inline         | desktop |
| CustomSelect / Date / Time mobile   | 2,147,483,647/8 | Tailwind   | **MAX-INT hack** |
| ThemeTransition overlay       |             99,998 | inline         | |
| index.css `.modal-backdrop`   |              9,999 | CSS class      | |

**Root cause:** No standardised scale. Each picker invented its own number. The mobile pickers escalated to `z-[2147483647]` (max int) because they kept losing stacking battles. This is the smoking gun for the "modal/picker keeps disappearing" bug class.

**Proposed scale (replace all of the above):**

```
--z-base:        1
--z-dropdown:    20      (FilterBar dropdowns, NoteEditor menu)
--z-sticky:      30      (sticky headers)
--z-mobile-nav:  50      (bottom bar, FAB)
--z-drawer:      100     (mobile drawers)
--z-cmd-palette: 200     (command palette)
--z-modal-bg:    1000    (modal backdrop, .modal-backdrop CSS class)
--z-modal:       1010
--z-picker-bg:   2000    (CustomSelect/Date/Time backdrops — desktop AND mobile)
--z-picker:      2010    (the actual picker surface)
--z-lightbox:    3000    (Journal image lightbox)
--z-toast:       5000
--z-theme-flash: 9000    (ThemeTransition overlay)
```

Then delete every `z-[2147483647]` and the inline `zIndex: 11000/11001`. The picker components need ONE z-index path (currently they branch desktop vs mobile with different values — bug magnet).

### CRITICAL: Duplicate StatCard Component

Two completely different `StatCard` implementations:

| File                       | Props                                                                  | Behaviour |
|----------------------------|------------------------------------------------------------------------|-----------|
| `components/StatCard.tsx`  | label, value, prefix, suffix, decimals, icon, change, accentColor, …  | Full-featured shared card with accent mapping + animations |
| `pages/Investments.tsx:132`| label, value, sub, valueClass                                          | Local mini reimplementation |

**Why this matters:** When you "fix the StatCard" the change applies to one only. Investments.tsx silently drifts. This is the textbook "I fixed it but it's still broken" pattern.

**Fix:** Delete the local `StatCard` in Investments.tsx, import the shared one. If the shared component lacks the `sub` text variant, add a `sub?: string` prop instead of forking.

### HIGH: God-Files (3 files > 2,500 LOC)

`Journal.tsx` (3,083), `PropAccounts.tsx` (3,079), `Dashboard.tsx` (2,671) are unmaintainable at this size. Each one bundles modal logic, form logic, list logic, business rules, and presentational helpers.

These are also the files where bugs cluster — the z-index map shows Journal alone has 9 z-index occurrences. Big files = stacking context chaos = portal bugs.

Extraction targets (do AFTER bug fixes, not before):
- Journal.tsx → JournalList, JournalEntryModal, TradeImageGallery, JournalLightbox, JournalCalendar
- PropAccounts.tsx → AccountList, AccountFormModal, AccountStatusFlow, RuleEvaluator
- Dashboard.tsx → DashboardHero, DashboardKPIs, DashboardCharts, DashboardInsights

### MEDIUM: 167 Hardcoded Hex Colours in tsx

Design tokens exist but components bypass them. Each hardcoded hex breaks light-theme support. Audit needed: any tsx hex should map to a `var(--color-*)` or `var(--tx-*)` token.

Highest priority sweep: Dashboard.tsx (uses `theme.dim`, `theme.border` — likely a JS-side colour map duplicating CSS vars).

---

## 3. Browser QA — BLOCKED

`npm run dev` cannot start in WSL. node_modules was installed on Windows; rollup native binary `@rollup/rollup-linux-x64-gnu` missing.

Fix:
```
cd "/mnt/d/Codex New Dash build - Copy"
rm -rf node_modules package-lock.json
npm install
```
Then re-run audit Phase 3 (browser QA across all 9 pages).

For now, all findings are static-analysis based — which is sufficient for this audit because the issues found are structural, not visual.

---

## 4. Design Audit — Quick Read

The token system is already strong (Linear/Vercel-grade variable architecture). The problems are NOT visual design — they're structural:

1. Components bypass tokens (167 hex literals)
2. Stacking context is chaotic (51 random z-indices)
3. Page files are unmaintainable god-files

Reference systems closest to where Nexus should land: **Linear** (typography hierarchy + dense data tables) and **Kraken Pro** (trading data density + dark/light parity).

No mockups needed — the design language is sound. Fix the architecture.

---

## 5. Execution Plan

### Phase A — Stabilise (1 day)
1. Fix node_modules so dev/build works in WSL: `rm -rf node_modules && npm install`
2. Run `npm run build` → confirm 0 TS errors
3. Run `npx vitest run` → baseline test pass count
4. Run live browser QA (Phase 3 of this audit) → produce page × console-errors table

### Phase B — Architectural Bug Fixes (2-3 days)
1. **Z-index scale rollout**
   - Add the 12 z-index CSS variables to `:root` in index.css
   - Replace every `z-[N]`, `zIndex: N`, and CSS `z-index: N` with the new vars
   - Delete `z-[2147483647]` hacks in CustomSelect, DatePicker, TimePicker
   - Unify desktop/mobile picker code paths
   - Build + manually test every modal, picker, drawer, lightbox after each component

2. **Duplicate StatCard removal**
   - Add `sub?: string` to shared StatCard if missing
   - Delete local StatCard in Investments.tsx
   - Replace usages with import
   - Build + visual diff Investments page

3. **Hex literal sweep** (Dashboard.tsx first — biggest offender)
   - Replace `#hex` with `var(--color-*)` or `var(--tx-*)`
   - Verify dark + light theme parity

### Phase C — God-File Extraction (1 week)
Only after Phase B is verified stable. Extract Journal → PropAccounts → Dashboard, in that order. Each extraction is its own PR with passing build + tests.

---

## 6. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Z-index migration breaks a portal somewhere | HIGH | Phase B step 1 done component-by-component, verify each modal/picker before committing |
| Removing duplicate StatCard breaks Investments visuals | MEDIUM | Visual diff before/after; add `sub` prop instead of refactoring callers |
| God-file extraction introduces regressions | HIGH | Defer until Phase B is green; one file at a time; tests before extraction |
| `npm install` pulls newer rollup that breaks Vite | LOW | Pin via package-lock; if it breaks, downgrade rollup |

---

## Key Principle

Nexus doesn't have a design problem — the token system is already excellent. It has an **architecture problem**: 51 z-indices with no scale, duplicate components drifting apart, and three god-files over 2,500 LOC. Fix the scale, dedupe the components, then extract the god-files. The "keeps breaking" pattern stops the moment z-index becomes a finite enumerated set instead of a free-for-all.

## Next Decision

A. Approve the plan and let me execute Phase A + B autonomously (recommended)
B. Approve plan, you execute, Hermes reviews each phase
C. Drill into one finding first (z-index, StatCard dedupe, or god-file extraction)
