# Nexus App — Debug & Redesign Plan

**Date:** 5 April 2026
**App:** Nexus Trader Dashboard v1.2.0
**Path:** D:\Codex New Dash build - Copy
**Stack:** React 18 + TypeScript + Tailwind + Vite + Tauri + Zustand + Supabase
**Pages:** 9 (Dashboard, Market, Journal, PropAccounts, Expenses, Debt, Tax, Investments, Ideas)

---

## 1. CODEBASE INSPECTION RESULTS

### Size & Structure
| Metric | Value |
|--------|-------|
| Total LOC | 29,229 |
| TSX files | 40 |
| TS files | 21 |
| Components | 24 shared + inline per-page |
| Pages | 9 route-level screens |
| Build time | 13.18s |
| Build status | CLEAN (0 errors, 0 warnings except chunk size) |

### Largest Files (Architecture Risk)
| File | Lines | Bundle Size |
|------|-------|-------------|
| PropAccounts.tsx | 3,322 | 81.92 KB |
| Journal.tsx | 3,191 | 466.51 KB (!) |
| Dashboard.tsx | 2,597 | 77.59 KB |
| Investments.tsx | 1,903 | 50.74 KB |
| Market.tsx | 1,813 | 21.52 KB |
| Expenses.tsx | 1,243 | 31.50 KB |

### Code Quality ✅
- Zero `any` types
- Zero hardcoded hex colours (all use CSS variables)
- Zero TODO/FIXME/HACK comments
- Zero console.log left in production code
- All pages pass TypeScript strict mode

### Architecture Concerns ⚠️
- **36 inline component functions** spread across 8 page files
- **1 duplicate component** (CustomSelect defined in both components/ and Journal.tsx)
- **Journal.tsx bundle: 466 KB** — over Vite's 500 KB warning threshold, needs code splitting
- **50+ useEffect hooks** — many without explicit dependency arrays (potential re-render risks)

---

## 2. BUG REPORT — ALL ISSUES FOUND

### CRITICAL — Z-Index Stacking Architecture (Systemic)

The z-index system has no coherent scale. Values currently in use:

| Component | Z-Index | Position | Status |
|-----------|---------|----------|--------|
| MobileNav | 48, 55, 56 | fixed | OK (below modal) |
| CommandPalette | 80 | fixed | ⚠️ Below modal backdrop |
| Journal local CustomSelect (mobile) | 140 | absolute | ❌ BROKEN — below modal (9999), uses absolute not fixed |
| Journal local CustomSelect (desktop) | 300 | absolute | ❌ BROKEN — not portaled, clipped inside modal overflow |
| Journal lightbox | 320 | fixed | ⚠️ Below modal backdrop (9999) |
| Modal backdrop (CSS) | 9999 | fixed | Reference layer |
| Desktop portal dropdowns | 11000-11001 | fixed | ✅ OK |
| CustomSelect.tsx (mobile) | 99998 | fixed | ⚠️ Works but uses `absolute` for children |
| DatePicker (mobile) | 2147483647 | fixed | ✅ Fixed correctly |
| TimePicker (mobile) | 2147483647 | fixed | ✅ Fixed correctly |

#### Bug #1: CustomSelect.tsx — Mobile portal incomplete fix
**Severity:** HIGH
**File:** `src/components/CustomSelect.tsx:191-199`
**Root cause:** Mobile portal wrapper uses `z-[99998]` (works above modal at 9999) BUT inner elements use `className="absolute"` instead of `className="fixed"`. The `absolute` positioned backdrop and bottom-sheet are positioned relative to the portal wrapper, not the viewport. This can cause:
- Incorrect positioning if page is scrolled
- Bottom-sheet appearing at wrong location on some devices
**Fix:** Change inner elements from `absolute` to `fixed` to match DatePicker/TimePicker pattern.

#### Bug #2: Journal.tsx — Local CustomSelect is fatally broken inside modals
**Severity:** CRITICAL
**File:** `src/pages/Journal.tsx:785-850`
**Root cause:** Journal has its own inline `CustomSelect` function (line 684) that was NOT updated with the same portal fixes as the shared component.

Problems:
1. **Desktop dropdown (line 785-803):** Uses `position: absolute` + `zIndex: 300` — NOT portaled at all. Inside a modal (z-9999), this dropdown is clipped by `overflow-y: auto` on the modal content div. Users CANNOT see dropdown options when editing a trade inside the modal.
2. **Mobile portal (line 805-848):** Uses `z-[140]` — far below the modal backdrop (z-9999). The bottom-sheet will appear BEHIND the modal, invisible to the user.
3. **Mobile inner elements:** Uses `absolute` positioning, same issue as Bug #1.

**Fix:** Delete the local CustomSelect entirely. Import the shared `CustomSelect` from `@/components/CustomSelect`. The shared one already has `allowCustom` and `customLabel` props.

