# Mobile Sync & Android APK Design

> **For agentic workers:** This spec drives a writing-plans + subagent-driven-development workflow.

**Goal:** Enable real-time data sync between the Nexus desktop Tauri app and an Android APK built from the same codebase, using Supabase as the cloud backend.

---

## Context

Nexus is a personal trader dashboard built with Tauri 2 + React 18 + TypeScript + Vite + Tailwind CSS 3. Data is currently stored in localStorage and a local Tauri file (`store.ts`). The `AppData` type is defined in `src/types/index.ts`. There is no backend. The user wants the Android app to stay in sync with the desktop app in real-time, with data persisting even when the PC is off.

**Active project path:** `D:\3 CLI\New Version\nexus`

---

## Requirements

- Works when PC is off (cloud-backed)
- Real-time sync: a change on one device appears on the other live
- Last-write-wins conflict resolution (simpler, sufficient for single-user)
- Graceful offline behaviour: if Supabase is unreachable, app proceeds with local data silently; sync resumes when connectivity is restored
- Android APK (not browser) — same Tauri 2 codebase, new Android target
- Single user — no multi-user, no registration flow
- Login screen shown only on first launch or session expiry; silent re-auth after that

---

## Architecture

```
Desktop (Windows .exe)          Android (.apk)
   Tauri 2 app                   Tauri 2 app
   └── React UI                  └── React UI (same code)
   └── store.ts ──────────────── store.ts
         │                             │
         └──────── Supabase ───────────┘
                   (single row, JSONB)
                   Realtime WebSocket
```

Both apps run the identical React codebase. `store.ts` gains a Supabase sync layer on top of the existing localStorage + Tauri file persistence. Supabase Realtime (WebSocket) pushes changes instantly to all connected devices.

---

## Supabase Schema

```sql
create table user_data (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null unique,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Auto-update updated_at on every row update
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_user_data_updated_at
before update on user_data
for each row execute procedure set_updated_at();

-- RLS: users can only read/write their own row
alter table user_data enable row level security;

create policy "own row only" on user_data
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- One row per user
- `payload` holds the entire serialised `AppData` JSON (type from `src/types/index.ts`)
- `updated_at` is set server-side by the trigger on every update — the client does NOT need to pass it in the upsert payload; the server value is authoritative
- Last-write-wins: on receiving a Realtime event, compare the incoming `updated_at` against the in-memory `_syncedAt` timestamp (defined below)
- RLS: only the authenticated user's session can read or write their row

---

## Files to Create / Modify

### New files
- `src/lib/supabase.ts` — Supabase client initialisation + auth helpers (`signIn`, `signOut`, `getSession`)
- `src/components/LoginScreen.tsx` — Minimal email/password login UI, shown only when no valid session exists
- `.env.local` (project root, gitignored) — holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Modified files
- `src/lib/store.ts` — Add Supabase sync layer (boot fetch, Realtime subscription, upsert on save)
- `src/App.tsx` — Wrap app in auth gate: check for valid Supabase session on mount; show `LoginScreen` if none, else render app

### Dependencies
- Add `@supabase/supabase-js` via `npm install @supabase/supabase-js`

---

## Environment Variables

Create `.env.local` at the project root (same level as `package.json`). This file is gitignored and baked into the binary at Vite build time:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Accessed in code via `import.meta.env.VITE_SUPABASE_URL` etc. Both the desktop build and the Android APK build use this same file — the values are embedded at compile time.

---

## store.ts Sync Behaviour

### `_syncedAt` — local sync timestamp

`_syncedAt` is an in-memory `number | null` variable in `store.ts` (module-level, not persisted). It holds a milliseconds-since-epoch number (`Date.getTime()`). It starts as `null` (no sync yet).

When comparing against Supabase `updated_at` values (which are ISO 8601 strings, e.g. `"2026-03-22T10:00:00.000Z"`), always parse them first: `new Date(updated_at).getTime()`. Never compare a raw string against `_syncedAt`.

### Boot sequence
1. Load from localStorage immediately → UI renders with no flicker (existing behaviour)
2. If Tauri desktop: load from Tauri file (existing behaviour)
3. Attempt to restore Supabase session via `supabase.auth.getSession()` — if no valid session, stop here (auth gate will show login screen)
4. Fetch latest row from Supabase (`select payload, updated_at from user_data where user_id = auth.uid()`)
   - If network unavailable or request fails: skip silently, set `_syncedAt = Date.now()` so Realtime events don't overwrite local data, proceed with local data
   - If no row found (first-ever launch): skip apply, set `_syncedAt = Date.now()`. The first `saveData()` call will upsert and create the row.
   - If row found and `new Date(updated_at).getTime() > (_syncedAt ?? 0)`: apply payload to in-memory store + localStorage + notify; set `_syncedAt = new Date(updated_at).getTime()`
   - If row found but local is newer or equal: set `_syncedAt = Date.now()` (local data is current; prevents next Realtime echo from overwriting it)
5. Subscribe to Supabase Realtime on `user_data` table filtered by `user_id=eq.<current-user-uuid>`, handling both `INSERT` and `UPDATE` event types with the same logic

### saveData() (every update)
1. Update in-memory store + notify listeners (instant UI)
2. Write to localStorage (existing)
3. Write to Tauri file if desktop (existing)
4. Upsert to Supabase: `{ user_id: currentUserId, payload: data }` — pass the plain JS object, not `JSON.stringify(data)`, as the column is `jsonb` and the Supabase client serialises it automatically. `updated_at` is set server-side by the trigger and must not be included in the upsert payload.
5. On upsert success: set `_syncedAt = Date.now()`
6. On upsert failure (offline): swallow error, local data is preserved

### Realtime incoming change
Supabase Realtime delivers the full new row on `UPDATE` events. Channel filter: `user_id=eq.<current-user-uuid>` so only this user's row triggers events.

1. Parse `new.updated_at` from the event: `const incomingTs = new Date(event.new.updated_at).getTime()`
2. Compare against `_syncedAt`: if `incomingTs > (_syncedAt ?? 0)`, apply `event.new.payload` to in-memory store + localStorage + notify listeners; set `_syncedAt = incomingTs` (use the parsed incoming timestamp, not `Date.now()`, to avoid clock-skew races)
3. If `incomingTs <= (_syncedAt ?? 0)`: ignore (we already have newer or equal data)

---

## Auth Flow

- Supabase email + password auth via `supabase.auth.signInWithPassword({ email, password })`
- Session managed entirely by the Supabase JS client — it persists the token in localStorage automatically using its own internal key (do not manually manage the token; use `supabase.auth.getSession()` to check state)
- On app launch: call `supabase.auth.getSession()` — if a valid session is returned, proceed directly to the app
- If no valid session: render `LoginScreen`
- On successful sign-in: session is automatically persisted by the Supabase client; re-render app
- No registration UI — user account created once via the Supabase dashboard

---

## LoginScreen Component

Minimal, matches Nexus dark design system (`#070810` background, DM Sans font, white/10 borders):
- Email input
- Password input
- Sign In button — calls `supabase.auth.signInWithPassword`, shows spinner while pending
- Error message displayed on failure (e.g. "Invalid email or password")
- No registration, no forgot password link

