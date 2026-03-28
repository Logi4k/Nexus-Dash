# CODEX HANDOFF

Last updated: 2026-03-28

Use this file for current project state. Use `AGENTS.md` for repo structure, commands, and contributor conventions.

## Product Snapshot

Nexus is a Vite + React + Tauri trader OS covering:
- dashboard / overview
- journal / trade logging
- prop account tracking
- expenses, tax, debt, investments, ideas, and market

Primary targets:
- Windows desktop via Tauri
- Android via Tauri

## Current Direction

- Keep the existing app structure.
- Improve UX incrementally instead of doing a full redesign.
- Prioritize mobile usability, sync reliability, prop-account logic, and safe release tooling.

## Key Decisions Still In Effect

- Mobile FAB actions open shell-level popups on the current page instead of routing away.
- Swipe-to-switch-page on mobile is disabled.
- Journal account views should emphasize trade stats over headline P&L.
- Prop rules are computed automatically where possible from firm/account type logic.
- Cross-chat continuity lives in repo files, not chat memory.
- Machine-specific notes, credentials, signed-in browser states, and release keys should stay in an ignored local file such as `CODEX_HANDOFF.local.md`.

## Recent Work Completed

- Public GitHub repo hygiene pass completed:
  - sensitive tracked files were sanitized at current HEAD
  - remote history was rewritten to remove old credential/data/path leaks
  - `main` and `master` now point at the same cleaned commit
- Mobile FAB flow stabilized across pages.
- Journal account filtering/status logic fixed so challenge and funded accounts appear correctly.
- Shared prop-rule engine added for Topstep, Lucid, and Tradeify.
- Payouts now persist `accountId` and reconcile linked balances on create/edit/delete/undo.
- Mobile Journal and Prop account cards were compressed for better density.
- Shared page-accent color pass and motion cleanup were applied.
- Sync reliability pass completed with store-level sync status, manual sync, and pull-latest flows.
- Notification engine expanded and now supports dismiss/reset state.
- Blank-screen bootstrap regression fixed.
- Market economic calendar reliability pass completed.
- Desktop OTA foundation completed.
- GitHub CLI is installed and authenticated for repo/release automation on the maintainer machine.
- Journal trade/account phase tracking pass completed:
  - trades now persist `accountPhase`
  - funded accounts persist `fundedAt`
  - passed challenge records persist `accountId`
  - store hydration backfills missing trade phases from pass history
  - active-account cards in Journal now only count trades from the account's current phase
- Desktop updater messaging pass completed:
  - updater failures now show a real error state instead of looking up to date
  - private-release fetch failures are explained in-app
- Local repo reconciliation completed after the history rewrite:
  - local `master` was reset to the cleaned remote head
  - in-progress Journal/OTA-related changes were restored on top of it
- Local OTA config durability fix completed:
  - `src-tauri/tauri.conf.json` now keeps the public updater runtime config committed
  - `prebuild-tauri-config.js` no longer strips updater runtime config during plain web builds
  - updater artifacts are only enabled when signing key env vars are present

## Build Status

- Web build passes with `npm run build`
- Desktop OTA bootstrap release `v1.0.9` exists
- Android remains sideload-only, not OTA

## Known Issues / Watch Items

- Signed OTA artifact generation still requires signing key env vars at build time.
- Supabase auth for the local test account has been intermittently unreliable.
- The Vite large-chunk warning remains.
- Real-device QA is still worth doing for overflow, spacing, and motion edge cases.

## Next Likely Work

- Decide the public updater host before the first real OTA test:
  - either make the updater assets public on GitHub, or
  - publish them from a separate public update host
- Cut `1.0.10+` after the host decision to test an actual OTA download/install flow.
- Continue mobile polish: spacing, overflow, animation consistency.
- Keep tightening Prop page scalability if account counts grow.
- Extend the row + detail-sheet pattern if the current Prop mobile version feels right on-device.

## New Chat Prompt

Recommended prompt:

`Read AGENTS.md and CODEX_HANDOFF.md, then continue with [task].`
