# CODEX HANDOFF

Last updated: 2026-04-03

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
- Journal visibility pass completed for the phase-aware trade split:
  - trade rows now show `Challenge` / `Funded` chips when phase data exists
  - Trade Log now includes an `All Phases / Challenge / Funded` filter
  - active-account cards now surface the counted trade phase in the header text
- Journal active-account context fix completed:
  - active-account cards now follow the selected Journal day’s account phase when that day points to a historical challenge/funded phase
  - cards fall back to the live account phase only when the selected day does not provide a phase context
  - phase-specific prop-rule panels are hidden when viewing historical stats to avoid showing current-phase risk math against historical performance
- Journal image/lightbox and funding-cutoff fix completed:
  - Journal lightbox now renders through a body-level portal and uses full-screen safe-area-aware sizing on mobile and desktop
  - background blur/overlay now covers the full viewport instead of stopping short near the top
  - inferred funded accounts now treat the pass date itself as the final challenge day; funded stats begin on the next trade day
  - cloud-fetched trade images are now downloaded and cached as local data URLs instead of relying on remote signed URLs in the image tag
  - Journal image loads now tolerate IndexedDB/cloud fetch failures without leaving the gallery unresolved
- Navigation animation smoothing pass completed:
  - route-shell remount animation was removed from `Layout`
  - `AnimatedNumber` no longer counts up from zero on initial page mount
  - shared `fade-up` entry motion was reduced to a quick opacity-only fade
  - Dashboard root mount stagger no longer replays on page entry
- Journal trade-log density pass completed:
  - the selected-day trade list is now grouped by account + phase instead of rendering as one flat tape
  - each group shows its own trade count, W/L, fees, instrument count, and net/gross summary
  - trade rows were flattened into a denser tape-style layout with primary scan data up front and secondary details demoted
  - the trade-detail modal remains the full-detail surface, so the list is calmer without losing data access
- Journal trade-log cleanup pass completed:
  - tag UI was removed from the trade log, trade detail modal, and trade-entry form
  - trade-log account groups now support collapse/expand
  - account groups default to collapsed when a day loads
  - the selected-day stats strip now stretches more cleanly across the row on mobile and desktop
- Restore point created before the larger feature batch:
  - git tag `backup/pre-top10-20260328-023901`
  - patch backups in `C:\\Users\\phill\\Backups\\nexus\\pre-top10-20260328-023901-*.patch`
- Restore point created before the next roadmap batch:
  - git tag `backup/pre-feature-batch-20260328-024525`
  - patch backups in `C:\\Users\\phill\\Backups\\nexus\\pre-feature-batch-20260328-024525-*.patch`
- Dashboard roadmap batch was removed by user request:
  - Operating Queue, Prop Risk Copilot, Capital Allocation, and Edge Drift Alerts are no longer active in the app
- Journal rollback + prop-account recovery pass completed:
  - Setup Playbook Intelligence was removed from the Journal and the app data model
  - breached accounts no longer stick forever when edited back above their rule floor; prop status is recomputed from the current snapshot
  - Journal now keeps breached accounts with trade history visible in a separate `Breached Accounts` section below `Active Accounts`
  - Journal account filters can still target breached accounts with history, but new trade entry remains limited to active accounts
  - local live desktop data for `Lucid Trading 50K Flex` was corrected so `fundedAt` is `2026-03-27`
  - Lucid trades on `2026-03-26` were corrected back to `challenge`; funded trades begin on `2026-03-27`
  - backup of the live desktop data before this correction: `C:\\Users\\phill\\Backups\\nexus\\data-fixes\\data-before-journal-phase-fix-20260328-031754.json`
- Sync freshness fix completed:
  - `syncNow()` and online reconnect in `src/lib/store.ts` now reconcile by timestamp instead of pushing local data first
  - corrected desktop WebView `nexus_data` cache was written back into `EBWebView` local storage without wiping auth
  - corrected Lucid account/trade-phase payload was pushed to the Supabase `user_data` row
  - live Lucid funded account now resolves as `Funded`, `fundedAt = 2026-03-27`, `mll = 48207.5`
- Prop-account lifecycle and firm-rule pass completed:
  - Topstep, Lucid, and Tradeify challenge/funded rules now drive account lifecycle through the shared prop-rule engine
  - challenge accounts can auto-promote into funded accounts when the pass target is met
  - breached accounts now get breach dates and consistent live-floor evaluation from the same lifecycle path
  - funded payout readiness now checks winning-day rules, consistency, minimum request, and available payout amount
  - funded date handling now respects explicit manual edits instead of being overwritten by inferred pass history
- Mobile layout hardening pass completed across the main surfaces:
  - Dashboard, Journal, Debt, Expenses, Investments, Tax, Market, and Ideas had rigid two/three-column layouts converted to mobile-first stacks where needed
  - Ideas side panels now use full-width mobile behavior instead of desktop-only fixed widths
  - mobile Journal trade-entry sheet, dashboard summary cards, ideas workspace, and debt stats were rechecked after the layout pass
