# Nexus Dashboard - Implementation Summary

## ✅ COMPLETED IN THIS SESSION

### 1. **Topstep Trading Rules Added**
- **Status:** DONE
- **Location:** `src/pages/PropAccounts.tsx` (Lines 186-209)
- **What was added:**
  - Topstep Standard plan for $50K, $100K, $150K accounts
  - Profit Target: 6% of account size ($3K, $6K, $9K)
  - MLL (Max Loss): $2K, $3K, $4.5K per account size
  - DLL (Daily Loss): $1K, $2K, $3K
  - Max Contracts: 5, 10, 15
  - Rules integrated into FIRM_PLANS and PLAN_SIZES_BY_FIRM
  - parsePlanInfo function updated to recognize Topstep format

**You can now:**
- Select Topstep as a firm when creating accounts
- Choose Standard plan
- Pick account size ($50K, $100K, $150K)
- MLL and Profit Target auto-populate from Topstep rules

### 2. **Performance by Firm - Dropdown Filter**
- **Status:** DONE
- **Location:** `src/pages/PropAccounts.tsx` (Lines 341-415)
- **What was added:**
  - Dropdown selector above the firm list
  - Default: "All Firms" (shows all firms)
  - Can filter to single firm
  - Responsive design (mobile/desktop)
  - Properly recalculates totals based on selected firm

**User Experience:**
- Instead of seeing all 7 firms at once, users can select one
- Less visual clutter
- Cleaner performance viewing

---

## ⏳ REMAINING FEATURES (Detailed Implementation Guide)

### 1. **Journal - P&L by Account Display**
**Priority:** Medium | **Effort:** 30 minutes

**What it should do:**
- At bottom of each day's trade section, show P&L breakdown by account
- List each account that has trades that day
- Show: Account Name | Net P&L | Win/Loss Count

**Implementation Steps:**
1. Open `src/pages/Journal.tsx`
2. Find `dayStats` calculation (~line 761)
3. Add new calculation after it:

```typescript
const pnlByAccount = useMemo(() => {
  const map: Record<string, { wins: number; losses: number; net: number }> = {};
  
  for (const trade of dayTrades) {
    const accId = trade.accountId || "Unassigned";
    if (!map[accId]) map[accId] = { wins: 0, losses: 0, net: 0 };
    
    if (trade.pnl > 0) map[accId].wins++;
    if (trade.pnl < 0) map[accId].losses++;
    map[accId].net += (trade.pnl - (trade.fees ?? 0));
  }
  return map;
}, [dayTrades]);
```

4. Render it after the current net P&L footer (~line 1529)
5. Create a grid/list showing each account's P&L

---

### 2. **Journal - Remove "Recent Days" Section**
**Priority:** Low | **Effort:** 5 minutes

**What to do:**
1. Find `recentDates` useMemo (~line 773)
2. DELETE this entire block:

```typescript
const recentDates = useMemo(() => {
  const withEntries = new Set([
    ...entries.map((e) => e.date),
    ...allTrades.map((t) => t.date),
  ]);
  return [...withEntries].sort((a, b) => b.localeCompare(a)).slice(0, 10);
}, [entries, allTrades]);
```

3. Find the rendering section (~line 1776)
4. DELETE the entire `{recentDates.map(...)}` section (lines 1776-1825)

This will remove the date buttons on the left sidebar.

---

### 3. **Journal - Per-Account Stats Cards**
**Priority:** Medium | **Effort:** 45 minutes

**What it should show (for each Challenge account):**
- Account name and firm badge
- Current balance vs Initial balance
- P&L $ and %
- Progress bar to profit target (%)
- MLL status (distance from liquidation)
- Win rate (%)
- Trade count for day
- Largest win/loss

**Implementation:**
1. After filters section, add:

```typescript
const challengeStats = useMemo(() => {
  const accounts = (data.accounts || []).filter(a => a.status === "Challenge");
  return accounts.map(acc => {
    const accTrades = allTrades.filter(t => t.accountId === acc.id);
    const pnl = accTrades.reduce((s, t) => s + (t.pnl - (t.fees ?? 0)), 0);
    const balance = toNum(acc.balance);
    const initial = toNum(acc.initialBalance) || balance;
    const winCount = accTrades.filter(t => t.pnl > 0).length;
    const lossCount = accTrades.filter(t => t.pnl < 0).length;
    const winRate = accTrades.length > 0 ? (winCount / accTrades.length) * 100 : 0;
    
    return { acc, pnl, balance, initial, winCount, lossCount, winRate, trades: accTrades };
  });
}, [data.accounts, allTrades]);
```

2. Render as cards grid (3-4 columns on desktop, 1 on mobile)
3. Use firm colors for visual consistency

---

### 4. **Journal - Fix "All Accounts" Dropdown Overflow**
**Priority:** High | **Effort:** 10 minutes

**Issue:** When you click "All Accounts" filter, dropdown options get cut off

**Solution:**
1. Find the `CustomSelect` function in Journal.tsx (around line 600-700)
2. Locate the dropdown menu rendering (the `<div>` that appears when `open === true`)
3. Add CSS to the dropdown list:

```typescript
// In the dropdown container div, add:
style={{
  maxHeight: "300px",
  overflowY: "auto",
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  zIndex: 10,
  // ... existing styles
}}
```

This allows the dropdown to scroll if there are many accounts.

---

### 5. **Per-Challenge Account Stats Dashboard**
**Priority:** High | **Effort:** 60 minutes

**What it should show:**
Create a dedicated stats section in PropAccounts showing metrics for each Challenge account.

**Card Layout:**
```
┌────────────────────────────────────┐
│ Account Name | Lucid Flex $25K    │
├────────────────────────────────────┤
│ Balance: $52,340                   │
│ P&L: +$2,340 (9.4%)               │
│ Progress: ████████░░ 75%          │
│ MLL Safety: $50,000 away           │
│ Win Rate: 62% (21W / 13L)        │
│ Largest: +$850 W / -$420 L       │
└────────────────────────────────────┘
```

**Implementation:**
1. Create a new component `AccountChallengeStats.tsx`
2. Add after FirmAnalyticsChart in PropAccounts
3. Get all Challenge accounts
4. Calculate stats from linked trades
5. Display as responsive grid

**Color Coding:**
- Green: P&L > 0, Win rate > 50%, Good MLL distance
- Yellow: P&L near target, Win rate 40-50%, MLL getting close
- Red: Breached, Losses mounting, MLL very close

---

## Build Status
✅ **Current:** Builds successfully with Topstep rules and Performance dropdown
✅ **Desktop:** Installer ready at `src-tauri/target/release/bundle/nsis/Nexus_1.0.9_x64-setup.exe`

## Testing Checklist After Implementation

- [ ] Can create Topstep accounts with auto-filled rules
- [ ] Performance by Firm dropdown filters correctly
- [ ] Journal P&L shows breakdown by account
- [ ] Recent Days section is completely removed
- [ ] Account dropdown doesn't cut off options
- [ ] Per-account stats display with proper calculations
- [ ] Colors match theme (dark/light mode)
- [ ] Mobile responsive for all new features
- [ ] No console errors
- [ ] Build succeeds (`npm run build`)

## Key Files Modified This Session
- `src/pages/PropAccounts.tsx` - Topstep rules + Performance dropdown
- `src/pages/PropAccounts.tsx` - FIRMS, FIRM_PLANS, PLAN_SIZES_BY_FIRM, parsePlanInfo

## Files to Modify Next
- `src/pages/Journal.tsx` - All remaining features
- Optional: Create `src/components/AccountChallengeStats.tsx` for stats cards