#### Bug #3: CommandPalette z-index below modal
**Severity:** MEDIUM
**File:** `src/components/CommandPalette.tsx:101`
**Root cause:** Command palette uses `z-[80]` which is below the modal backdrop `z-[9999]`. If a modal is open and user presses Ctrl+K, the command palette renders behind the modal.
**Fix:** Increase to `z-[10000]` or close open modals before opening command palette.

#### Bug #4: Journal lightbox z-index below modal
**Severity:** MEDIUM
**File:** `src/pages/Journal.tsx:353`
**Root cause:** Image lightbox uses `z-[320]` which is below modal backdrop `z-[9999]`. If user opens a trade image from within an edit modal, the lightbox appears behind it.
**Fix:** Increase lightbox to `z-[10001]`.

### Proposed Z-Index Scale (Standardised)

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base | 0-10 | Page content |
| Sticky headers | 20-40 | Sticky nav bars |
| Mobile nav | 50-60 | Bottom nav, side panels |
| Command palette | 100 | Ctrl+K overlay |
| Popovers/dropdowns | 200-300 | Non-portaled dropdowns |
| Modal backdrop | 1000 | Modal overlay |
| Modal content | 1001 | Modal panels |
| Portaled pickers | 2000 | DatePicker, TimePicker, CustomSelect portals |
| Lightbox | 3000 | Full-screen image viewer |
| Toast/notifications | 5000 | Toast messages |

### NON-CRITICAL — Code Architecture Issues

#### Bug #5: Duplicate CustomSelect component
**Severity:** MEDIUM (maintenance risk)
**File:** `src/pages/Journal.tsx:684-851` (167 lines of duplicated code)
**Root cause:** Journal.tsx defines its own `CustomSelect` function instead of importing the shared one. The local copy has drifted from the shared version (different z-indices, different portal patterns, no pointer-events-none wrapper).
**Fix:** Delete the local function, import from `@/components/CustomSelect`.

#### Bug #6: Journal.tsx bundle size (466 KB)
**Severity:** LOW (performance)
**Root cause:** 3,191 lines in one file with 167 lines of duplicated components, inline sub-components, and all trade-related logic in a single module.
**Recommendation:** Extract TradeCard, TradeImageGallery, P&L Calendar, and stats panels into separate component files.

---

## 3. QA DOGFOOD RESULTS — PAGE-BY-PAGE

### All Pages Tested
| Page | JS Errors | Console Warnings | Load OK | Interactive Test |
|------|-----------|-----------------|---------|-----------------|
| Login | 0 | 0 | ✅ | ✅ Continue Offline works |
| Dashboard | 0 | 0 | ✅ | ✅ Cards, quick actions, wealth targets |
| Market | 0 | 0 | ✅ | ✅ Economic calendar, news feed, sessions |
| Journal | 0 | 0 | ✅ | ✅ Log Trade modal opens, calendar works |
| Prop Accounts | 0 | 0 | ✅ | ✅ Account cards, filters, sorting |
| Expenses | 0 | 0 | ✅ | ✅ Tabs, search, add expense |
| Debt | 0 | 0 | ✅ | ✅ Debt list renders |
| Tax | 0 | 0 | ✅ | ✅ Tax profile, SA breakdown |
| Investments | 0 | 0 | ✅ | ✅ Holdings render |
| Ideas | 0 | 0 | ✅ | ✅ Notes render |

**Result: Zero JS errors across all 9 pages.** The app is functionally stable.

### Build Warnings
- Journal.tsx chunk exceeds 500 KB — Vite recommends code splitting
- No other warnings

---

## 4. DESIGN AUDIT & REDESIGN RECOMMENDATIONS

### Current Design Assessment

**What works well:**
- Dark theme with CSS variable system (good foundation)
- Consistent card-based layout across pages
- Good use of colour-coded status pills (funded=green, challenge=amber, breached=red)
- Cohesive icon system (Lucide)
- Functional mobile bottom-sheet pattern for modals
- Trading session indicators with live clocks

**What needs improvement:**

#### 4.1 Typography Hierarchy
**Current:** Heavy use of tiny text sizes (9px, 10px, 11px, 12px). Relies on font-size alone for hierarchy.
**Issue:** Difficult to scan. No clear typographic rhythm. Important numbers don't stand out enough.
**Recommendation (Linear-inspired):**
- Use 3-tier weight system: 400 (reading), 500 (emphasis), 600 (strong)
- Increase minimum text size to 12px (currently has 9px and 10px)
- Apply negative letter-spacing on display numbers (P&L figures, balances)
- Use tabular-nums for all financial figures

#### 4.2 Card System
**Current:** Cards use `var(--bg-elevated)` with thin borders. All cards look the same regardless of importance.
**Issue:** No visual hierarchy between primary content (P&L) and secondary content (quick actions).
**Recommendation (Kraken + Linear hybrid):**
- Primary cards (P&L, key metrics): Slightly elevated background + accent border-left or gradient top-border
- Secondary cards (activity feed, sessions): Standard elevation
- Tertiary cards (quick actions): Minimal, ghost-style with border only
- Standard 12px radius for all cards (currently mixed: rounded-2xl = 16px, rounded-xl = 12px)

