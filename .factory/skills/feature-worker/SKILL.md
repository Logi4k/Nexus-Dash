---
name: feature-worker
description: Feature implementation worker for new functionality (data, logic, UI)
---

# Feature Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Features involving:
- New data entry forms (P&L entries, mood/bias/checklist)
- New dashboard widgets (net worth)
- Editing capabilities (expense editing)
- Data export functionality
- Notification systems
- Features that touch both data layer and UI

## Required Skills

- `agent-browser` — MUST invoke for visual verification of new features on both desktop and mobile viewports

## Work Procedure

1. **Read the feature description** carefully. Note preconditions, expected behavior, and verification steps.

2. **Read AGENTS.md** for coding conventions and data patterns.

3. **Read affected files** — understand existing data types (src/types/index.ts), store patterns (src/lib/store.ts), and page structure.

4. **Check if type changes are needed** — if the feature requires new fields in AppData, update src/types/index.ts AND src/data/data.json (seed data) first.

5. **Write tests first** (Vitest):
   - Test data transformation logic (calculations, aggregations)
   - Test component rendering with mock data
   - Test form validation
   - Test empty/edge states

6. **Implement the feature**:
   - Data layer: update types, add any new utility functions
   - UI: create/modify components following existing patterns
   - Use `useAppData()` hook's `update()` for all data mutations
   - Follow theme token conventions (no hardcoded colors)
   - Ensure mobile responsiveness (test at 390px width)
   - Handle empty states gracefully

7. **Run typecheck**: `npx tsc --noEmit` — must pass with zero errors

8. **Run tests**: `npx vitest run` — must pass

9. **Visual verification with agent-browser**:
   - Start dev server if not running
   - Log in with test credentials
   - Navigate to affected page
   - Test the happy path (add/edit/save data)
   - Test edge cases (empty state, validation)
   - Check mobile viewport (390x844)
   - Log each check as interactiveCheck

10. **Commit** with descriptive message.

## Example Handoff

```json
{
  "salientSummary": "Implemented P&L entry system for PropAccounts. Users can add daily P&L entries with date, amount, and note. Entries display in a scrollable history list with running balance. Verified on desktop and mobile via agent-browser. TypeScript passes, 5 unit tests pass.",
  "whatWasImplemented": "Added PnlEntryForm component with date picker, amount input, and note field. Added PnlHistory component showing entries with running total. Integrated into PropAccounts page with per-account entry management. Data persists through useAppData().update() using existing pnlEntries array in Account type.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "npx tsc --noEmit", "exitCode": 0, "observation": "Zero errors" },
      { "command": "npx vitest run", "exitCode": 0, "observation": "5 tests pass" }
    ],
    "interactiveChecks": [
      { "action": "Navigated to PropAccounts, selected first account", "observed": "Account details displayed with empty P&L history" },
      { "action": "Added P&L entry: +$500 for today", "observed": "Entry appeared in history, running balance updated to $500" },
      { "action": "Added loss entry: -$200", "observed": "Entry showed in red, running balance updated to $300" },
      { "action": "Navigated away and back", "observed": "Both entries persisted correctly" },
      { "action": "Tested on mobile viewport (390x844)", "observed": "Form stacked vertically, entries readable, no overflow" }
    ]
  },
  "tests": {
    "added": [
      { "file": "src/pages/__tests__/PropAccounts.pnl.test.tsx", "cases": [
        { "name": "renders P&L entry form", "verifies": "Form fields present and functional" },
        { "name": "adds entry to account", "verifies": "Entry appears in list after save" },
        { "name": "handles negative amounts", "verifies": "Loss entries display with red styling" },
        { "name": "calculates running balance", "verifies": "Sum of entries matches displayed balance" },
        { "name": "renders empty state", "verifies": "Shows 'No entries' message when history empty" }
      ]}
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- AppData type needs structural changes beyond adding fields
- Feature requires Rust backend changes (src-tauri/src/)
- Feature depends on external API that's unavailable
- Existing data conflicts with new feature requirements
