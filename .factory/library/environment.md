# Environment

**What belongs here:** Required env vars, external dependencies, setup notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL (in .env.local)
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous key (in .env.local)
- `VITE_T212_API_KEY` — Trading 212 API key (in .env)

## External Dependencies
- Supabase cloud (auth, database, storage, realtime)
- Trading 212 API (live portfolio data)
- Forex Factory (economic calendar)
- ForexLive / FX Street (RSS news feeds)

## Platform
- Windows 10 (development machine)
- Node.js + Rust (Tauri 2)
- Android SDK + NDK (for mobile builds)
