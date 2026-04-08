# Nexus Finance Pages — Full Audit Report

**App:** Nexus (Tauri 2 + React 18 + TypeScript + Tailwind)  
**Audited by:** Subagent — 5 April 2026  
**Files read:** Debt.tsx (1117ln), Investments.tsx (1903ln), Tax.tsx (1107ln), Expenses.tsx (1243ln), Dashboard.tsx (2597ln), types/index.ts (334ln), data/data.json (142ln), lib/store.ts (641ln)

---

## DATA SCHEMA SUMMARY

### Debt schema
```typescript
// Debt[] — credit cards
interface Debt {
  id: string;
  name: string;
  creditLimit: number;
  currentBalance: number;
  rate: number;          // APR %
  monthly: number;        // monthly payment
  nextPayment: string;   // ISO date
  network?: string;      // "VISA","MC","AMEX"
  lastFour?: string;
  payments?: DebtPayment[];
}
interface DebtPayment { id, date, amount, notes? }

// CreditCard[] — also exists but unused
// otherDebts: Debt[] — also exists but currently empty
```

**Gap:** The schema only models credit-card-style debt (limit, balance, rate). Personal loans, family loans, and solicitor debt have no appropriate schema — they'd be forced into the credit card form.

---

### Investments schema
```typescript
interface Investment {
  id: string; ticker: string; name: string;
  type: "etf" | "stock";
  units: number; buy: number; cur: number;
}
interface WealthTarget {
  id: string; emoji: string; name: string; desc: string;
  target: number; saved: number; monthly: number; color?: string;
}
interface T212 {
  last_sync: number; free_cash: number; total_value: number;
  invested: number; ppl: number; result: number;
}
interface Subscription {
  id: string; name: string; amount: number;
  frequency: "monthly"|"yearly"|"weekly";
  startDate: string; nextRenewal: string;
  notes?: string; cancelled?: boolean; cancelledAt?: string;
}
```

**Gap:** No ISA type. No S&S ISA wrapper. No pension (SIPP/workplace) type. WealthTarget is general-purpose and reusable.

---

### Tax schema
```typescript
interface TaxProfile {
  country: string;
  employmentStatus: string;
  annualIncome: number;
  ukSpecific: {
    studentLoan: string;     // only string — no Plan 1/2/4 options
    pensionPercentage: number;
    taxCode: string;
    isScottish: boolean;
  };
  otherSpecific: { effectiveTaxRate: number; };
}
interface taxSettings {       // lives in AppData, separate from TaxProfile
  salary: number;
  savedSoFar: number;
  savingsGoalOverride: number | null;
}
```

**Gap:** StudentLoan is a plain string with no schema constraints. No NI (National Insurance) tracking. No CGT schema for investment disposals. No dividend income tracking.

---

### Expenses schema
```typescript
interface Expense {
  id: string; date: string; description: string;
  cat: string;               // "account"|"subscription"|"other"
  amount: number | string;
  notes?: string;
}
// Two separate arrays in AppData:
AppData.expenses:      Expense[]   // prop firm expenses
AppData.genExpenses:   Expense[]   // general ledger
// Withdrawal for prop payouts:
interface Withdrawal {
  id: string; date: string; firm: string;
  gross: number; accountId?: string;
  postBalance?: number; notes?: string;
}
```

**Gap:** No monthly budget limit fields. No recurring vs one-off distinction for general expenses.

---

## PAGE-BY-PAGE ANALYSIS

---

## Debt Page (Debt.tsx)

### What it tracks
- Credit cards: name, balance, credit limit, APR, monthly payment, next payment date
- Payment history per card (date, amount, notes)
- Per-card utilization %
- Monthly interest cost per card
- Days until next payment (overdue alerts)

