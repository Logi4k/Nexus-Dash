# Session Notes

## Project
- Repo: `D:\3 Copilot\2 Dash\nexus`
- App: `Nexus` trader dashboard
- Stack: React + Vite + TypeScript + Tauri
- Desktop install path: `C:\Users\phill\AppData\Local\Nexus\nexus.exe`
- Desktop data path: `C:\Users\phill\AppData\Roaming\com.nexus.trader\data.json`
- Android package: `com.nexus.trader`

## Current Status
- Core app logic, prop account engine, journal, ideas editor, offline mode, settings backup import/export, and mobile shell have all been reviewed and improved.
- Desktop and Android builds were rebuilt and reinstalled during this session.
- Validation is green:
  - `npm test`
  - `corepack pnpm exec tsc --noEmit`
  - `npm run build`

## Important Recent Fixes

### Prop Accounts
- Rebuilt firm-specific prop logic for Lucid, Tradeify, and Topstep in `src/lib/propRules.ts`.
- Added funded/challenge/breached dynamic handling, payout-cycle logic, buffer metrics, winning-day tracking, and consistency metrics.
- Fixed sticky breach regression.
- Fixed challenge-to-funded auto-promotion so it happens during normal recalculation, not only from the manual account form.
- Fixed the promotion bug where funded accounts inherited challenge-era `peakBalance` / `mll` state.
- Added a guarded migration path for already-promoted accounts with stale carryover state.
- Switched funded/pass date creation to local-date handling instead of UTC slicing.
- Repaired the saved Tradeify funded accounts in local persisted data.

### Mobile
- Fixed broken mobile avatar behavior by falling back to initials when the profile image fails.
- Reduced first-open lag on the mobile “All pages” drawer by prewarming the sheet.
- Improved mobile Ideas page/editor behavior.

### Journal
- Preserved trade tags during edit.
- Fixed screenshot/lightbox behavior across mobile and desktop.
- Fixed timezone-sensitive trade phase handling.

### App Shell / General
- Added offline/local entry path from the login screen.
- Added backup import alongside existing export in Settings.
- Reduced offline Trading212 sync noise.
- Cleaned router warnings.
- Improved monochrome readability and chart contrast.

## Data Repairs Applied
- Desktop persisted data file was directly repaired:
  - `C:\Users\phill\AppData\Roaming\com.nexus.trader\data.json`
- Corrected Tradeify account records:
  - `acc_tradeify_mar2026_1`
  - `acc_tradeify_mar2026_2`
- These were reset to funded baselines instead of carrying challenge peak/floor state.

## Latest Known Good Tradeify State
- `acc_tradeify_mar2026_1`
  - status: `Funded`
  - balance: `52500`
  - peakBalance: `52500`
  - mll: `50500`
- `acc_tradeify_mar2026_2`
  - status: `Funded`
  - balance: `49626.58`
  - peakBalance: `50000`
  - mll: `48000`

## Files Touched Recently
- `src/lib/propRules.ts`
- `src/pages/PropAccounts.tsx`
- `src/lib/payouts.ts`
- `src/types/index.ts`
- `src/lib/utils.ts`
- `src/components/MobileNav.tsx`
- `src/components/LoginScreen.tsx`
- `src/App.tsx`
- `src/components/SettingsModal.tsx`
- `src/components/NoteEditor.tsx`
- `src/components/BlockRenderer.tsx`
- `src/pages/Ideas.tsx`
- `src/pages/Journal.tsx`
- `src/pages/Investments.tsx`
- `src/lib/store.ts`
- `src/lib/tradePhases.ts`
- `src/lib/notifications.ts`
- `src/index.css`
- `src-tauri/src/lib.rs`
- `package.json`

## Build / Install Commands

### Validate
```powershell
npm test
corepack pnpm exec tsc --noEmit
npm run build
```

### Desktop Build
```powershell
npm exec tauri build -- --bundles nsis
```

### Desktop Install
```powershell
Start-Process -FilePath "D:\3 Copilot\2 Dash\nexus\src-tauri\target\release\bundle\nsis\Nexus_1.0.10_x64-setup.exe" -ArgumentList "/S" -Wait
```

### Android Build
```powershell
npm exec tauri android build -- --debug --apk --target aarch64
```

### Android Install
```powershell
adb install -r "D:\3 Copilot\2 Dash\nexus\src-tauri\gen\android\app\build\outputs\apk\universal\debug\app-universal-debug.apk"
adb shell am start -n com.nexus.trader/.MainActivity
```

## Device / Environment Notes
- Android SDK is already configured on this machine.
- Connected Android device was detected as:
  - `RZCX12KYAHF`
- Some Android launches via `adb shell monkey ...` were inconsistent; `adb shell am start -n com.nexus.trader/.MainActivity` worked reliably.

## Remaining Non-Blocking Issues
- Vite still warns that the main JS chunk is large.
- Vite still warns about mixed static/dynamic import behavior around `@tauri-apps/api/core`.
- Android/Gradle still emits upstream deprecation warnings during build.
- No major blocking runtime issue is currently open from this session.

## Good Next Steps
- Do another focused real-device UX pass on:
  - Prop Accounts
  - Journal
  - Investments
- Add more regression tests around:
  - challenge-to-funded promotion
  - funded baseline resets
  - payout-cycle transitions
  - mobile nav interactions
- If any prop-account issue appears again, inspect:
  - `src/lib/propRules.ts`
  - `src/pages/PropAccounts.tsx`
  - `C:\Users\phill\AppData\Roaming\com.nexus.trader\data.json`

## How To Resume In A New Chat
- Tell Codex:
  - “Open `D:\3 Copilot\2 Dash\nexus` and read `SESSION_NOTES.md` first.”
