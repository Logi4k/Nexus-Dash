# Nexus Dashboard — Comprehensive Audit
**Date:** 2026-04-13
**Auditor:** Hermes Agent
**Files reviewed:** All pages, components, libraries, types, and config files in src/

---

## CRITICAL ISSUES (Fix Immediately)

### 1. DEBUG Mode Left Enabled in Production
**File:** `src/lib/store.ts`, line 2
```typescript
const DEBUG = true;
```
**Impact:** Console.log spam on every state change in production builds. Exposes internal sync state.
**Fix:** Set `const DEBUG = import.meta.env.DEV;` or `const DEBUG = false;`

### 2. `useCurrentTime()` Never Updates
**File:** `src/pages/Dashboard.tsx`, lines 70-73
```typescript
function useCurrentTime() {
  const nowRef = useRef(new Date());
  return nowRef.current;
}
```
**Impact:** The clock display on Dashboard shows the time the component mounted and never updates. The date/time string in the header is frozen.
**Fix:** Replace with `useState` + `useEffect` interval like the Market page does:
```typescript
function useCurrentTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}
```

### 3. Duplicate Status Filtering Logic — Case Sensitivity Bug
**File:** `src/pages/Dashboard.tsx`, lines 225-231
```typescript
const fundedAccs = data.accounts.filter((a) =>
  ["funded", "Funded"].includes(a.status)
);
const breachedAccs = data.accounts.filter((a) =>
  ["Breached", "breached"].includes(a.status)
);
```
**Impact:** Store.ts (line 102-108) normalizes statuses to lowercase, but Dashboard still checks for uppercase variants. If normalization runs, uppercase checks are dead code. If normalization hasn't run yet, accounts may be missed.
**Fix:** Use `normalizeAccountStatus()` from `lib/accountStatus.ts` consistently. Dashboard should import and use `isActiveAccount`, `isBreachedAccount` helpers.

### 4. Sidebar Net Worth Calculation is Incomplete
**File:** `src/components/Sidebar.tsx`, lines 82-88
```typescript
const netWorth = totalWithdrawals - totalExpenses + investVal + t212Val - totalDebt;
```
**Impact:** Net Worth = income - costs + investments - debt. This is NOT net worth. It double-counts trading income (withdrawals are income, not wealth). Real net worth should be: assets (bank + investments) minus liabilities (debt). This shows a misleading number.
**Fix:** Either rename to "Estimated Position" or recalculate properly with actual bank balance data.

---

## HIGH PRIORITY ISSUES

### 5. Missing Empty States on Multiple Pages
**Files:** Multiple
- **Dashboard.tsx:** No empty state when there are 0 accounts, 0 withdrawals, 0 investments. Shows $0 values with no guidance.
- **Debt.tsx line 384:** Good empty state for payments ("No payments logged yet") but no empty state when there are 0 debts.
- **Tax.tsx:** No empty state when no withdrawals exist for the tax year.
- **Investments.tsx:** No empty state for subscriptions when there are none.
- **Market.tsx:** Good error handling but could show a friendlier empty state for news.

**Fix:** Add empty state panels with a brief explanation and CTA button on each page.

### 6. No Confirmation Dialog for Destructive Actions
**Files:** Multiple
- **Ideas.tsx line 383-401:** `deleteTopic()` deletes all notes in a topic with no undo.
- **PropAccounts.tsx:** Deleting an account has no confirmation beyond inline "Delete/Cancel" which is good, but deleting a payout at line 186 only shows `deletingPayoutId` state — should also show toast.
- **Investments.tsx:** Deleting investments has inline confirm but no toast feedback.

**Fix:** Add `toast.success("Deleted")` after every delete action. Consider an undo buffer for Ideas topic deletion.

### 7. CommandPalette Missing "g" Keyboard Shortcut for Debt
**File:** `src/components/Layout.tsx`, lines 309-318
```typescript
case "d": navigate("/"); break;     // Dashboard
case "m": navigate("/market"); break;
case "j": navigate("/journal"); break;
case "p": navigate("/prop"); break;
case "e": navigate("/expenses"); break;
case "b": navigate("/debt"); break;  // "b" for debt?
case "i": navigate("/investments"); break;
case "t": navigate("/tax"); break;
case "n": navigate("/ideas"); break;
```
**Issues:**
- "d" goes to Dashboard (should be intuitive)
- "b" goes to Debt — not intuitive. Should be "d" for Debt, and Dashboard could be "h" for Home or kept as "d" with debt as "b" documented.
- No "g" key at all. Consider "g" prefix for "go to" (e.g., `g d` for dashboard).
- Single-letter shortcuts will fire when user types in inputs despite the `isEditing` guard — the guard doesn't cover all custom input components.