### What it displays
- Summary strip: Total Debt, Credit Limit, Overall Utilisation (with healthy/warn/loss thresholds), Monthly Interest
- Card list: expandable rows with utilisation mini-bars, APR, monthly interest, due countdown
- Payoff progress bars (from payment history)
- Debt Freedom panel: progress ring showing % paid, projected debt-free date
- Per-card distribution donut ring
- Upcoming payments calendar (sorted by date, overdue/soon colour-coded)
- Payoff Strategies panel: Avalanche vs Snowball comparison with adjustable extra monthly budget
- Payoff order list (Avalanche sorted)
- Interest Insight card
- Debt Freedom Projections table: Balance, APR, Monthly, Total Interest, Payoff timeline (table + visual bar timeline)

### Current gaps/opportunities
1. **No non-credit-card debt support** — The form and schema only fit credit cards (creditLimit, utilization). The sister's loan, solicitor/lawyer debt, and any personal loan have no appropriate entry point. They can't be added as a "card" without a credit limit field. **Fix: add a "personal loan" debt type with an optional `creditLimit` field, or use the existing `otherDebts` array (which currently exists but has no UI).**
2. **No suspended/frozen debt status** — Barclays suspended account can't be marked as inactive or suspended. Adding a `status` field ("active"|"suspended"|"resolved") would allow tracking without losing the record.
3. **Debt Freedom date doesn't account for suspended payments** — If a card is suspended (Barclays), its minimum payment may not be due. The payoff projection uses `d.monthly` unconditionally.
4. **No high-APR flag for avalanche prioritisation** — Capital One at 30.34% should be visually flagged above the others. A "fire" or "priority" indicator on high-rate cards would be useful.
5. **Snowball/Avalanche comparison is static** — It doesn't account for payment holidays or suspended accounts.
6. **No interest saved calculator with custom extra payments** — The £50/mo extra shown is hardcoded suggestion. Allow the user to input any extra amount and see the real savings.

---

## Investments Page (Investments.tsx)

### What it tracks
- Trading 212 portfolio: live positions via API (ticker, quantity, avg price, current price, P&L)
- Manual investment holdings: ticker, name, type (ETF/stock), units, buy price, current price
- Subscriptions: name, amount, frequency (weekly/monthly/yearly), next renewal date
- Wealth targets (savings goals): emoji, name, description, target, saved, monthly contribution
- T212 sync status and API key management

### What it displays
- T212 connection banner with API key input flow
- Sync status + last sync time
- Stats row: Total Value (T212 + manual), Cost Basis, Unrealised P&L, Free Cash
- Holdings table: ticker, name, type badge, units, avg cost, current, value, P&L, P&L% with inline progress bar, edit/delete actions
- Portfolio allocation donut ring (by ticker)
- Portfolio composition bar (ETF vs Stock)
- Top performers list (top 5 by P&L%)
- Worst performer callout
- Upcoming subscription renewals (next 30 days)
- Total P&L summary card
- Wealth Targets grid: progress ring, saved/target, monthly contribution, ETA to target
- Subscription management: active/cancelled tabs, cancel/reactivate, add/edit/delete
- Search + filter by performance (all/gain/loss) and sort by value

### Current gaps/opportunities
1. **No S&S ISA tracking** — All holdings are shown as either ETF or stock. A UK investor should be able to mark holdings as "ISA" vs "GIA vs SIPP" to track inside/outside ISA wrappers. **Add a `wrapper: "ISA"|"GIA"|"SIPP"` field to Investment and show ISA % of total.**
2. **No annual ISA allowance tracker** — UK ISA allowance is £20,000/year (2024/25). A widget showing "ISA allowance used vs remaining" would be critical.
3. **Pension (SIPP) not tracked** — No way to add a SIPP or workplace pension as an "investment." Could reuse the Investment type with `wrapper: "SIPP"` but there's no UI for it.
4. **WealthTargets are reusable but underused** — The existing `WealthTarget` type is perfectly suited for a house deposit goal, emergency fund, etc. It should be promoted to a first-class feature on the Dashboard as a "Savings Goals" section.
5. **No dividend income tracking** — Investments show unrealised P&L but not dividends received, which is taxable in the UK.
6. **T212 free cash is shown but no "deposit funds" action** — No link to move cash from T212 to bank or vice versa.

---

