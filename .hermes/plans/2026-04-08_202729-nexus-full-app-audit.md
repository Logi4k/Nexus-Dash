# Nexus Full App Audit — 2026-04-08

## Goal
Stabilise Nexus before more feature work by identifying structural bugs, baseline environment failures, UI-system drift, and the safest execution order.

## Current Context
- Project root: `/mnt/d/Codex New Dash build - Copy`
- Stack: Tauri 2 + React 18 + TypeScript + Tailwind 3 + Vite 6
- Routes: Dashboard, Market, Journal, Prop Accounts, Expenses, Debt, Tax, Investments, Ideas
- Dev server confirmed live on `http://127.0.0.1:1420`
- Browser QA tooling blocked by `browser_navigate` daemon start failure, not by the app

## Phase 1 — Codebase Inspection

### Repo shape
| Metric | Value |
|---|---:|
| TS/TSX files | 73 |
| Pages | 9 |
| Components | 40 |
| lib files | 19 |
| Total TS/TSX LOC | 29,024 |
| Files >1000 LOC | 9 |

### Largest files (architecture risk)
| File | LOC | Risk |
|---|---:|---|
| `src/pages/Journal.tsx` | 2,568 | CRITICAL god-file |
| `src/pages/Dashboard.tsx` | 2,368 | CRITICAL god-file |
| `src/pages/Investments.tsx` | 1,880 | HIGH |
| `src/pages/Market.tsx` | 1,813 | HIGH |
| `src/pages/PropAccounts.tsx` | 1,584 | HIGH |
| `src/pages/Expenses.tsx` | 1,264 | HIGH |
| `src/lib/propRules.ts` | 1,258 | HIGH |
| `src/pages/Debt.tsx` | 1,117 | HIGH |
| `src/pages/Tax.tsx` | 1,107 | HIGH |

### Structure map
- `src/pages/` — heavy route screens, most architecture risk concentrated here
- `src/components/` — shared UI, plus `dashboard/`, `journal/`, `prop/`, `ui/`
- `src/lib/` — store, sync, rules, utilities
- `src/index.css` — actual design-token source of truth
- `AGENTS.md`, `CLAUDE.md` present and useful

### Smell summary
| Check | Result | Interpretation |
|---|---:|---|
| Inline component declarations | 42 | too much page-local UI logic |
| Hardcoded hex colours | 317 | token bypass / design drift |
| TODO/FIXME/HACK | 0 | good hygiene, but not proof of quality |
| `any` usage | 0 | type discipline is good |
| `console.log/warn/error` | 0 via grep in `src` | app code mostly clean, but see bootstrap `console.error` in `App.tsx` |
| `createPortal` usage | 19 | overlay complexity is high |
| Files >1000 LOC | 9 | recurring bug risk is structural |

## Phase 2 — Systematic Debugging Findings

### Root cause hypothesis
The app does not primarily have a "single bug" problem. It has a consistency problem across 3 layers:
1. page-level god-files
2. mixed overlay/z-index implementation
3. token system exists, but components still bypass it

### Baseline verification
| Check | Status | Findings |
|---|---|---|
| `npx tsc --noEmit` | FAIL | Real type regressions in `Expenses.tsx` and `PropAccounts.tsx` |
| `npm run build` | PASS | Vite bundles successfully, so build is masking type issues |
| Git safety | FAIL | repo is not initialised as git in this folder |

### Compiler failures
| File | Lines | Severity | Issue |
|---|---|---|---|
| `src/pages/Expenses.tsx` | 497, 841, 886, 887 | HIGH | `"__other__"` compared against `ExpenseCat | ""`; sentinel not in union |
| `src/pages/Expenses.tsx` | 835 | HIGH | `setForm` updater widens `cat` back to `string` |
| `src/pages/PropAccounts.tsx` | 1486 | MEDIUM | `addQty` is `number | ""`; comparison `addQty > 1` is unsafe |