**Fix:** Add a visible shortcut legend in CommandPalette or Settings.

### 8. Journal Auto-P&L Calculation Can Produce Wrong Results
**File:** `src/pages/Journal.tsx`, lines 241-262
```typescript
const pointVal = POINT_VALUE[instrument] ?? 1;
const grossPnl = priceDiff * pointVal * qty;
```
**Impact:** When instrument is not in POINT_VALUE map, pointVal defaults to 1. If user enters a custom instrument, P&L calculation is wrong (raw price difference instead of contract value).
**Fix:** Show a warning when `POINT_VALUE[instrument]` is undefined. Or prompt user to enter point value for custom instruments.

### 9. Expense Amount Type Migration is Fragile
**File:** `src/lib/store.ts`, lines 92-99
```typescript
migrated.expenses = (migrated.expenses ?? []).map((e) => ({
  ...e,
  amount: typeof e.amount === "string" ? parseFloat(e.amount) || 0 : e.amount,
}));
```
**Impact:** If `parseFloat()` returns NaN for any reason, amount becomes 0 silently. The type in `types/index.ts` line 6 still shows `amount: number | string` — this should be `number` only.
**Fix:** Update `Expense.amount` type to `number` only. The migration handles legacy data.

### 10. SettingsModal Missing Density Toggle
**File:** `src/components/SettingsModal.tsx`
The density setting exists in `UserSettings` type (line 248: `density?: "comfortable" | "compact"`) and is applied in `App.tsx` ThemeApplier (line 81-83), but there is NO UI to change it in SettingsModal.
**Fix:** Add density toggle in SettingsModal under Appearance section.

---

## MEDIUM PRIORITY ISSUES

### 11. MobileNav Notification Bell Not Clickable
**File:** `src/components/MobileNav.tsx`, lines 389-412
The notification badge on the avatar is purely visual — there's no `onClick` handler to open the notifications panel. The badge just shows the count.
**Fix:** Make the badge tappable to open the notifications panel.

### 12. Tax Page Manual Override Not Persisted
**File:** `src/pages/Tax.tsx`, lines 336-339
```typescript
const [tradingManual, setTradingManual] = useState<number | null>(null);
const [expenseManual, setExpenseManual] = useState<number | null>(null);
```
These manual overrides reset on page reload. User enters manual values, refreshes, and they're gone.
**Fix:** Persist manual overrides in `taxSettings` or a new `taxOverrides` field in AppData.

### 13. Dashboard Premium Insights Only Show When Insights Exist
**File:** `src/pages/Dashboard.tsx`, lines 851-903
```typescript
{(premiumInsights.length > 0) && (
  <motion.div ...>
    {premiumInsights.length > 0 && (  // DUPLICATE condition
```
The outer condition already checks `premiumInsights.length > 0`, then the inner div checks again. This is dead logic.

### 14. Ideas Page Missing Keyboard Shortcut Hints
**File:** `src/pages/Ideas.tsx`
No keyboard shortcut to create a new note (should be Cmd+N or similar). The zen mode toggle has no keyboard shortcut.

### 15. No Loading Skeleton for Lazy-Loaded Pages
**File:** `src/App.tsx`, lines 59-71
`RouteFallback` shows "Loading page..." text. This is functional but bland. Each page should have a skeleton matching its layout.

### 16. ErrorBoundary Has No Retry Mechanism
**File:** `src/components/ErrorBoundary.tsx`
The only recovery is "Reload page" which refreshes the entire app. Should offer "Try again" that resets the error state.
**Fix:** Add a "Try again" button that calls `this.setState({ hasError: false, error: null })`.

### 17. PropAccounts Multi-Create Has No Batch Feedback
**File:** `src/pages/PropAccounts.tsx`, line 497
```typescript
const qty = editAccount ? 1 : Math.max(1, Math.min(addQty || 1, 50));
```
Can create up to 50 accounts at once with no progress indicator or confirmation of how many were created.
**Fix:** Show toast: "Created {qty} accounts".