## Tax Page (Tax.tsx)

### What it tracks
- Annual salary (editable, defaults to £30,000)
- Trading income: auto-derived from `withdrawals` this tax year (prop firm payouts), with manual override
- Trading expenses: auto-derived from `expenses` this tax year, with manual override
- Tax settings: savedSoFar for SA tax, monthly savings goal override
- UK tax year (6 April – 5 April)
- Payment on Account eligibility and amounts

### What it displays
- Info banner explaining PAYE vs Self Assessment for employed traders
- Three income inputs: Employment Salary (PAYE), Trading Income (auto/manual), Trading Expenses (auto/manual)
- Income band bar: shows salary + trading profit stacked against PA/Basic/Higher/Additional rate thresholds
- Full SA breakdown: employment income, gross trading income, less expenses, trading profit, combined total, PA, taxable income, tax bands (20/40/45%), total tax, PAYE credit, additional tax due
- Payment on Account panel: POA amounts, when they apply (>£1,000 bill), collapsible explanation
- Tax Summary ring: effective marginal rate (outer) + savings progress (inner)
- Key stats: SA Tax Due, Trading Profit, Effective Rate, Total Due Jan 31
- Tax Savings Tracker: progress bar, saved so far input, monthly goal (auto or custom), months to Jan 31
- SA Calendar: Tax Year End, SA Registration Deadline, Online Filing Deadline, Balancing Payment, 1st POA, 2nd POA
- Quick tips panel: 4 contextual HMRC tips
- Prop payout count and date range for current tax year

### Current gaps/opportunities
1. **No National Insurance (NI) calculation** — As an NHS employee, Class 1 NI is deducted at source, but a side-trading income does not incur extra NI. However, if trading through a limited company or if Class 2/4 NI applies (self-assessment), it should be shown. Currently zero NI is displayed anywhere.
2. **Student Loan is a free-text string** — The TaxProfile `studentLoan` is `string` with no enum. No SA calculation accounts for student loan repayments (Plan 1/2/4 thresholds and 9%/12% rates). **This is significant for someone with a student loan.** Add a `studentLoan: "none"|"plan1"|"plan2"|"plan4"|"postgrad"` field and implement thresholds.
3. **No capital gains tax (CGT) section** — Investment disposals (T212 manual stocks) trigger CGT. The page only covers income tax from trading. A CGT widget showing annual exempt amount (£3,000 in 2024/25) and CGT on disposals is missing.
4. **No dividend income section** — T212 ISA/GIA holdings pay dividends, which are taxed differently (dividend allowance £500 in 2024/25). Not tracked.
5. **No pension relief tracker** — Pension contributions attract 20%/40%/45% tax relief. A SIPP contribution tracker would be valuable.
6. **SA deadline dates are hardcoded strings** — The tax calendar should read from HMRC published dates for the relevant tax year, not be manually maintained.
7. **tradingIncome = gross withdrawals** — No deduction for platform fees already counted in `expenses`. The app already auto-fills expenses but they're shown separately; they should be pre-deducted from the gross in the auto-trading-income figure.
8. **No tax refund/repayment display** — If PAYE overpaid relative to actual total tax, the system shows zero additional tax but doesn't say "tax overpaid — reclaim £X".

---

## Expenses Page (Expenses.tsx)

### What it tracks
**Prop Firm Tab:**
- Prop firm expenses: date, firm name, category (account/subscription/other), amount (GBP), notes
- Built-in firm list: Lucid Trading, Tradeify, Topstep, FundingTicks, MyFundedFX, Take Profit Trader, Maven Trading (plus "Other")
- Monthly grouping
- Search/filter
- USD amount parsing from notes field

**Other Tab:**
- General expenses: date, description, amount (GBP), optional USD amount in notes field
- Search/filter
- Show first 5 entries, expandable

