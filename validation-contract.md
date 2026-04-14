# Nexus — Feature Validation Contract

> **Generated:** 2026-03-23
> **Scope:** 6 new features across Trader Workflow and Dashboard Utilities areas

---

## Area: Trader Workflow

### Feature 1 — Daily P&L Entries for Prop Accounts

#### VAL-TW-001: Add a daily P&L entry to a funded account
Open the Prop Accounts page → select any funded account → open its detail/edit view → find the P&L entry section → enter a date, amount (e.g. +£250), and optional note → save. The new entry appears in the account's P&L history list sorted by date descending, and the account's running balance updates to reflect `initialBalance + Σ(pnlEntries.amount)`.
Evidence: screenshot of the P&L list showing the new entry; running balance matches expected total.

#### VAL-TW-002: P&L entries persist across page navigation
Add a P&L entry to an account → navigate away to the Dashboard page → navigate back to Prop Accounts → reopen the same account. The entry must still be present with the correct date, amount, and note.
Evidence: screenshot before navigation and after return; entries are identical.

#### VAL-TW-003: P&L entries persist across app restart
Add a P&L entry → close and reopen the app. The entry is still present and the running balance is correct. Verify data persists in localStorage/Tauri file store (`data.json`).
Evidence: screenshot after restart; console check of `accounts[n].pnlEntries` in AppData.

#### VAL-TW-004: P&L entry with zero amount is accepted
Add a P&L entry with amount = £0.00 and a note "No trades today". The entry saves successfully and displays £0.00 in the list.
Evidence: screenshot of the zero-amount entry in the history.

#### VAL-TW-005: P&L entry with negative amount (loss)
Add a P&L entry with amount = -£500. The entry displays in loss styling (red text) and the running balance decreases accordingly.
Evidence: screenshot showing the negative entry with correct colour and updated balance.

#### VAL-TW-006: P&L history empty state
Open an account that has no `pnlEntries` (empty array or undefined). The UI displays an appropriate empty state message (e.g. "No P&L entries yet") rather than a blank area or error.
Evidence: screenshot of the empty state.

#### VAL-TW-007: P&L entry date validation
Attempt to add a P&L entry without a date or with a future date beyond today. The form either prevents submission or shows a validation error. No malformed entry is created.
Evidence: screenshot of validation error or disabled submit button.

#### VAL-TW-008: P&L entries sync across devices
On Device A, add a P&L entry to an account. On Device B (logged in to the same Supabase account), verify the entry appears within a few seconds via Realtime sync. The `accounts` array within `AppData` is synced through the `user_data` table.
Evidence: screenshots from both devices showing the same entry; Supabase Realtime subscription logs.

#### VAL-TW-009: Multiple P&L entries on the same date
Add two separate P&L entries for the same date (e.g. morning session +£150, afternoon session -£50). Both entries coexist with unique `id` values and the running balance reflects the sum of both.
Evidence: screenshot showing both entries on the same date.

#### VAL-TW-010: Running balance calculation accuracy
Add 5+ P&L entries with a mix of positive and negative amounts. Verify the displayed running balance equals `initialBalance + sum(all pnlEntry amounts)`. Cross-check by manually summing in the console.
Evidence: screenshot of balance; console output of manual calculation.

---

### Feature 2 — Mood / Bias / Checklist UI in Journal

#### VAL-TW-011: Mood selector renders and saves
Open the Journal page → create or edit a journal entry for today's date → the mood selector displays four options: great, good, neutral, bad. Select "good" → save. Reopen the entry; "good" is still selected. The `journalEntries[n].mood` field in AppData equals `"good"`.
Evidence: screenshot of mood selector with "good" highlighted; console check of `journalEntries`.

#### VAL-TW-012: Bias indicator renders and saves
In the same journal entry, the bias indicator offers three options: bullish, bearish, neutral. Select "bullish" → save. Reopen; "bullish" is persisted. The `journalEntries[n].bias` field equals `"bullish"`.
Evidence: screenshot of bias indicator showing "bullish" selected.

#### VAL-TW-013: Pre-trade checklist renders and allows checking items
The journal entry form displays a checklist sourced from `data.sessionChecklist` (string[]). Each item has a checkbox. Check 2 of 4 items → save. Reopen; the same 2 items are checked. The `journalEntries[n].checklist` array contains exactly the 2 checked item strings.
Evidence: screenshot of checklist with checked items; console check of `checklist` array.