---

## Android APK Build

Tauri 2 supports Android natively via its mobile target. One-time setup on the PC:

1. Install Android Studio — includes Android SDK
2. Install NDK via Android Studio SDK Manager (`NDK (Side by side)`)
3. Set environment variables: `ANDROID_HOME` (SDK path) and `NDK_HOME` (NDK path)
4. Install Rust Android targets: `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`
5. Run `npm run tauri android init` — scaffolds the Android project under `src-tauri/gen/android/`
6. Run `npm run tauri android build` — produces a debug APK at `src-tauri/gen/android/app/build/outputs/apk/`
7. Install APK on phone via USB with ADB: `adb install <path-to-apk>` (phone must have USB debugging enabled)

The React UI and Rust backend are unchanged — no platform-specific code is needed.

---

## Security

- Supabase RLS ensures only the authenticated user can access their data row
- The anon key is safe to embed in client apps when RLS is correctly configured
- Session token is managed by the Supabase JS client in localStorage (standard behaviour)

---

## Out of Scope

- Multiple user accounts
- Data export / backup beyond what Supabase provides
- iOS build
- Push notifications
- Conflict merging (last-write-wins only)
- Signed release APK / Play Store distribution (debug APK is sufficient)
- Trade image sync: `TradeEntry.imageIds` are keys into an IndexedDB image store which is device-local and not part of `AppData`. Images are intentionally excluded from sync — journal entries will appear on new devices but their associated chart images will not. `imageIds` arrays are preserved as-is in the synced payload (not stripped), so images will still show on the originating device.

## Android Session Persistence Note

The Supabase JS client persists session tokens in `localStorage` by default. On Tauri Android, localStorage is available inside the WebView and has been confirmed to work for session persistence. No custom `storage` adapter is required in the Supabase client config for the Android build.