### What it displays
**Prop Firm Tab:**
- Monthly trend chart: custom CSS bar chart, peak/avg/current month, MoM delta
- Stats strip: Total Spent, This Month (vs last month), Average per Entry, Total Earned (from withdrawals) + ROI %
- Spend by Firm breakdown: ranked strip with mini donut, per-firm totals and bar charts
- Monthly collapsible groups with per-entry table (date, firm, category badge, amount, delete)
- Add Expense modal: date, category dropdown, firm dropdown, amount

**Other Tab:**
- Stats: Total Spent, This Month, Avg/Month, Total Entries
- Search + add
- List view with GBP amount, optional USD in notes

### Current gaps/opportunities
1. **No monthly budget with overspend alerts** — Prop firm costs vary, but there's no budget set per month and no alert when spending exceeds it. **Add `categoryBudgets: Record<string, number>` from the AppData schema** — it exists but has no UI.
2. **No personal/living expenses tracking** — The "Other" tab is for general ledger but has no connection to personal budget tracking (rent, groceries, NHS commute costs). A separate personal expenses section would help Philips see what he's actually saving from his NHS salary.
3. **No connection to Debt page for minimum payment tracking** — If Philips uses his credit cards for firm fees (amex for platform charges), there's no link from expenses to debt payments.
4. **Firm list is hardcoded** — Adding new firms requires a code change. A "custom firm" entry with name and optional website would be better.
5. **USD parsing from notes is fragile** — The `parseUSD` function only matches `$X,XXX` format. A dedicated USD amount field would be more robust.
6. **No annual expense summary report** — Useful for tax: total prop firm expenses per year for SA.
7. **No "recurring vs one-off" flag** — Monthly subscription fees vs one-off challenge rebuys should be distinguished for forecasting.

---

## Dashboard (Dashboard.tsx)

### What it tracks
- Net trading P&L from withdrawals vs expenses (filterable by period: 1W/1M/3M/All)
- Portfolio value: investments + T212
- Total debt: debts + otherDebts
- Prop account counts: funded, challenge, breached
- Monthly income/cost chart with net P&L
- Cumulative P&L running total
- Firm spending breakdown (top 6)
- Top payout sources by firm
- Wealth targets progress
- Active subscriptions (monthly cost)
- Market sessions with live ET times

### What it displays
- Hero banner: huge Net P&L number, period pills, badges (margin %, portfolio gain, debt total, win rate %, streak), sparkline cumulative chart
- 4-stat bottom row: Prop Income, Firm Costs, Portfolio, Monthly Burn
- KPI grid: Net P&L (with spark), Avg Monthly Income, Portfolio, Total Debt
- Monthly bar chart: income (green) vs costs (red), click to expand month detail (with trade stats from trade journal)
- Cost breakdown by firm
- Active accounts grid with Funded/Challenge/Breached tiles
- Top payout sources with bar charts
- Recent activity feed (last 6 expenses)
- Wealth targets: compact summary or expanded card grid
- Active subscriptions grid
- Market sessions widget
- Quick actions: Add Expense, Add Account, Log Payout, View Tax

### Current gaps/opportunities
1. **No consolidated net worth figure** — The dashboard shows debt, portfolio, and P&L separately but never calculates: **Net Worth = Portfolio + Cash Savings - Debt**. Adding this as a hero KPI would be transformative.
2. **WealthTargets on Dashboard are hidden by default** — The compact view shows progress bars but requires expanding. They should be visible by default.
3. **No bank/savings account balance tracking** — The AppData has `savingsAccounts: []` (referenced in data.json but empty, no UI). Bank balances should feed into the net worth calculation.
4. **No "monthly surplus" calculation** — Shows prop income vs costs but not: **NHS salary - personal expenses - debt payments - subscriptions = monthly surplus available for investing/debt payoff**.
5. **Debt badge only shows total** — Clicking navigates to debt page, but the badge doesn't show the most urgent debt (Capital One at 30.34%).
6. **No notification centre** — Subscription renewal alerts, tax deadline reminders, and debt payment reminders would belong here.
7. **Market sessions are informative but not actionable** — A "next open in X" is shown, but there's no calendar of upcoming market events.

---

## GAP ANALYSIS — What Philips Would Actually Need