### Code evidence
- `src/pages/Expenses.tsx:402-409` defines `form.cat` as `ExpenseCat | ""`
- `src/pages/Expenses.tsx:496-497` compares `form.cat === "__other__"`
- `src/pages/PropAccounts.tsx:156` defines `addQty` as `number | ""`
- `src/pages/PropAccounts.tsx:1486` compares `addQty > 1`

### Z-index / portal architecture audit

#### Existing scale in CSS
`src/index.css:101-117` already defines a coherent scale:
- `--z-mobile-nav: 50`
- `--z-fab: 55`
- `--z-drawer: 100`
- `--z-cmd-palette: 200`
- `--z-modal-bg: 1000`
- `--z-modal: 1010`
- `--z-picker-bg: 2000`
- `--z-picker: 2010`
- `--z-lightbox: 3000`
- `--z-toast: 5000`
- `--z-theme-flash: 9000`

#### Where the system drifts
| Component | Z-index pattern | Portaled? | Status |
|---|---|---:|---|
| `CommandPalette.tsx` | `var(--z-cmd-palette)` | likely yes | good |
| `CustomSelect.tsx` | `var(--z-picker-bg)` / `var(--z-picker)` + inline `zIndex` | yes | mixed implementation |
| `DatePicker.tsx` | `var(--z-picker-bg)` / `var(--z-picker)` + inline `zIndex` | yes | mixed implementation |
| `TimePicker.tsx` | `var(--z-picker-bg)` / `var(--z-picker)` + inline `zIndex` | yes | mixed implementation |
| `Modal.tsx` | portal | yes | needs central ownership |
| `Lightbox.tsx` | `var(--z-lightbox)` + local `z-10` controls | yes | mostly good |
| `FilterBar.tsx` | `var(--z-mobile-nav)`, `var(--z-dropdown)` | no/partial | okay |
| `MobileNav.tsx` | `var(--z-mobile-nav)`, `var(--z-fab)`, `var(--z-drawer)` + inline `zIndex` | mixed | mixed implementation |
| `Dashboard.tsx`, `Journal.tsx`, others | local `z-10`, `z-1`, inline `zIndex:1` | no | token bypass |

#### Conclusion
This is not full z-index chaos, but it is a half-migrated system. The CSS token scale is correct; enforcement is weak.

### Duplicate component finding
No obvious duplicate function-name collisions were found from `^function [A-Z]` declarations.
Counter-view: that is good, but it does not remove drift risk because many pages still carry large local subcomponents instead of extracted shared components.

## Phase 3 — Browser QA

### Status
Deferred due tooling blocker.

### What was verified
| Check | Result |
|---|---|
| Vite dev process | running |
| Listening port | `0.0.0.0:1420` |
| HTTP response | `200 OK` |
| HTML entry served | yes |
| `browser_navigate` | failed twice with daemon socket start error |

### QA matrix
| Page | Load status | JS console | Interaction test | Notes |
|---|---|---|---|---|
| All routes | NOT EXECUTED | BLOCKED | BLOCKED | browser daemon failure prevented live inspection |

### Blocker statement
Phase 3 is blocked by Hermes browser infrastructure, not by Nexus. Static audit remains valid; live DOM/console QA must be rerun once browser tooling is restored.

## Phase 4 — Design Audit

### Best-fit references
| Reference | Why it fits |
|---|---|
| Linear | dark, operator-grade, precision-first, restrained accent usage |
| Kraken | trading/fintech trust language and dense dashboard affordances |
| Revolut | product-token discipline and premium fintech confidence |

### Current design strengths
- Strong token base in `src/index.css`
- Good dark-mode foundation
- DM Sans + JetBrains Mono is directionally correct for a trading product
- Semantic colour families already exist for profit/loss/warn/category/instrument
- Z-index scale already exists centrally

