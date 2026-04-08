# Mobile Sync & Android APK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time Supabase data sync across desktop and Android, and build an Android APK from the existing Tauri 2 codebase.

**Architecture:** Supabase holds a single JSONB row per user containing the full `AppData` blob. Both the Windows `.exe` and the Android `.apk` use the same React codebase; `store.ts` gains a sync layer that upserts on every save and subscribes to Realtime WebSocket for live cross-device updates. An auth gate in `App.tsx` shows a login screen when no session exists.

**Tech Stack:** `@supabase/supabase-js` v2, Supabase Auth + Realtime, Tauri 2 Android target, Vite env vars (`import.meta.env`), React 18 + TypeScript.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/supabase.ts` | Create | Supabase client + `signIn` / `getSession` helpers |
| `src/components/LoginScreen.tsx` | Create | Email/password login UI shown on first launch |
| `src/lib/store.ts` | Modify | Add `initSupabaseSync()` + Supabase upsert in `saveData()` |
| `src/App.tsx` | Modify | Auth gate: check session on mount, show `LoginScreen` or app |
| `.env.local` | Create | `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (gitignored) |

---

## Task 1: Install dependency + create `.env.local`

**Files:**
- Modify: `package.json` (via npm install)
- Create: `.env.local` (project root — same level as `package.json`)

- [ ] **Step 1: Install Supabase JS client**

```bash
cd "D:\3 CLI\New Version\nexus"
npm install @supabase/supabase-js
```

Expected: `package.json` now lists `"@supabase/supabase-js"` in `dependencies`.

- [ ] **Step 2: Create Supabase project (manual — do this in the browser)**

