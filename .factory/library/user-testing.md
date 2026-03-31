# User Testing

**What belongs here:** Testing surface, required testing skills/tools, resource cost classification per surface.

---

## Validation Surface

### Browser (Primary)
- **Tool:** agent-browser
- **URL:** http://localhost:1420 (Vite dev server)
- **Auth:** test@nexus-dev.local / TestNexus2026! (from .factory-test-credentials)
- **Desktop viewport:** Default browser (1440x900)
- **Mobile viewport:** 390x844, mobile, touch (use agent-browser emulation)

### Starting the Dev Server
On Windows PowerShell:
```
Start-Process cmd.exe -ArgumentList "/c","cd /d D:\6 Droid\New Version\nexus && npx vite --port 1420" -WindowStyle Hidden
```
Wait ~5 seconds, then verify with:
```
Invoke-WebRequest -Uri "http://localhost:1420" -UseBasicParsing -TimeoutSec 5
```

### Auth Flow
1. Navigate to http://localhost:1420
2. Login screen appears
3. Fill email: test@nexus-dev.local
4. Fill password: TestNexus2026!
5. Click "Sign In"
6. Dashboard loads

### Theme Testing
- Toggle theme in Settings modal
- BW mode: `theme-bw` class on html element
- Dark mode: default (no class)

### Mobile Testing
- Use agent-browser viewport emulation: 390x844, mobile, touch
- Bottom tab bar at viewport bottom
- Test swipe gestures via agent-browser drag actions

## Validation Concurrency

### agent-browser
- Machine: 16 GB RAM, 16 CPU cores, ~4 GB free at baseline
- Per instance: ~300 MB RAM
- Shared: Vite dev server ~200 MB
- Usable headroom (70%): ~2.9 GB
- **Max concurrent validators: 3**
- Rationale: 3 * 300 MB + 200 MB = 1.1 GB, well within 2.9 GB budget

## Known Limitations
- Tauri-specific features (push notifications, file export) cannot be tested in browser — they require the native Tauri runtime. These assertions should be verified via code inspection and TypeScript compilation rather than runtime testing.
- The dev server runs Vite (web only), not Tauri dev. Tauri plugins (fs, http, shell) won't be available. Features using `tauriFetch` will fall back to native fetch in dev mode.