#### VAL-TW-014: Session checklist configuration
The user can configure `sessionChecklist` items (add/remove/reorder) either in the Journal page or Settings. Changes to the checklist template persist and appear when creating new journal entries.
Evidence: screenshot of checklist configuration UI; new journal entry showing updated items.

#### VAL-TW-015: Mood, bias, and checklist default to empty on new entries
Create a new journal entry. Before any interaction, mood should be `""`, bias should be `""`, and checklist should be `[]`. No option is pre-selected.
Evidence: screenshot of a fresh journal entry with no mood/bias/checklist selections.

#### VAL-TW-016: Mood/bias/checklist persist across navigation
Set mood = "great", bias = "bearish", check 3 checklist items → save → navigate to Dashboard → return to Journal → open the same entry. All three fields retain their values.
Evidence: before/after screenshots.

#### VAL-TW-017: Mood/bias/checklist persist across app restart
Save a journal entry with mood, bias, and checklist values → close and reopen the app. All values are intact.
Evidence: screenshot after restart.

#### VAL-TW-018: Mood/bias/checklist sync across devices
On Device A, set mood = "bad" and bias = "neutral" on a journal entry. On Device B, verify the same entry reflects these values via Realtime sync (the `journalEntries` array is part of `AppData`).
Evidence: screenshots from both devices.

#### VAL-TW-019: Journal entry with only mood/bias (no trades)
Create a journal entry where no trades are logged but mood and bias are set. The entry saves successfully and is visible in the journal list — it does not require trades to exist.
Evidence: screenshot of the journal list showing the entry without trade data.

#### VAL-TW-020: Empty session checklist graceful handling
If `data.sessionChecklist` is undefined or an empty array, the checklist section either hides or shows "No checklist items configured" — no crash or blank area.
Evidence: screenshot of the journal entry form when sessionChecklist is empty.

---

### Feature 3 — Expense Editing

#### VAL-TW-021: Edit button appears on existing expenses
Open the Expenses page → locate any existing expense in the list. An edit button/icon is visible and clickable (not hidden behind hover-only states on mobile).
Evidence: screenshot showing edit affordance on expense rows.

#### VAL-TW-022: Edit expense — all fields editable
Click edit on an expense. A form/modal opens pre-populated with the expense's current `date`, `description`, `cat` (category), `amount`, and `notes`. All five fields are editable.
Evidence: screenshot of the edit form with pre-populated values.

#### VAL-TW-023: Save edited expense — values update
Change the description from "TradingView" to "TradingView Pro" and amount from £12.99 to £29.99 → save. The expense list immediately reflects the updated values.
Evidence: screenshot of the updated expense row.

#### VAL-TW-024: Edited expense persists across navigation
Edit an expense → save → navigate to Dashboard → return to Expenses. The edited values are still present.
Evidence: before/after screenshots.

#### VAL-TW-025: Edited expense persists across app restart
Edit an expense → close and reopen the app. The expense retains the edited values.
Evidence: screenshot after restart.

#### VAL-TW-026: Edit expense — category change
Change an expense's category (e.g. from "Prop Firm" to "Software"). After saving, the expense appears under the new category and the per-category totals update correctly.
Evidence: screenshot showing the expense under the new category; total recalculated.

#### VAL-TW-027: Edit expense — date change
Change an expense's date to a different month. After saving, the expense moves to the correct month group in the Expenses list.
Evidence: screenshot showing the expense in the new month grouping.

#### VAL-TW-028: Edit expense — validation on empty required fields
Attempt to save an expense with an empty description or zero/empty amount. The form prevents submission or shows a validation error.
Evidence: screenshot of the validation error.

#### VAL-TW-029: Edit expense — cancel discards changes
Open an expense for editing → change the description → cancel/close the modal without saving. The expense retains its original values.
Evidence: screenshot showing unchanged expense after cancel.

#### VAL-TW-030: Edited expenses sync across devices
On Device A, edit an expense's amount. On Device B, verify the updated amount appears via Realtime sync. Applies to both `expenses` and `genExpenses` arrays in AppData.
Evidence: screenshots from both devices.

#### VAL-TW-031: Edit works for both prop firm and general expenses
The edit capability is available on both the "Prop Firm" tab (data.expenses) and the "General" tab (data.genExpenses). Editing either type persists correctly.
Evidence: screenshots of edit actions on both tabs.