### 18. Debt Strategy Panel Calculation Has Bug
**File:** `src/pages/Debt.tsx`, lines 416-427
The Avalanche strategy applies extra payment only to the highest APR debt but calculates months incorrectly:
```typescript
return { months: Math.max(...sorted.map((d) => 
  calcPayoff(d.currentBalance, d.rate, d.monthly + (sorted[0].id === d.id ? extraMonthly : 0))?.months ?? 0)), ... };
```
This computes each debt independently. Real avalanche is sequential — after paying off the first debt, its payment rolls into the next.
**Fix:** Note this is a simplified model. Add disclaimer text: "This is an estimate. Actual payoff depends on sequential repayment."

### 19. Market Page News Source Errors Not Surfaced Well
**File:** `src/pages/Market.tsx`
When news fetch fails, the error message is stored but the user sees a generic message. Rate limiting (HTTP 429) silently waits 5 minutes with no user-facing indicator.
**Fix:** Show a toast when rate-limited: "News feed rate-limited. Retrying in 5 minutes."

### 20. CommandPalette Dynamic Items Require 2+ Characters
**File:** `src/components/CommandPalette.tsx`, line 67
```typescript
if (!normalized || normalized.length < 2 || !dynamicItems?.length) {
```
Single-character searches don't show dynamic items (recent entries, saved views). This is intentional but undocumented.

---

## LOW PRIORITY / POLISH

### 21. Dashboard Chart Data Only Shows Last 8 Months
**File:** `src/pages/Dashboard.tsx`, line 259
```typescript
const last8 = allKeys.slice(-8);
```
The P&L charts are hardcoded to 8 months. No way to see more history without going to Journal.

### 22. Investments Page T212 API Key Storage
**File:** `src/pages/Investments.tsx` + `src/lib/deviceSettings.ts`
The T212 API key is stored in localStorage. On desktop (Tauri), it should use the secure keychain. Currently it's plaintext in localStorage.

### 23. Modal Swipe-to-Dismiss Has No Velocity Detection
**File:** `src/components/Modal.tsx`, lines 67-89
Dismiss is based on distance (80px) not velocity. A fast flick should also dismiss even if < 80px.

### 24. Export Center Modal Missing
**File:** Referenced in Layout.tsx line 138 (`exportCenterOpen`) but the actual `ExportCenterModal` component import exists. However, the Shift+X shortcut opens it — there's no visible button in the UI to discover this.

### 25. Mobile Navigation "More" Sheet Has No Customization
**File:** `src/components/MobileNav.tsx`
The "More" sheet shows all 9 pages. User can customize the 4 bottom nav items in Settings, but the More sheet order is always the same. Should respect user's preferred order.

### 26. Accessibility: Missing aria-labels on Icon-Only Buttons
**Files:** Multiple
- Dashboard hero banner account status pills (lines 658-693) — buttons have no aria-label.
- Dashboard KPI cards — clickable but no aria-label.
- Sidebar collapse button has aria-label (good).
- Many chart elements are not accessible.

### 27. Accessibility: Color Contrast Issues
**Files:** Multiple
- `text-tx-4` color on dark backgrounds may fail WCAG AA for small text.
- B/W theme mode (`theme-bw`) needs contrast verification.
- Status badges use alpha colors that may be hard to read.

### 28. Performance: Dashboard useMemo Recomputes on Every Data Change
**File:** `src/pages/Dashboard.tsx`, line 348
```typescript
}, [data, heroPeriod]);
```
The entire `stats` memo recomputes whenever ANY field in `data` changes, not just withdrawals, expenses, investments, etc. Should destructure specific arrays:
```typescript
}, [data.withdrawals, data.expenses, data.investments, data.debts, data.accounts, data.t212, heroPeriod]);
```

### 29. Performance: Journal Trades Recalculation
**File:** `src/pages/Journal.tsx`, line 281-290
`tradesWithResolvedPhase` recalculates on every render when `allTrades`, `accountsById`, or `data.passedChallenges` change. With large trade histories this could be slow. Consider pagination or virtualization.

### 30. No Data Validation on Account Balance Entry
**File:** `src/pages/PropAccounts.tsx`, line 423
```typescript
if (!form.balance) return;
```
This only checks if balance is truthy. A user can enter negative balances, extremely large numbers, etc. No input validation.

### 31. Expenses "Other" Tab Has No Content
**File:** `src/pages/Expenses.tsx`
The `TabKey = "propfirm" | "other"` type exists but the "other" tab is not implemented in the UI. The `genExpenses` data is collected but never shown.