### Philips's Known Situation
- NHS salary (Band 5/6 — ~£33,000–£43,000 gross)
- Prop trading income: Capital One £1,860, Barclays suspended (can't trade), Amex (platform fees), sister loan (personal), solicitor debt (legal), prop firm payouts
- Capital One 30.34% APR — highest priority debt
- House deposit as primary savings goal (WealthTarget exists but needs better use)
- Potential S&S ISA investments through T212

---

### G1: Non-Credit-Card Debt Types
**Feature:** "Personal Loan" debt entry type  
**Schema change:** Add `debtType: "creditCard" | "personalLoan" | "familyLoan" | "solicitor" | "other"` to Debt interface. For personal loans, `creditLimit` becomes optional; add `originalAmount: number` and `originalDate: string` fields.  
**UI:** New tab in Debt page: "Other Debts" using the `otherDebts` array (already in schema but no UI).  
**Why it matters:** The sister loan and solicitor debt are currently untrackable. Without a loan tracker, Philips can't see his true total obligations.

---

### G2: Debt Priority / High-Rate Alert
**Feature:** Automatic flagging of debts above a rate threshold  
**What:** Show a persistent alert banner on the Debt page when any debt exceeds 20% APR. Capital One 30.34% should be highlighted with a flame icon.  
**Why it matters:** At 30.34%, the Capital One is the obvious first target for avalanche. Currently requires manual sorting in the user's head.

---

### G3: Suspended / Frozen Account Tracking
**Feature:** Account status field  
**Schema:** Add `accountStatus: "active" | "suspended" | "closed"` to Debt. Add to the Debt form as a select.  
**UI:** Show a greyed-out or "Zzz" badge on suspended cards. Exclude suspended accounts from payoff projections and minimum payment totals (or flag them separately).  
**Why it matters:** Barclays is suspended — it shouldn't count towards "minimum monthly payments" or active debt metrics until it's resolved.

---

### G4: NHS Salary + Monthly Disposable Income
**Feature:** Personal budget section  
**What:** On the Dashboard, add a "Monthly Disposable" section: NHS salary input (monthly net) minus personal expenses (rent, food, transport, subscriptions, debt payments) = surplus available for investing or extra debt payoff.  
**Why it matters:** Prop trading P&L is volatile. Philips needs to know how much of his stable NHS income is free after fixed costs — this is his real runway for extra debt payments and investing.

---

### G5: S&S ISA Allowance Tracker
**Feature:** ISA wrapper tracking + annual allowance  
**Schema:** Add to Investment: `wrapper: "ISA" | "GIA" | "SIPP" | "none"`. Add a separate `isaAllowance` field.  
**UI:** On Investments page, show "ISA £X / £20,000 used" as a progress ring. When a manual holding is added, prompt for wrapper type.  
**Why it matters:** T212 supports ISA accounts. All UK dividends and gains inside the ISA are tax-free. Philips should maximise his ISA each year.

---

### G6: Student Loan Repayment Calculator
**Feature:** Student loan plan selector + SA impact  
**Schema:** Change `studentLoan: string` to `studentLoan: "none" | "plan1" | "plan2" | "plan4" | "postgrad"` in TaxProfile.  
**Logic:** Plan 1 (income > £22,400/yr, 9% over threshold), Plan 2 (income > £27,295/yr, 9% over threshold), Plan 4 (Scotland, 9% over threshold), Postgrad (income > £21,000, 6% over threshold).  
**UI:** Add to Tax page — a student loan section showing projected annual repayment, how it changes with trading income, and years to payoff.  
**Why it matters:** At ~£35,000 NHS salary, he's likely on Plan 2 with repayments already deducted. Trading income increases repayments but the app doesn't reflect this.

---

### G7: Monthly Budget + Overspend Alerts
**Feature:** Category budgets from `categoryBudgets: Record<string, number>`  
**Schema:** Already exists in AppData but has no UI. Use `EXPENSE_CATS` (account, subscription, other) as keys.  
**UI:** On Expenses page, add a "Budget" section showing per-category limits, current spend vs budget, and a visual overspend warning (red border, toast notification).  
**Why it matters:** Prop firm subscriptions (monthly) vs one-off challenge costs need separate budget tracking. The £X/monthly figure helps with cash flow planning.

---

### G8: Net Worth Tracker
**Feature:** Consolidated net worth panel  
**What:** Add to Dashboard: `Net Worth = investments + t212 + savingsAccounts - totalDebt`. Show a line chart of net worth over time (from periodic snapshots).  
**Schema:** Add `savingsAccounts: { id, name, balance, type: "current"|"savings"|"ISA" }[]` (already referenced in data.json but unused) and `netWorthSnapshots: { date: string; value: number }[]`.  
**Why it matters:** The house deposit goal (WealthTarget) is meaningless without knowing current net worth. Net worth trending upward is motivating.

---

### G9: Capital Gains Tax Widget
**Feature:** Investment disposal tracking  
**Schema:** Add `disposals: { id, date, ticker, quantity, proceeds, costBasis, gain: number }[]`. Calculate CGT: gain above annual exempt amount (£3,000 in 2024/25) × applicable rate (10%/20% for basic/higher).  
**UI:** Add to Tax page as a "Investment Disposals" card showing YTD CGT liability.  
**Why it matters:** If Philips sells ETF units at a gain, CGT is due. Currently the Tax page only covers trading income, not investment gains.

---

### G10: Tax Deadline Calendar Integration
**Feature:** Real SA/HMRC deadline display  
**What:** The Tax page already has deadline dates, but they're hardcoded strings. They should auto-populate from the current HMRC published tax calendar for the relevant tax year.  
**UI:** Add countdown badges: "SA Registration: 7 days" with increasing urgency colours.  
**Why it matters:** Missed SA registration deadlines incur automatic £100 penalties. The current calendar just shows dates without urgency indicators.

---

### G11: Prop Firm Payout Net Gain Tracker
**Feature:** Per-firm ROI history  
**What:** Already partially done via the Expenses page's firm stats, but should be surfaced on Dashboard and Tax page. Show: total paid in fees per firm vs total earned from that firm, net ROI per firm, and "should I continue with this firm?" indicator.  
**UI:** On Expenses page, a per-firm panel showing: fees paid, payouts received, net, ROI %, recommendation badge (continue/evaluate/exit).  
**Why it matters:** If Barclays is suspended, tracking its historical performance is irrelevant going forward but useful for tax records.

---

### G12: WealthTarget for House Deposit
**Feature:** Use existing WealthTarget for primary savings goal  
**What:** The schema already supports it. Create a prominent "Primary Goal" card on Dashboard with a large progress ring, monthly contribution tracker, and ETA. The house deposit should be the default or first WealthTarget.  
**Why it matters:** WealthTargets are underused. The demo goal (£10,000 generic) should be replaced with a real house deposit target. The `emoji` and `color` fields make it visually distinct.

---

## SUMMARY OF FILES CREATED/MODIFIED

- **nexus-finance-audit.md** — This report (output file)

No source files were modified by this audit. The gaps identified are recommendations for future development.

---

## Key Observations

1. **The `otherDebts` array exists in AppData schema but has no UI** — This is the simplest win: wire up the Debt page to also show `data.otherDebts` with a "Other Debts" tab.

2. **`savingsAccounts: []` exists in data.json but is completely unused** — No UI, no schema type defined. Should be added as a `SavingsAccount` type and surfaced in a net worth panel.

3. **`categoryBudgets: {}` exists in AppData but has no UI** — The Expenses page should add budget inputs per category.

4. **TaxProfile.studentLoan is a free string** — Not an enum, not used in any calculation. Needs a proper schema + calculator.

5. **WealthTargets are duplicated on Dashboard AND Investments** — Both pages manage the same data. One page should be the canonical UI.

6. **Store uses localStorage + Tauri file + Supabase** — Data is well-persisted across three layers. No issues with state management.

7. **All calculations are client-side** — No server required for any finance calculations. All math is in `useMemo` hooks.
