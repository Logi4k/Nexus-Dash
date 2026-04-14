# Nexus Trader Dashboard — Improvement Plan
**Date:** 2026-03-24
**Scope:** Full app review — QoL features, design polish, premium UX, mobile fixes

---

## 1. Immediate Bugs to Fix First

### 1.1 FAB Cut Off on Mobile Scroll
**Problem:** The floating `+` button is wrapped in a `motion.div` that animates `y` upward when the nav bar hides on scroll. When content scrolls beyond the viewport, the FAB clips against the container edge.
**Fix:** Move FAB's `position: fixed` to be relative to the viewport (not scroll container), ensure `bottom` value accounts for the nav bar height dynamically with a CSS variable, and decouple FAB visibility from nav scroll state — FAB should always be visible regardless of nav hide.

### 1.2 Mobile Nav Tint / Gradient Bleed
**Problem:** A gradient or semi-transparent layer sits above the notification icon and avatar in the top bar, creating a visible tint that feels unpolished.
**Fix:** Audit `Layout.tsx` top bar and `MobileNav.tsx` for any `backdrop-blur` + `bg-opacity` layering that bleeds into the status bar area. The top area should be a clean solid `#070810` or fully transparent, not blurred-gradient.

### 1.3 Mobile Nav Bar Layout
**Problem:** User dislikes the current mobile nav layout. Four fixed slots + a "More" drawer feels clunky.
**Proposed redesign options:**
- **Option A (Pill nav):** Floating pill bar at the bottom with icons only, centered, with subtle active indicator — more modern, less cramped.
- **Option B (Gesture nav):** Swipe-left/right between pages, minimal bottom bar showing only current page name + page dots.
- **Option C (Tab bar redesign):** Keep tab bar but make it scrollable horizontally (all 9 pages visible), with accent underline on active.

---

## 2. Settings Rework

### Remove
- Cloud Sync section entirely (push/pull buttons, sync status) — the underlying issue is fixed

### Fix
- **Avatar color swatches:** Currently 24px circles — too small to tap on mobile. Enlarge to 44px minimum tap target, use a color picker grid layout (3×4 or 4×3)
- **Camera overlay:** Currently hover-only. Add a persistent small edit icon badge on the avatar for mobile.
- **Profile section:** Show username prominently, add "Display Name" field distinct from username, show account creation date

### Add
- **Appearance section:** Dark/light toggle (even if only dark is supported now, plant the seed), accent color preview
- **Data management:** Export all data as JSON, import from JSON backup, clear all data (with confirmation)
- **Notifications:** Toggle for market open/close reminders (groundwork for future)
- **About section:** App version, changelog link, feedback/report bug link

---

## 3. Dashboard Improvements