- Ideas editor UX rework completed:
  - Enter now creates a normal newline inside the current block instead of forcing a new section
  - new sections are now created intentionally with `Ctrl/Cmd + Enter` or the explicit “New section” action
  - the editor surface was restyled into a cleaner rounded document shell and several square edges were removed
  - note edits now use a local draft model with debounced commits instead of writing the whole app store on every keystroke
  - the editor now exposes simple `Draft` / `Autosaving` / `Saved` status feedback
- Settings backup safety pass completed:
  - full backup export is now versioned with a backup envelope
  - backup import now validates shape before apply, shows a preview summary, and requires explicit confirmation
  - the previous local dataset is snapshotted before import so the last import can be rolled back from Settings

## Build Status

- Web build passes with `npm run build`
- Tests pass with `npm test` (`39/39`)
- Desktop OTA release `v1.0.10` is published on GitHub and the updater endpoint is live
- Android remains sideload-only, not OTA
- Current working build version is `1.1.1`:
  - `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` are aligned on `1.1.1`
  - desktop NSIS installer rebuilt and installed from `src-tauri\\target\\release\\bundle\\nsis\\Nexus_1.1.1_x64-setup.exe`
  - installed desktop app path: `C:\\Users\\phill\\AppData\\Local\\Nexus\\nexus.exe`
  - Android debug APK rebuilt from this saved project after `tauri android init`
  - latest Android artifact: `src-tauri\\gen\\android\\app\\build\\outputs\\apk\\universal\\debug\\app-universal-debug.apk`
  - latest mobile install target verified on physical device `RZCX12KYAHF`
  - installed Android package version confirmed on-device: `versionName=1.1.1`, `versionCode=1001001`
- Journal mobile parity pass completed:
  - the shared Journal `CustomSelect` now opens as a mobile bottom sheet instead of a clipped inline dropdown
  - this covers the Trade Log account filter and the account picker inside the Log Trade modal on mobile
  - desktop popover behavior remains unchanged
- Android stale-bundle issue diagnosed and patched:
  - the installed APK was current, but Android was keeping the old WebView process/cache alive after `adb install -r`
  - `src-tauri\\gen\\android\\app\\src\\main\\java\\com\\nexus\\trader\\MainActivity.kt` now clears WebView browsing cache on debug launches and on app-version changes
  - after install, force-stop + relaunch is now part of the mobile verification flow
  - direct device screenshot confirmed the updated app shell appears only after the relaunch, which explains the earlier mismatch between Playwright and the phone
- Android frontend rebuild issue fixed:
  - the phone WebView was still serving an older embedded `index.html` (`index-By--YLEQ.js`) even after install, while current `dist/index.html` pointed at `index-BqYy_3rm.js`
  - root cause: Android native rebuilds were not reliably re-embedding frontend-only `dist` changes
  - `src-tauri\\build.rs` now emits `cargo:rerun-if-changed` for `../dist` and `../public`, so frontend bundle changes invalidate the native Android build
  - after a clean Android target rebuild + reinstall, live WebView devtools confirmed the phone now serves the current bundle hash and the Journal mobile UI matches desktop behavior
  - verified on-device via WebView devtools:
    - current script src is `http://tauri.localhost/assets/index-BqYy_3rm.js`
    - Trade Log now shows grouped/collapsed account headers on mobile
    - Active Accounts now shows the challenge/funded-aware stats path on mobile too

## Known Issues / Watch Items

- Signed OTA artifact generation still requires signing key env vars at build time.
- Supabase auth for the local test account has been intermittently unreliable.
- The Vite large-chunk warning remains.
- The main web bundle is still large and `Journal` remains the heaviest route; future work should keep reducing page-level complexity and chunk size.
- Real-device QA is still worth doing for overflow, spacing, and motion edge cases.
- If a fresh Android install still appears "old," force-stop and relaunch the app before assuming the APK is stale.
- If mobile-specific UI still looks stale after install, inspect the live WebView via `adb forward` + `http://127.0.0.1:9222/json/list` before assuming the APK is wrong.
- Android build from this saved copy required regenerating `src-tauri\\gen\\android`; if that folder is removed again, rerun `npm exec tauri android init` before building.
- There may be both a physical device and an emulator visible to `adb`; prefer explicit `adb -s <serial>` commands to avoid hitting the wrong target.

## Next Likely Work

- Continue page-by-page mobile polish and real-device QA, especially Journal, Dashboard, and any long modal flows.
- Keep tightening Prop page scalability and buffer/payout UX if account counts grow.
- Consider a dedicated conflict-safe sync/versioning pass beyond the current import preview + rollback safeguards.
- Continue bundle-size reduction, with `Journal` as the first target for deeper refactor and chunk splitting.
- When new code arrives from the user, reconcile it against the current `1.1.1` saved build in `D:\\Codex New Dash build`.

## New Chat Prompt

Recommended prompt:

`Read AGENTS.md and CODEX_HANDOFF.md, then continue with [task].`
