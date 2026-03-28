# User Testing

**What belongs here:** testing surface, required testing skills/tools, and resource cost classification per surface.

---

## Validation Surface

### Browser (Primary)
- **Tool:** agent-browser
- **URL:** `http://localhost:1420`
- **Auth:** use a local test account stored outside source control
- **Desktop viewport:** default browser (`1440x900`)
- **Mobile viewport:** `390x844`, mobile, touch

### Starting the Dev Server
From the repository root in PowerShell:
```powershell
npm run dev
```

Verify:
```powershell
Invoke-WebRequest -Uri "http://localhost:1420" -UseBasicParsing -TimeoutSec 5
```

### Auth Flow
1. Navigate to `http://localhost:1420`
2. Wait for the login screen
3. Use local test credentials from an ignored file or your own test account
4. Click `Sign In`
5. Confirm the dashboard loads

### Theme Testing
- Toggle theme in the Settings modal
- BW mode: `theme-bw` class on the root html element
- Dark mode: default state

### Mobile Testing
- Use a `390x844` mobile/touch viewport
- Verify bottom navigation and FAB behavior
- Test modal sheets, scroll behavior, and route transitions on phone-sized screens

## Validation Concurrency

### agent-browser
- Machine-dependent; keep concurrent validators low enough that the dev server stays responsive.
- Default recommendation: **max 3** concurrent browser validators.

## Known Limitations
- Tauri-specific features such as native updater flow, file export, and mobile packaging require the Tauri runtime and cannot be fully verified in the plain browser dev server.
- In web dev mode, Tauri plugins are unavailable. Features that use native wrappers should be validated via native builds or code inspection.