---

## Area: Dashboard Utilities

### Feature 4 — Net Worth Widget on Dashboard

#### VAL-DU-001: Net worth widget displays on Dashboard
Open the Dashboard page. A dedicated "Net Worth" widget/card is visible. It shows a single aggregated number representing: `T212 portfolio value + manual investments - debts - credit card balances`.
Evidence: screenshot of the net worth widget on Dashboard.

#### VAL-DU-002: Net worth calculation accuracy
Verify the displayed net worth equals: `data.t212.total_value + Σ(investments.units × investments.cur) - Σ(debts.currentBalance) - Σ(creditCards.balance)`. Cross-check by manually computing from AppData in the console.
Evidence: screenshot of widget value; console output of manual calculation; values match.

#### VAL-DU-003: Net worth breakdown chart
The widget includes a breakdown chart (pie, donut, or bar) showing the individual components: T212 portfolio value, manual investments total, total debts, total credit card balances. Each segment is labelled and coloured distinctly.
Evidence: screenshot of the breakdown chart with visible labels and segments.

#### VAL-DU-004: Net worth handles zero T212 data
If T212 is not connected (`t212.total_value = 0`, `t212.free_cash = 0`), the net worth calculation still works correctly using only manual investments minus debts/cards. The T212 component shows £0 in the breakdown.
Evidence: screenshot with T212 at zero; net worth = investments - debts - cards.

#### VAL-DU-005: Net worth handles no debts or credit cards
If `debts` and `creditCards` arrays are empty, the net worth equals `T212 value + manual investments` (no subtraction). The breakdown chart omits or shows £0 for debt segments.
Evidence: screenshot with empty debts/cards.

#### VAL-DU-006: Net worth handles negative net worth
If debts exceed assets, the net worth displays as a negative number in loss styling (red). The widget does not crash or show NaN.
Evidence: screenshot of a negative net worth value with red styling.

#### VAL-DU-007: Net worth updates reactively
Add a new investment on the Investments page → return to Dashboard. The net worth widget immediately reflects the increased value without requiring a refresh.
Evidence: before/after screenshots showing net worth increase after adding an investment.

#### VAL-DU-008: Net worth updates on T212 sync
Trigger a T212 portfolio sync (Investments page). After the sync completes, navigate to Dashboard. The net worth reflects the updated T212 value.
Evidence: screenshots before/after T212 sync showing net worth change.

#### VAL-DU-009: Net worth widget responsive on mobile
View the Dashboard on a mobile viewport (< 768px). The net worth widget renders correctly without overflow or clipping. The breakdown chart is legible.
Evidence: screenshot at 375px viewport width.

#### VAL-DU-010: Net worth consistent with Sidebar display
The net worth value shown in the Dashboard widget matches the net worth shown in the Sidebar's "Net Worth" card (Sidebar.tsx). Both use the same calculation.
Evidence: screenshot showing both values visible simultaneously (or compared).

---

### Feature 5 — Data Export UI

#### VAL-DU-011: Export button visible in Settings
Open the Settings modal. A "Export Data" button/section is visible, clearly labelled.
Evidence: screenshot of the Settings modal showing the export option.

#### VAL-DU-012: Export triggers file picker dialog
Click the "Export Data" button. A native file save dialog (Tauri `dialog.save()`) opens, allowing the user to choose a save location and filename. The default filename suggests something like `nexus-data-YYYY-MM-DD.json`.
Evidence: screenshot of the native file save dialog.

#### VAL-DU-013: Export saves valid JSON to chosen location
Select a save location and confirm. The Rust `export_data` command copies `data.json` from the app data directory to the chosen path. The exported file contains valid JSON that matches the current AppData structure.
Evidence: file exists at chosen path; `JSON.parse(fileContents)` succeeds; key fields present.

#### VAL-DU-014: Export shows success feedback
After successful export, the UI shows a confirmation message (toast, badge, or inline text) like "Data exported successfully".
Evidence: screenshot of the success feedback.

#### VAL-DU-015: Export handles cancel gracefully
Click "Export Data" → the file dialog opens → press Cancel. No error is shown, no file is created, and the Settings modal remains open.
Evidence: screenshot of Settings modal still open after cancel; no error in console.