1. Go to [https://supabase.com](https://supabase.com) and sign in / create an account
2. Click **New project**, give it a name (e.g. `nexus`), choose a region, set a DB password
3. Wait ~2 minutes for provisioning
4. In the project dashboard go to **Settings → API**
5. Copy **Project URL** and **anon / public key**

- [ ] **Step 3: Create `.env.local`**

Create the file at `D:\3 CLI\New Version\nexus\.env.local`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

Replace the placeholder values with what you copied in Step 2.

- [ ] **Step 4: Verify `.env.local` is gitignored**

Check `D:\3 CLI\New Version\nexus\.gitignore` contains `.env.local`. If not, add it.

- [ ] **Step 5: Commit**

```bash
cd "D:\3 CLI\New Version\nexus"
git add package.json package-lock.json
git commit -m "feat: add @supabase/supabase-js dependency"
```

---

## Task 2: Create Supabase schema + user account (manual)

No code in this task — all done in the Supabase dashboard.

- [ ] **Step 1: Run the schema SQL**

In your Supabase project, go to **SQL Editor** → **New query** and run:

```sql
create table user_data (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null unique,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

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

alter table user_data enable row level security;

create policy "own row only" on user_data
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Expected: query runs without errors; `user_data` table appears in the Table Editor.

- [ ] **Step 2: Create your user account**

In the Supabase dashboard go to **Authentication → Users → Add user → Create new user**.

Enter an email and password you will use to log in on both devices. Note them down.

- [ ] **Step 3: Verify RLS is on**

In **Table Editor → user_data → RLS policies**, confirm the `"own row only"` policy is listed.

---

## Task 3: Create `src/lib/supabase.ts`

**Files:**
- Create: `src/lib/supabase.ts`

- [ ] **Step 1: Create the file**

Create `D:\3 CLI\New Version\nexus\src\lib\supabase.ts` with this exact content:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd "D:\3 CLI\New Version\nexus"
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add supabase client"
```

---

## Task 4: Create `src/components/LoginScreen.tsx`

**Files:**
- Create: `src/components/LoginScreen.tsx`

Design follows the existing Nexus dark design system: `#070810` background, `rgba(255,255,255,0.03)` card, `rgba(255,255,255,0.08)` borders, DM Sans font (inherits from body), indigo accent `rgba(99,102,241,...)`.

- [ ] **Step 1: Create the file**

Create `D:\3 CLI\New Version\nexus\src\components\LoginScreen.tsx`:

```tsx
import { useState } from "react";
import { signIn } from "@/lib/supabase";

interface Props {
  onSignIn: () => void;
}

export default function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      onSignIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#070810" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-2xl font-black tracking-tight" style={{ color: "#f8fafc" }}>
            Nexus
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Sign in to continue
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#f8fafc",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
          />
          <input
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-xl px-4 py-3 text-sm outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#f8fafc",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)")}
            onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
          />

          {error && (
            <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: "rgba(99,102,241,0.25)",
              border: "1px solid rgba(99,102,241,0.40)",
              color: "#a5b4fc",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/LoginScreen.tsx
git commit -m "feat: add login screen component"
```

---

## Task 5: Update `store.ts` — add Supabase sync layer

**Files:**
- Modify: `src/lib/store.ts`

This task adds three things to the existing store module:
1. Two module-level sync variables: `_syncedAt` and `_currentUserId`
2. A new exported `initSupabaseSync()` async function
3. A Supabase upsert appended to the existing `saveData()` function

**Important:** Do not change any existing logic. Only add to it.

- [ ] **Step 1: Add imports and sync state at the top of `store.ts`**

Open `src/lib/store.ts`. It already imports `AppData` from `@/types` on line 2 — do **not** add that import again. After the existing import block (after `import seedData from "@/data/data.json";`), add only:

```typescript
import { supabase, getSession } from "@/lib/supabase";

// ── Supabase sync state ──────────────────────────────────────────────────────
let _syncedAt: number | null = null;       // ms-since-epoch of last confirmed sync
let _currentUserId: string | null = null;  // set after successful auth
```

- [ ] **Step 2: Add `initSupabaseSync()` before the `useAppData` hook**

Paste this function before the `export function useAppData()` line:

```typescript
// ── Supabase sync initialisation ─────────────────────────────────────────────
export async function initSupabaseSync(): Promise<void> {
  const session = await getSession();
  if (!session) return;

  _currentUserId = session.user.id;

  // ── Fetch latest row from Supabase ─────────────────────────────────────────
  try {
    const { data: row } = await supabase
      .from("user_data")
      .select("payload, updated_at")
      .eq("user_id", _currentUserId)
      .single();

    if (row) {
      const remoteTs = new Date(row.updated_at as string).getTime();
      if (remoteTs > (_syncedAt ?? 0)) {
        // Remote is newer — apply it
        currentData = mergeWithSeed(row.payload as Partial<AppData>);
        localSave(currentData);
        notify();
        _syncedAt = remoteTs;
      } else {
        // Local is current — just record the timestamp
        _syncedAt = Date.now();
      }
    } else {
      // No row yet (first launch) — local data will upsert on first save
      _syncedAt = Date.now();
    }
  } catch {
    // Offline or network error — proceed with local data
    _syncedAt = Date.now();
  }

  // ── Subscribe to Realtime ──────────────────────────────────────────────────
  supabase
    .channel("user_data_sync")
    .on(
      "postgres_changes",
      {
        event: "*",  // handles both INSERT and UPDATE
        schema: "public",
        table: "user_data",
        filter: `user_id=eq.${_currentUserId}`,
      },
      (payload) => {
        const newRow = payload.new as { payload: Partial<AppData>; updated_at: string };
        if (!newRow?.updated_at) return;
        const incomingTs = new Date(newRow.updated_at).getTime();
        if (incomingTs > (_syncedAt ?? 0)) {
          currentData = mergeWithSeed(newRow.payload);
          localSave(currentData);
          _syncedAt = incomingTs;
          notify();
        }
      }
    )
    .subscribe();
}
```

- [ ] **Step 3: Replace the entire `saveData()` function**

Find the existing `saveData` function in `store.ts` (starts at `export function saveData`) and **replace the entire function** with:

```typescript
export function saveData(data: AppData): void {
  currentData = data;
  localSave(data);
  if (isTauri) {
    tauriSave(data);
  }
  notify();
  // ── Supabase sync (fire and forget) ────────────────────────────────────────
  if (_currentUserId) {
    supabase
      .from("user_data")
      .upsert({ user_id: _currentUserId, payload: data as unknown as Record<string, unknown> })
      .then(({ error }) => {
        if (!error) {
          _syncedAt = Date.now();
        }
      });
  }
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Runtime smoke test — confirm sync layer connects**

```bash
npm run dev
```

1. Sign in when the login screen appears
2. Open browser DevTools → Network tab → filter by `WS` (WebSocket)
3. Confirm a WebSocket connection to `realtime.supabase.co` appears (Realtime subscription is live)
4. Open Supabase dashboard → **Table Editor → user_data** → confirm your row exists after loading the app

- [ ] **Step 6: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: add supabase realtime sync layer to store"
```

---

## Task 6: Update `App.tsx` — auth gate

**Files:**
- Modify: `src/App.tsx`

Add session check on mount. Show `LoginScreen` if no session. Call `initSupabaseSync()` after session is confirmed.

- [ ] **Step 1: Replace `App.tsx` with the auth-gated version**

Replace the entire contents of `src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Market from "@/pages/Market";
import PropAccounts from "@/pages/PropAccounts";
import Expenses from "@/pages/Expenses";
import Debt from "@/pages/Debt";
import Tax from "@/pages/Tax";
import Investments from "@/pages/Investments";
import Journal from "@/pages/Journal";
import Ideas from "@/pages/Ideas";
import { useAppData } from "@/lib/store";
import { getSession } from "@/lib/supabase";
import { initSupabaseSync } from "@/lib/store";
import LoginScreen from "@/components/LoginScreen";

function ThemeApplier() {
  const { data } = useAppData();
  useEffect(() => {
    const isBW = data.userSettings?.theme === "bw";
    document.documentElement.classList.toggle("theme-bw", isBW);
  }, [data.userSettings?.theme]);
  return null;
}

function AppRoutes() {
  return (
    <HashRouter>
      <ThemeApplier />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="market" element={<Market />} />
          <Route path="prop" element={<PropAccounts />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="debt" element={<Debt />} />
          <Route path="tax" element={<Tax />} />
          <Route path="investments" element={<Investments />} />
          <Route path="journal" element={<Journal />} />
          <Route path="ideas" element={<Ideas />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default function App() {
  const [authReady, setAuthReady]   = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    getSession().then(async (session) => {
      if (session) {
        await initSupabaseSync();
        setHasSession(true);
      }
      setAuthReady(true);
    });
  }, []);

  // Brief invisible wait while we check session (avoids login flash for returning users)
  if (!authReady) return null;

  if (!hasSession) {
    return (
      <LoginScreen
        onSignIn={async () => {
          await initSupabaseSync();
          setHasSession(true);
        }}
      />
    );
  }

  return <AppRoutes />;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Build to confirm no runtime issues**

```bash
npm run build
```

Expected: build succeeds (exit 0).

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

1. Open `http://localhost:5173` — login screen should appear
2. Enter the email/password you created in Task 2, Step 2
3. Click Sign In — app should load with your existing data
4. Make a change (e.g. edit a wealth target)
5. Open Supabase dashboard → **Table Editor → user_data** — confirm a row exists with your data

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add auth gate and supabase session init"
```

---

## Task 7: Android APK — one-time tooling setup

This task is machine setup, not code. Do these steps manually on your Windows PC.

- [ ] **Step 1: Install Android Studio**

Download and install from [https://developer.android.com/studio](https://developer.android.com/studio). Use the default installation options.

- [ ] **Step 2: Install NDK via Android Studio**

1. Open Android Studio → **Settings → Languages & Frameworks → Android SDK**
2. Click **SDK Tools** tab
3. Check **NDK (Side by side)** and **CMake**
4. Click Apply / OK

- [ ] **Step 3: Set environment variables**

In Windows, open **System Properties → Environment Variables** and add:

| Variable | Value (adjust path to your SDK version) |
|----------|----------------------------------------|
| `ANDROID_HOME` | `%LOCALAPPDATA%\Android\Sdk` |
| `NDK_HOME` | `%LOCALAPPDATA%\Android\Sdk\ndk\<version>` (replace `<version>` with the installed NDK version folder name, e.g. `26.3.11579264`) |

Then add to `Path`: `%ANDROID_HOME%\platform-tools`

Restart your terminal after setting these.

- [ ] **Step 4: Install Rust Android targets**

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Expected: all four targets install successfully.

- [ ] **Step 5: Verify Java is available**

Android Studio ships with a JDK. Confirm it's on the path:

```bash
java -version
```

If not found, add Android Studio's JDK to `Path`: `C:\Program Files\Android\Android Studio\jbr\bin`

---

## Task 8: Build and install the Android APK

- [ ] **Step 1: Initialise the Android target**

```bash
cd "D:\3 CLI\New Version\nexus"
npm run tauri android init
```

Expected: creates `src-tauri/gen/android/` directory. May prompt for package name — use `com.nexus.app`.

- [ ] **Step 2: Build the debug APK**

```bash
npm run tauri android build -- --debug
```

Expected: APK produced at `src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk` (path may vary slightly).

- [ ] **Step 3: Enable USB debugging on your Android phone**

1. Go to **Settings → About phone**
2. Tap **Build number** 7 times to unlock Developer Options
3. Go to **Settings → Developer options**
4. Enable **USB debugging**

- [ ] **Step 4: Install the APK via USB**

Connect phone to PC via USB cable, then confirm your device is detected:

```bash
adb devices
```

Expected: your device listed (e.g. `R58M12345  device`).

Locate the produced APK (the path varies by ABI):

```bash
dir /s "src-tauri\gen\android\app\build\outputs\apk\*.apk"
```

Use the full path shown in that output for the install command:

```bash
adb install "<full-path-to-apk-from-dir-output>"
```

Expected: `Performing Streamed Install` then `Success`

- [ ] **Step 5: Smoke test sync**

1. Open Nexus on your phone — login screen appears
2. Sign in with the same credentials
3. Confirm your data loads (same as desktop)
4. Make a change on the phone (e.g. add a wealth target)
5. Within a few seconds, the change should appear on the desktop app
6. Make a change on the desktop — it should appear on the phone

- [ ] **Step 6: Commit**

```bash
git add src-tauri/gen/android/
git commit -m "feat: add android tauri target"
```

---

## Troubleshooting

**`ANDROID_HOME` not found during build**
Restart your terminal after setting environment variables. If using VS Code / a terminal launched before setting them, close and reopen.

**`adb: command not found`**
Ensure `%ANDROID_HOME%\platform-tools` is in your `Path` variable and restart terminal.

**APK installs but crashes immediately**
Check Logcat in Android Studio (connect phone, open **Logcat** panel) for the error. Common cause: missing env vars baked into the build — confirm `.env.local` values are correct.

**Login works on desktop but not phone**
Ensure the Supabase URL and anon key in `.env.local` are correct. The same credentials work on both since they're baked in at build time.

**Data doesn't sync in real-time**
Confirm Supabase Realtime is enabled for the `user_data` table: **Supabase dashboard → Database → Replication** → ensure `user_data` is listed under "Source" tables.