### QoL
- **P&L sparklines:** Small 7-day sparkline on each stat card (journal trades trend, portfolio trend)
- **Streak counter:** "You've journaled X days in a row" — gamification hook
- **Quick add button per widget:** Instead of just a global FAB, each widget section has a `+` icon that opens the relevant form pre-scoped (e.g., the Expenses widget's `+` opens the expense form)
- **Wealth target progress bar:** Replace the bare number with a progress bar or circular gauge showing % to goal
- **Collapsible widgets:** Let users hide/show dashboard sections via long-press or a layout edit mode
- **Time period filter:** Switch the entire dashboard between "This Week / This Month / This Year / All Time"

### Design
- **Card hierarchy:** Primary stats (net worth, monthly P&L) in larger cards with more breathing room; secondary stats in a 2-col compact grid
- **Net worth delta:** Show "+$X this month" in green/red beneath the main net worth number
- **Market status badge:** Live "Market Open / Pre-Market / After-Hours / Closed" pill with countdown timer to next transition

---

## 4. Journal Improvements

### QoL
- **Trade templates:** Save a trade setup as a template (instrument, direction, SL/TP ratios) for quick repeat entries
- **R:R ratio display:** Auto-calculate and show Risk:Reward ratio on each trade row
- **Win rate by instrument:** Filter journal by ticker/pair to see instrument-specific win rate
- **Tagging system:** Free-form tags on trades (e.g., `#FOMO`, `#followed-plan`, `#reversal`) with tag-based filtering
- **Trade notes rich text:** Upgrade the notes field from plain text to a simple markdown editor (bold, lists)
- **Screenshot gallery view:** Click a trade image to open a full-screen lightbox with prev/next navigation
- **Bulk delete:** Checkbox select on mobile swipe-left, desktop checkbox column

### Design
- **Trade row redesign:** Show instrument icon/color, cleaner P&L pill (green/red chip), timestamp in muted text
- **Profit factor display:** Show profit factor (gross profit / gross loss) in the summary stats area
- **Calendar heatmap:** A GitHub-style calendar showing trade frequency and P&L intensity per day

---

## 5. Market Page Improvements

### QoL
- **Watchlist:** Pin symbols with current price, daily % change (mock data or free API like Yahoo Finance)
- **Price alerts:** "Alert me when BTC crosses $X" — stored locally, checked when app opens
- **Economic event reminders:** Mark high-impact events as "watching" — badge on the Market icon when one is due today
- **Event notes:** Add personal notes to economic events ("expect volatility on NFP")
- **Filter by impact:** High / Medium / Low impact filter on the calendar

### Design
- **Impact color coding:** Red = High, Yellow = Medium, Grey = Low (currently inconsistent)
- **Today highlighted:** Clear "TODAY" marker in the calendar with accent color
- **Compact vs expanded view toggle:** Card view vs list view for events

---

## 6. Prop Accounts Improvements

### QoL
- **Target progress bars:** Visual progress bars on current balance toward funded target / payout target
- **Account timeline:** Show account creation date + days active
- **Breach alert indicator:** Warning icon when daily drawdown approaches limit (if limit is tracked)
- **Multi-currency support:** Track accounts in USD, GBP, EUR with conversion rate input
- **Account notes:** Per-account notes field for broker login info, strategy notes
- **Phase tracking:** Challenge phase → Verification → Funded — visual stage indicator

### Design
- **Account card redesign:** More breathing room, accent color bar on left edge per status (active = accent, failed = red, passed = green)
- **Stats at a glance:** Show win rate, trade count, best/worst day on the card without needing to open detail view

---

## 7. Expenses Improvements

### QoL
- **Recurring expenses:** Mark an expense as recurring (monthly/weekly) so it auto-appears each period
- **Category budget:** Set a monthly budget per category, show spend vs budget progress bar
- **CSV export:** Export all expenses for accounting/tax
- **Bulk import:** Paste CSV from bank export to bulk add transactions
- **Search / filter:** Filter by category, date range, amount range
- **Undo delete:** Toast with "Undo" for 5 seconds after deleting an expense

### Design
- **Category breakdown donut chart:** Visual spend breakdown by category
- **Monthly trend bar chart:** Spend per month for last 6 months
- **Spending heatmap:** Calendar view showing spend intensity by day

---

## 8. Investments / Subscriptions Improvements

### QoL
- **Portfolio allocation chart:** Donut chart of holdings by asset class or ticker
- **Cost basis tracking:** Track purchase price per holding, show unrealized gain/loss
- **Subscription calendar:** Month view showing which subscriptions renew on which dates
- **Total annual cost:** Show yearly cost of all active subscriptions prominently
- **Price change alerts:** Flag when a subscription price changes vs last recorded amount
- **Dividend tracking:** Log dividends received per holding

### Design
- **Holdings table redesign:** Sortable columns (name, value, % gain), color-coded gain/loss
- **Subscription list redesign:** Group by billing cycle (monthly / yearly), show next renewal countdown

---

## 9. Debt Improvements

### QoL
- **Payoff calculator:** "At current payment rate, paid off in X months" — or allow input of a target payoff date
- **Avalanche / Snowball mode:** Toggle to see recommended payment order by strategy
- **Interest cost display:** Show total interest paid to date + projected total interest cost
- **Minimum vs extra payment tracker:** Log extra payments separately

### Design
- **Debt-free progress:** A single prominent progress bar: "X% paid off across all debts"
- **Per-debt payoff bar:** Progress bar per debt showing principal remaining vs original balance

---

## 10. Tax Improvements

### QoL
- **Auto-calculate from trades:** Pull realized P&L from Journal and pre-populate the tax estimate
- **Tax bracket estimator:** Input income + trading gains → estimated tax owed by bracket
- **Tax year summary:** Year-to-date realized gains/losses summary
- **Document notes:** Attach notes to each tax record (e.g., broker form reference)
- **CSV export for accountant**

### Design
- **YTD running total:** Prominent "Estimated tax owed this year: $X" at the top
- **Quarterly breakdown:** Q1/Q2/Q3/Q4 estimated payments section

---

## 11. Ideas Page Improvements

### QoL
- **Priority levels:** Mark ideas as High / Medium / Low priority with color indicators
- **Status tags:** To-Do / In Progress / Done / Archived — make it a lightweight Kanban
- **Link attachment:** Attach a URL to an idea (e.g., link to a research article)
- **Search ideas:** Full-text search across all idea content
- **Export as markdown:** Export idea list as .md file

### Design
- **Kanban board view:** Switch between list and Kanban column layout
- **Idea cards:** Replace plain list items with cards showing priority color, status pill, note preview

---

## 12. Global UX Improvements

### Navigation
- **Breadcrumb on sub-views:** When drilling into a detail view, show "< Back to [Page]"
- **Keyboard shortcuts (desktop):** `J` for Journal, `D` for Dashboard, `/` for search, `N` for new entry
- **Command palette (desktop):** `Ctrl+K` fuzzy search across all pages and actions

### Forms
- **Form validation:** Show inline error messages on required/invalid fields (currently forms submit silently)
- **Auto-save drafts:** If user closes a form accidentally, restore the draft on re-open
- **Date picker improvement:** Current date picker is basic — use a proper calendar picker component

### Data
- **Undo / Redo:** Global undo stack for the last 10 mutations — critical for accidental deletes
- **Search / Global filter:** A top-level search that searches across trades, expenses, notes, ideas
- **Data export (all):** Export entire app data as JSON from Settings → also auto-export to a configured local folder path

### Empty States
- **Illustrated empty states:** Each page should have a friendly empty state illustration + CTA when there's no data, instead of showing nothing or a blank list
- **Onboarding checklist:** First-run wizard: "Add your first trade → Add a prop account → Set a wealth target" to guide new users

### Animations / Micro-interactions
- **Page transitions:** Subtle fade+slide between pages using Framer Motion
- **Card hover lift:** Slight `translateY(-2px)` + shadow increase on card hover (desktop)
- **Success feedback:** After adding a trade/expense/etc., show a brief success toast ("Trade added ✓")
- **Loading skeletons:** Replace blank states during load with shimmer skeleton cards

---

## 13. Design System Polish

### Typography
- **Consistent scale:** Audit all font sizes — standardize on 5 sizes: 11/13/15/18/24px
- **Number formatting:** Ensure all currency values use the same formatting utility (currently some miss decimals or currency symbols)
- **Mono font usage:** Use JetBrains Mono consistently for ALL numbers — currently mixed

### Color
- **Status colors standardized:** Define `--color-profit`, `--color-loss`, `--color-neutral`, `--color-warning` as global tokens used everywhere
- **Surface elevation:** 3 distinct surface levels (`--surface-0`, `--surface-1`, `--surface-2`) for better visual hierarchy
- **Hover states:** Consistent `hover:bg-[color]/10` pattern on all interactive elements

### Spacing
- **8px grid audit:** Ensure all spacing uses multiples of 4/8px — currently some padding is inconsistent
- **Card padding:** Standardize to 16px mobile / 20px desktop

### Motion
- **Duration tokens:** `--duration-fast: 120ms`, `--duration-base: 200ms`, `--duration-slow: 350ms` — use consistently

---

## 14. Premium Features (Monetization Potential)

These are features that could justify a Pro tier:

| Feature | Value |
|---|---|
| **Cloud sync** | Sync data across devices (Supabase/PocketBase backend) |
| **Live price data** | Real-time watchlist with price feeds |
| **AI trade analysis** | Pattern detection in journal, win rate by setup type |
| **PDF trade reports** | Exportable monthly/quarterly reports with charts |
| **Broker import** | Import trades directly from broker CSV formats |
| **Multi-user** | Shared prop firm dashboard for teams |
| **Custom dashboards** | Drag-and-drop widget layout |
| **Advanced charts** | Interactive equity curve, drawdown chart |
| **Backup to Google Drive / iCloud** | Automated cloud backups |
| **Web version** | Browser-based access alongside desktop app |

---

## 15. Mobile-Specific Improvements

- **Swipe to delete:** Swipe left on list items to reveal delete (replaces long-press or hidden button)
- **Pull to refresh:** Recalculate all derived stats on pull-down
- **Haptic feedback:** Light haptics on add/delete actions (Tauri `vibrate` API)
- **Portrait-optimized charts:** Charts currently scale poorly in portrait — make them taller/scrollable
- **Bottom sheet forms:** All add/edit forms open as bottom sheets (not modals) on mobile — easier to dismiss, thumb-friendly
- **Sticky section headers:** In long lists, section headers (e.g., "This Month") stick while scrolling
- **Font size accessibility:** Respect system font size setting

---

## Priority Order (Recommended)

### P0 — Fix Now (bugs)
1. FAB cut-off on scroll
2. Nav bar tint bleed
3. Settings: remove cloud sync, fix color swatches, fix camera button

### P1 — High Impact, Low Effort
1. Undo toast on all deletes
2. Form validation messages
3. Success toasts after add
4. Empty states with CTAs
5. Mobile nav redesign (pill or scrollable tab)
6. R:R ratio in Journal
7. Subscription annual cost display
8. Debt payoff progress bars

### P2 — High Impact, Medium Effort
1. Calendar heatmap (Journal)
2. Trade tags + filtering
3. Budget tracking (Expenses)
4. Prop account progress bars
5. Page transitions (Framer Motion)
6. Global search
7. Keyboard shortcuts (desktop)
8. Export to JSON/CSV

### P3 — Premium / Complex
1. Live price watchlist
2. AI trade analysis
3. Broker CSV import
4. PDF reports
5. Cloud sync (backend required)