### 32. CreditCard Type Exists But Unused
**File:** `src/types/index.ts`, lines 114-122
```typescript
export interface CreditCard {
  id: string;
  name: string;
  balance: number;
  limit: number;
  apr: number;
  minPayment: number;
  network: string;
}
```
This type exists in `AppData.creditCards` but is never referenced in any page. The Debt page uses `Debt` type instead. Dead type.

### 33. Ideas Page Draft Save Timer Not Debounced Properly
**File:** `src/pages/Ideas.tsx`, lines 331-345
The 1500ms auto-save timer fires on every `draftNote?.updatedAt` change. Since `updateNoteDraft()` sets `updatedAt` to `new Date().toISOString()` on every keystroke, this fires on every keystroke after 1.5s. Should debounce the `updatedAt` update itself.

### 34. Market Session Progress Bar Shows 0% When Session is Active But Before Start
**File:** `src/pages/Market.tsx`, line 101
```typescript
if (start === end) return 0;
```
Some sessions may have start === end (24h sessions). These always show 0% progress.

### 35. No Offline Indicator
The app has offline mode support but no visual indicator when the user is offline. Should show a banner: "You're offline. Changes will sync when you reconnect."

---

## SUMMARY BY PAGE

### Dashboard (Dashboard.tsx — 2452 lines)
- useCurrentTime() never updates (CRITICAL)
- Duplicate status filtering (CRITICAL)
- Premium insights has duplicate condition check
- Stats memo recomputes on all data changes (PERF)
- No empty states for zero data
- Chart hardcoded to 8 months

### Journal (Journal.tsx — 2406 lines)
- Auto-P&L defaults to pointVal=1 for unknown instruments
- Large file — consider splitting TradeForm into its own component
- No virtualization for large trade lists

### Prop Accounts (PropAccounts.tsx — 1745 lines)
- No batch feedback for multi-account creation
- No input validation on balance entry
- MLL calculation complexity — verify correctness

### Expenses (Expenses.tsx — 1349 lines)
- "Other" tab completely missing from UI
- genExpenses collected but never displayed
- Good monthly trend chart implementation

### Debt (Debt.tsx — 1168 lines)
- Strategy panel calculation is simplified (not sequential)
- No empty state when 0 debts
- Good payment history UI

### Tax (Tax.tsx — 1116 lines)
- Manual overrides not persisted
- Good UK tax calculation logic
- No empty state for zero income year

### Investments (Investments.tsx — 1934 lines)
- T212 API key in plaintext localStorage
- Good allocation ring visualization
- No empty state for subscriptions

### Ideas (Ideas.tsx — 798 lines)
- Topic deletion destroys all child notes with no undo
- Draft auto-save fires on every keystroke
- Good block editor implementation

### Market (Market.tsx — 940 lines)
- Rate limiting not surfaced to user
- Good session tracker
- News sources depend on proxy/Direct based on Tauri

---

## SUMMARY BY CATEGORY

### Missing Features / Incomplete Flows
1. Expenses "Other" tab not implemented
2. Settings density toggle has no UI
3. CreditCard type exists but unused
4. Tax manual overrides don't persist
5. No data export from Journal page directly

### Broken Logic / Dead Code
1. useCurrentTime() never updates
2. Duplicate status checks (funded/Funded, breached/Breached)
3. Premium insights duplicate condition
4. Debt strategy calculation is simplified
5. CreditCard interface unused

### UX Gaps
1. Missing empty states on 5+ pages
2. No offline indicator
3. No loading skeletons for lazy pages
4. Export center has no visible UI trigger
5. No confirmation before topic deletion in Ideas
6. MobileNav notification badge not tappable

### Navigation Issues
1. "b" for Debt is not intuitive
2. Single-letter shortcuts may conflict with inputs
3. No keyboard shortcut for creating notes in Ideas

### Missing Keyboard Shortcuts
1. Cmd+N for new note in Ideas
2. Cmd+E for export center
3. No shortcut to toggle zen mode in Ideas

### Accessibility Gaps
1. Icon-only buttons missing aria-labels
2. Color contrast issues with muted text
3. Charts not accessible to screen readers
4. No focus management after deletions

### Performance Issues
1. Dashboard stats memo too broad
2. Journal trade list not virtualized
3. Ideas auto-save fires on every keystroke

### Design Inconsistencies
1. Some pages use PageHeader component, others inline headers
2. Delete confirm patterns vary (inline vs modal vs toast)
3. Empty state designs differ per page
4. Color usage varies (some use CSS vars, some hardcoded hex)