### Current design weaknesses
| Area | Finding | Severity |
|---|---|---|
| Typography | many small text sizes and local overrides reduce rhythm | MEDIUM |
| Colour discipline | 317 hardcoded hex literals suggest token bypass | HIGH |
| Card hierarchy | page-level styling likely diverges card-to-card because too much styling is local | HIGH |
| Overlay architecture | components mix CSS token classes with inline style `zIndex` | HIGH |
| Tablet layout | `md:grid-cols-4` present in key pages, likely causing 768–1024px squish | HIGH |
| Page density | density is good, but god-files make consistency brittle | HIGH |

### Concrete design direction
Recommendation: move Nexus closer to a Linear × Kraken hybrid, not Revolut.

Why:
- Revolut’s pill-heavy marketing language is too consumer-fintech for a trader workstation
- Linear gives the right operator precision
- Kraken gives the right domain trust and trading context

### Proposed token refinements
| Token group | Recommendation |
|---|---|
| Typography | formalise `--font-sans`, `--font-mono`, and size steps: 11 / 12 / 13 / 15 / 16 / 20 / 24 / 32 |
| Accent policy | keep page accents, but reserve high-saturation accents for active states and data cues only |
| Surfaces | reduce local gradients; use 3 clear surface levels: base / card / elevated |
| Borders | standardise on subtle semi-transparent borders; avoid arbitrary per-component border colours |
| Shadows | 3-level shadow/ring scale only; remove bespoke shadows from pages |
| Radius | 10 / 14 / 20 / full-pill only |
| Z-index | ban raw `z-10`, `z-1`, inline numeric zIndex in page code |

## Risk Register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---:|---|
| Continuing feature work before type fixes | High | High | fix `tsc` baseline first |
| Editing god-files without snapshot/backup | High | High | initialise git or backup before extraction |
| More overlay bugs from mixed z-index patterns | High | Medium | centralise overlay primitives |
| Tablet layout complaints persist | High | Medium | audit `md:grid-cols-4/5` and move dense grids to `lg:` |
| False confidence from successful Vite builds | High | Medium | require both `tsc --noEmit` and `npm run build` |

## Recommended Execution Phases

### Phase A — Stabilise baseline (do first)
1. Fix all current `tsc --noEmit` failures in `Expenses.tsx` and `PropAccounts.tsx`
2. Add `git init` in project root before any large-file edits
3. Add a pre-flight verification checklist: `tsc --noEmit` then `npm run build`
4. Replace sentinel-string drift in forms with typed unions or explicit option constants

### Phase B — Architecture fixes
1. Enforce z-index token usage only
2. Extract overlay primitives so `Modal`, `CustomSelect`, `DatePicker`, `TimePicker` share one pattern
3. Remove local page `z-10`/`zIndex: 1` drift where it is structural rather than decorative
4. Audit all `md:grid-cols-4/5` layouts for tablet squish

### Phase C — God-file reduction
1. Start with `Journal.tsx` and `Dashboard.tsx`
2. Extract child components only in step 1
3. Modify parent files cautiously in main session with backups
4. Re-run `tsc --noEmit` after each extraction

### Phase D — Design pass
1. Formalise typography scale
2. Replace hardcoded hex values with semantic tokens
3. Standardise card/header/section primitives
4. Review BW/light theme contrast edge cases

## Files Likely to Change First
- `src/pages/Expenses.tsx`
- `src/pages/PropAccounts.tsx`
- `src/components/CustomSelect.tsx`
- `src/components/DatePicker.tsx`
- `src/components/TimePicker.tsx`
- `src/components/Modal.tsx`
- `src/index.css`
- `src/pages/Journal.tsx`
- `src/pages/Dashboard.tsx`

## Validation Standard
After each material change:
1. `npx tsc --noEmit`
2. `npm run build`
3. Browser QA when Hermes browser tooling is fixed
4. Manual tablet-width review around 768–1024px

## Recommendation
Do not jump into a redesign yet.

Do this first:
- fix the current type regressions
- initialise git safety
- standardise overlay/z-index usage
- then extract `Journal` and `Dashboard`

## Key Principle
Nexus already has the beginnings of a design system; the breakage is coming from implementation drift around that system, not from the absence of one.