#### VAL-DU-016: Export handles write permission error
Attempt to export to a read-only or restricted directory. The UI shows a meaningful error message rather than crashing or silently failing.
Evidence: screenshot of error feedback; console shows the Rust error message.

#### VAL-DU-017: Export only available in Tauri environment
If running in a browser (non-Tauri), the export button is either hidden or disabled with a tooltip explaining it requires the desktop/mobile app. No errors when Tauri APIs are unavailable.
Evidence: screenshot in browser showing disabled/hidden button; no console errors.

#### VAL-DU-018: Exported data completeness
Open the exported JSON file. Verify it contains all major AppData fields: `expenses`, `genExpenses`, `accounts`, `debts`, `creditCards`, `subscriptions`, `investments`, `tradeJournal`, `journalEntries`, `wealthTargets`, `taxProfile`, `userSettings`, etc.
Evidence: JSON file inspection showing all expected top-level keys.

---

### Feature 6 — Push Notifications for Subscription Renewals

#### VAL-DU-019: Native notification fires for upcoming subscription
Configure `subscriptionRenewalDays` to 7 days in Settings. Create a subscription with `nextRenewal` set to 3 days from today. On app launch (or at the configured check interval), a Tauri native notification appears with the subscription name, amount, and days until renewal.
Evidence: screenshot of the native OS notification; notification content matches subscription details.

#### VAL-DU-020: No notification for subscriptions outside the window
Set `subscriptionRenewalDays` to 3. A subscription with `nextRenewal` 10 days from now should NOT trigger a native notification.
Evidence: no notification appears; console logs confirm the subscription was filtered out.

#### VAL-DU-021: Notification fires for subscription due today
A subscription with `nextRenewal` = today triggers a notification with an urgent tone (e.g. "Due today!" or "Renewing today").
Evidence: screenshot of the notification with "today" language.

#### VAL-DU-022: Multiple subscriptions generate multiple notifications
If 3 subscriptions fall within the renewal window, all 3 generate notifications (either as individual OS notifications or a single grouped notification listing all three).
Evidence: screenshot(s) of notification(s) covering all 3 subscriptions.

#### VAL-DU-023: Notification respects the configurable lead-days setting
Change `subscriptionRenewalDays` from 7 to 14 in Settings. A subscription due in 10 days that previously did NOT trigger a notification now does.
Evidence: before (no notification at 7-day window) → after (notification at 14-day window).

#### VAL-DU-024: Notifications do not duplicate on rapid app restarts
Close and reopen the app twice in quick succession. Notifications for the same subscription should not fire more than once per day/session. Some deduplication mechanism prevents spam.
Evidence: only one notification per subscription per session; console logs confirm dedup.

#### VAL-DU-025: Notification permission request
On first launch or first notification attempt, the app requests OS notification permission via Tauri's notification API. If permission is denied, the app degrades gracefully (no crash) and the in-app NotificationBell still works.
Evidence: screenshot of permission prompt; screenshot of in-app bell working after permission denied.

#### VAL-DU-026: Notification links to relevant section
Clicking/tapping the native notification opens the app or brings it to the foreground. Ideally, it navigates to the Investments page (where subscriptions are managed) or the Settings page.
Evidence: screenshot showing the app foregrounded after notification tap.

#### VAL-DU-027: No notifications when subscriptions array is empty
If `data.subscriptions` is empty, no notifications fire and no errors are thrown during the notification check cycle.
Evidence: clean console with no notification-related errors; no OS notifications.

#### VAL-DU-028: Notification content accuracy
The notification body includes: subscription name, renewal amount (formatted as GBP), and days until renewal. Verify the amount matches `subscription.amount` and the date math is correct.
Evidence: screenshot of notification; cross-check with subscription data.

#### VAL-DU-029: Notifications sync with data changes
On Device A, add a new subscription due in 2 days. After the data syncs to Device B, Device B should also fire a notification for this subscription on its next check cycle.
Evidence: notification on Device B after sync; Supabase logs confirm data arrived.

#### VAL-DU-030: In-app NotificationBell remains functional alongside push notifications
The in-app NotificationBell component (showing upcoming renewals in a dropdown panel) continues to work correctly and shows the same subscriptions that triggered push notifications. Both systems coexist without conflict.
Evidence: screenshot of NotificationBell panel showing the same subscriptions that fired as push notifications.