#### 4.3 Mobile Experience
**Current:** Bottom-sheet modals work. But picker portals have z-index conflicts. Navigation is bottom-tab based.
**Issue:** Pickers get clipped inside modals (bugs #1-#4). Some cards have very dense text on mobile.
**Recommendation:**
- Fix z-index architecture (see proposed scale above)
- Increase touch targets to minimum 44px
- Add more vertical padding between cards on mobile
- Use the full-width bottom-sheet pattern consistently for ALL mobile selects

#### 4.4 Data Density
**Current:** Dashboard packs a lot of information. Journal shows trade stats, accounts, calendar, and log in one view.
**Issue:** Can be overwhelming. No clear "what to look at first" hierarchy.
**Recommendation (Revolut-inspired):**
- Lead with a single hero metric (today's P&L) at display scale
- Use progressive disclosure — collapse secondary stats behind "Show more"
- Add breathing room between sections (32px minimum gap)
- Use accent colour sparingly to highlight only the most important data point

#### 4.5 Colour & Contrast
**Current:** Good dark theme foundation with CSS variables. Uses green (#22c55e) for profit, red for loss.
**Issue:** Some text colours (--tx-3, --tx-4) may be too low contrast on dark backgrounds for accessibility.
**Recommendation:**
- Audit all text against WCAG 2.1 AA (4.5:1 minimum for normal text)
- Introduce a subtle accent colour for interactive elements (currently accent is used but inconsistently)
- Add hover/focus states to ALL interactive elements (some cards are clickable but lack visual feedback)

---

## 5. REDESIGN MOCKUP PLAN

I recommend creating HTML mockup pages using a **Linear × Kraken hybrid** design system:
- Linear's dark-mode-first approach with luminance-stepped surfaces
- Kraken's fintech precision and 12px radius button system
- Custom trading-dashboard patterns for P&L display

### Mockup Pages to Create

1. **Dashboard Redesign** — Hero P&L metric, restructured card grid, cleaner stat cards
2. **Journal Redesign** — Improved trade log with better calendar integration, cleaner modal
3. **Prop Accounts Redesign** — Account cards with better visual hierarchy and status indicators

### Design Tokens for Mockups

```css
:root {
  /* Surfaces (Linear-inspired luminance stepping) */
  --bg-base: #08090a;
  --bg-panel: #0f1011;
  --bg-elevated: #191a1b;
  --bg-hover: #28282c;
  
  /* Text (Linear's 4-tier system) */
  --tx-1: #f7f8f8;     /* Primary — headings, key data */
  --tx-2: #d0d6e0;     /* Secondary — body text */
  --tx-3: #8a8f98;     /* Tertiary — labels, metadata */
  --tx-4: #62666d;     /* Quaternary — disabled, timestamps */
  
  /* Accent (trading-specific) */
  --accent: #7132f5;     /* Primary action — Kraken purple */
  --accent-hover: #828fff;
  --profit: #22c55e;
  --loss: #ef4444;
  --challenge: #d4a84a;
  
  /* Borders */
  --border: rgba(255,255,255,0.08);
  --border-subtle: rgba(255,255,255,0.05);
  
  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-pill: 9999px;
}
```

---

## 6. EXECUTION ORDER

### Phase A: Bug Fixes (Do First)
- [ ] A1. Fix CustomSelect.tsx mobile portal — change `absolute` to `fixed` inner elements
- [ ] A2. Delete Journal.tsx local CustomSelect (lines 682-851), import shared component
- [ ] A3. Standardise z-index scale across all components
- [ ] A4. Fix CommandPalette z-index (80 → 10000)
- [ ] A5. Fix Journal lightbox z-index (320 → 10001)
- [ ] A6. Run full build + verify

### Phase B: Code Architecture (Do Second)
- [ ] B1. Extract Journal sub-components (TradeCard, TradeImageGallery, P&LCalendar)
- [ ] B2. Set up Vite manual chunks for Journal to reduce bundle
- [ ] B3. Extract PropAccounts sub-components (AccountCard, FirmAnalyticsChart, etc.)
- [ ] B4. Consider extracting Market page sub-components

### Phase C: Redesign Mockups (Do Third)
- [ ] C1. Create HTML mockup — Dashboard redesign
- [ ] C2. Create HTML mockup — Journal redesign
- [ ] C3. Create HTML mockup — Prop Accounts redesign
- [ ] C4. Review mockups with user before implementation

---

## Key Principle

The z-index chaos is the root cause of most reported bugs. Fix the stacking architecture ONCE with a standardised scale, eliminate the duplicate CustomSelect, and every portal-related bug disappears. The codebase is otherwise clean and well-typed — the problems are architectural, not code-quality.
