# Mobile Fixes & Nav Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three mobile production issues: status bar overlap, broken calendar/news fetches, and replace the Settings gear with a profile photo avatar + user panel.

**Architecture:** Three independent changes to Layout (safe area), Market page (CORS-bypassing fetch via Tauri HTTP plugin), and MobileNav (avatar button replacing Settings gear, floating user panel). The Tauri HTTP plugin is set up in Task 2 and consumed by Market.tsx in Task 3 — Tasks 1 and 4 are fully independent.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, Tauri 2, `@tauri-apps/plugin-http`, lucide-react.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/Layout.tsx` | Modify | Add `pt-[env(safe-area-inset-top)]` to `<main>` |
| `src-tauri/Cargo.toml` | Modify | Add `tauri-plugin-http` dependency with `rustls-tls` feature |
| `src-tauri/src/lib.rs` | Modify | Register `tauri_plugin_http::init()` plugin |
| `src-tauri/capabilities/default.json` | Create (new dir) | Tauri capabilities file granting `http:default` permission |
| `src/lib/tauriFetch.ts` | Create | CORS-bypassing fetch wrapper: Tauri plugin in production, browser fetch in dev |
| `src/pages/Market.tsx` | Modify | Import tauriFetch, add isTauri, update ForexFactory + RSS fetch calls |
| `src/components/MobileNav.tsx` | Modify | Replace Settings gear with avatar button + floating user panel |

---

## Task 1: Safe area inset top

**Files:**
- Modify: `src/components/Layout.tsx:179`

- [ ] **Step 1: Open `src/components/Layout.tsx` and find the `<main>` element**

It is at line 179:
```tsx
<main className="flex-1 overflow-y-auto">
```

- [ ] **Step 2: Add `pt-[env(safe-area-inset-top)]` to the className**

Change it to:
```tsx
<main className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]">
```

- [ ] **Step 3: Type-check**

```bash
cd "D:\3 CLI\New Version\nexus" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Build**

```bash
cd "D:\3 CLI\New Version\nexus" && npm run build
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd "D:\3 CLI\New Version\nexus"
git add src/components/Layout.tsx
git commit -m "fix: add safe-area-inset-top to main layout"
```

---

## Task 2: Tauri HTTP plugin setup + tauriFetch wrapper

This task sets up the plumbing for CORS-bypassing HTTP requests in production builds. It has four parts: npm package, Rust dependency, capabilities file, and the frontend wrapper. Task 3 depends on this task being complete first.

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`
- Create dir: `src-tauri/capabilities/`
- Create: `src-tauri/capabilities/default.json`
- Create: `src/lib/tauriFetch.ts`

- [ ] **Step 1: Install the npm package**

```bash
cd "D:\3 CLI\New Version\nexus" && npm install @tauri-apps/plugin-http
```

Expected: `@tauri-apps/plugin-http` appears in `package.json` dependencies.

- [ ] **Step 2: Add Rust dependency to `src-tauri/Cargo.toml`**

The `[dependencies]` section currently ends with `serde_json = "1"`. Add after it:
```toml
tauri-plugin-http = { version = "2", features = ["rustls-tls"] }
```

The `rustls-tls` feature is required for HTTPS on Android. The full `[dependencies]` section should now be:
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-http = { version = "2", features = ["rustls-tls"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] **Step 3: Register the plugin in `src-tauri/src/lib.rs`**

The current `run()` function builder chain is:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![read_data, save_data, export_data])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

Add `.plugin(tauri_plugin_http::init())` after the existing plugins:
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![read_data, save_data, export_data])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

- [ ] **Step 4: Create the capabilities directory and file**

The `src-tauri/capabilities/` directory does not yet exist. Create it, then create `src-tauri/capabilities/default.json` with this exact content:

```json
{
  "$schema": "../gen/schemas/capabilities.json",
  "identifier": "default",
  "description": "Default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "http:default"
  ]
}
```

- [ ] **Step 5: Create `src/lib/tauriFetch.ts`**

Create this new file with exact content:

```typescript
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Fetches a URL using Tauri's HTTP plugin in production (bypasses CORS),
 * or the browser's native fetch in dev mode (uses Vite proxy).
 */
export async function tauriFetch(url: string, init?: RequestInit): Promise<Response> {
  if (isTauri) {
    const { fetch: tFetch } = await import("@tauri-apps/plugin-http");
    return tFetch(url, init);
  }
  return fetch(url, init);
}
```

- [ ] **Step 6: Type-check**

```bash
cd "D:\3 CLI\New Version\nexus" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Build (desktop only — verifies Rust compiles)**

```bash
cd "D:\3 CLI\New Version\nexus" && npm run build
```

Expected: exit 0. This confirms the Rust side compiles with the new plugin.

- [ ] **Step 8: Commit**

```bash
cd "D:\3 CLI\New Version\nexus"
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs src-tauri/capabilities/default.json src/lib/tauriFetch.ts
git commit -m "feat: add tauri-plugin-http and tauriFetch wrapper"
```

---

## Task 3: Fix economic calendar and market news fetches

Updates `Market.tsx` to use `tauriFetch` and direct URLs in production, falling back to the Vite proxy in dev. **Requires Task 2 to be complete.**

**Files:**
- Modify: `src/pages/Market.tsx`

The key locations in Market.tsx:
- Line 92: `const NEWS_SOURCES = [...]` — replace with proxy/direct split
- Line 97: `type NewsSourceId = (typeof NEWS_SOURCES)[number]["id"]` — update to point at proxy const
- Line 701: `const res = await fetch(...)` in `ForexFactoryCalendar`'s `load()` — replace with tauriFetch + direct URL + headers
- Line 1287: `const res = await fetch(url)` in `NewsFeed`'s `load()` — replace with tauriFetch

- [ ] **Step 1: Add imports and `isTauri` constant at the top of `src/pages/Market.tsx`**

Find the last existing `import` statement (around line 41: `import type { MarketSession } from "@/types";`). Add after it:

```typescript
import { tauriFetch } from "@/lib/tauriFetch";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
```

- [ ] **Step 2: Replace the `NEWS_SOURCES` constant and `NewsSourceId` type**

Find (around lines 92–97):
```typescript
const NEWS_SOURCES = [
  { id: "forexlive", label: "ForexLive", url: "/rss/forexlive" },
  { id: "fxstreet",  label: "FX Street", url: "/rss/fxstreet"  },
] as const;

type NewsSourceId = (typeof NEWS_SOURCES)[number]["id"];
```

Replace with:
```typescript
const NEWS_SOURCES_PROXY = [
  { id: "forexlive", label: "ForexLive", url: "/rss/forexlive" },
  { id: "fxstreet",  label: "FX Street",  url: "/rss/fxstreet"  },
] as const;

const NEWS_SOURCES_DIRECT = [
  { id: "forexlive", label: "ForexLive", url: "https://www.forexlive.com/feed/news" },
  { id: "fxstreet",  label: "FX Street",  url: "https://www.fxstreet.com/rss/news"  },
] as const;

const NEWS_SOURCES = isTauri ? NEWS_SOURCES_DIRECT : NEWS_SOURCES_PROXY;

type NewsSourceId = (typeof NEWS_SOURCES_PROXY)[number]["id"];
```

- [ ] **Step 3: Update the ForexFactory calendar fetch (around line 701)**

Find in `ForexFactoryCalendar`'s `load()` function:
```typescript
const res = await fetch(`/ff-calendar/ff_calendar_${w}week.json`);
```

Replace with:
```typescript
const url = isTauri
  ? `https://nfs.faireconomy.media/ff_calendar_${w}week.json`
  : `/ff-calendar/ff_calendar_${w}week.json`;
const res = await tauriFetch(url, isTauri ? {
  headers: {
    "Referer": "https://www.forexfactory.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
  },
} : undefined);
```

The `Referer` and `User-Agent` headers are required by `nfs.faireconomy.media` — without them the API returns 403.

The line immediately after the fetch checks `res.status === 404` — that check still works unchanged.

- [ ] **Step 4: Update the news feed fetch (around line 1287)**

Find in `NewsFeed`'s `load()` function:
```typescript
const res = await fetch(url);
```

Replace with:
```typescript
const res = await tauriFetch(url);
```

The `url` variable already comes from `NEWS_SOURCES.find(...)` which now resolves to the correct URL for the current environment.

- [ ] **Step 5: Type-check**

```bash
cd "D:\3 CLI\New Version\nexus" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Smoke test in dev mode**

```bash
cd "D:\3 CLI\New Version\nexus" && npm run dev
```

Open `http://localhost:1420`, navigate to Market page. Confirm:
- Economic Calendar loads without errors (shows events)
- Market News loads without errors (shows headlines)

Dev mode uses the Vite proxy path — this confirms the fallback still works.

- [ ] **Step 7: Build**

```bash
cd "D:\3 CLI\New Version\nexus" && npm run build
```

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
cd "D:\3 CLI\New Version\nexus"
git add src/pages/Market.tsx
git commit -m "fix: use tauriFetch for calendar and news to bypass CORS in production"
```

---

## Task 4: MobileNav — avatar button + user panel

Replaces the Settings gear with a circular profile photo avatar. Tapping opens a floating panel showing the user's avatar, name, email, and three actions: Settings, Change Photo, Sign Out.

**This task is independent of Tasks 2 and 3.**

**Files:**
- Modify: `src/components/MobileNav.tsx`

Current MobileNav structure (key parts):
- React imports: `{ type ElementType, useMemo, useState }`
- Lucide imports include `Settings` (keep it — used in the panel)
- State: `settingsOpen`, `setSettingsOpen` already exists
- Above-nav row renders: `<NotificationBell />` + Settings gear button
- `<SettingsModal>` is already rendered at the bottom

- [ ] **Step 1: Update the React import**

Find:
```typescript
import { type ElementType, useMemo, useState } from "react";
```

Replace with:
```typescript
import { type ElementType, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 2: Add `Camera` and `LogOut` to the lucide-react imports**

Find the lucide-react import block. It currently includes `Settings`. Add `Camera` and `LogOut` to the same import:

```typescript
import {
  Briefcase,
  Camera,
  Landmark,
  LayoutGrid,
  Lightbulb,
  LineChart,
  LogOut,
  NotebookPen,
  PieChart,
  Scale,
  Search,
  Settings,
  Wallet,
} from "lucide-react";
```

- [ ] **Step 3: Add supabase imports**

After the existing imports, add:
```typescript
import { getSession, signOut } from "@/lib/supabase";
```

- [ ] **Step 4: Add the `Avatar` helper component**

Add this component definition just before the `export default function MobileNav(...)` line:

```tsx
function Avatar({ avatarUrl, username, avatarColor, size }: {
  avatarUrl?: string;
  username: string;
  avatarColor?: string;
  size: number;
}) {
  const initials = (username.trim() || "T").slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        alt="avatar"
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarColor ?? "#1dd4b4",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "#fff",
    }}>
      {initials}
    </div>
  );
}
```

- [ ] **Step 5: Add state and effects inside `MobileNav`**

Inside the `MobileNav` function body, after the existing state declarations (`settingsOpen`, `items`), add:

```tsx
const [panelOpen, setPanelOpen] = useState(false);
const [userEmail, setUserEmail] = useState<string | null>(null);
const panelRef = useRef<HTMLDivElement>(null);

// Fetch email once on mount
useEffect(() => {
  getSession().then((s) => setUserEmail(s?.user.email ?? null));
}, []);

// Dismiss panel on click/tap outside
useEffect(() => {
  if (!panelOpen) return;
  function handlePointerDown(e: PointerEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setPanelOpen(false);
    }
  }
  document.addEventListener("pointerdown", handlePointerDown);
  return () => document.removeEventListener("pointerdown", handlePointerDown);
}, [panelOpen]);
```

- [ ] **Step 6: Define `rowStyle` inside `MobileNav`**

Add this constant inside the `MobileNav` function body (after the effects):

```tsx
const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  width: "100%", padding: "7px 6px", borderRadius: 8,
  fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.72)",
  background: "transparent", border: "none", cursor: "pointer",
  textAlign: "left",
};
```

- [ ] **Step 7: Replace the Settings gear button with the avatar button**

Find in the JSX the existing Settings gear button:
```tsx
<button
  type="button"
  onClick={() => setSettingsOpen(true)}
  className="w-10 h-10 rounded-2xl flex items-center justify-center"
  style={{
    background: "rgba(13,16,24,0.88)",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 28px rgba(0,0,0,0.32)",
    backdropFilter: "blur(18px)",
    color: "rgba(255,255,255,0.72)",
  }}
  aria-label="Open settings"
>
  <Settings size={16} />
</button>
```

Replace with the avatar button:
```tsx
<button
  type="button"
  onClick={() => setPanelOpen((o) => !o)}
  style={{
    width: 34, height: 34,
    borderRadius: "50%",
    border: "2px solid rgba(99,102,241,0.45)",
    padding: 0, overflow: "hidden",
    background: "transparent", cursor: "pointer",
    boxShadow: panelOpen ? "0 0 0 3px rgba(99,102,241,0.25)" : "none",
    flexShrink: 0,
  }}
  aria-label="Open account panel"
>
  <Avatar
    avatarUrl={data.userProfile?.avatarUrl}
    username={data.userProfile?.username ?? "Trader"}
    avatarColor={data.userProfile?.avatarColor}
    size={30}
  />
</button>
```

- [ ] **Step 8: Add the user panel JSX**

Inside the `<nav>` element, just before the closing `</nav>` tag, add the user panel:

```tsx
{panelOpen && (
  <div
    ref={panelRef}
    style={{
      position: "fixed",
      bottom: "7rem",
      right: "0.75rem",
      width: 210,
      background: "rgba(10,13,24,0.98)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16,
      padding: "12px 10px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
      zIndex: 60,
    }}
  >
    {/* Avatar + name/email */}
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      paddingBottom: 10,
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 6,
    }}>
      <Avatar
        avatarUrl={data.userProfile?.avatarUrl}
        username={data.userProfile?.username ?? "Trader"}
        avatarColor={data.userProfile?.avatarColor}
        size={36}
      />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
          {data.userProfile?.username ?? "Trader"}
        </div>
        {userEmail && (
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
            {userEmail}
          </div>
        )}
      </div>
    </div>

    {/* Settings */}
    <button
      type="button"
      style={rowStyle}
      onClick={() => { setPanelOpen(false); setSettingsOpen(true); }}
    >
      <Settings size={13} /> Settings
    </button>

    {/* Change Photo */}
    <button
      type="button"
      style={rowStyle}
      onClick={() => { setPanelOpen(false); setSettingsOpen(true); }}
    >
      <Camera size={13} /> Change Photo
    </button>

    {/* Sign Out */}
    <button
      type="button"
      style={{ ...rowStyle, color: "#f87171" }}
      onClick={async () => { await signOut(); window.location.reload(); }}
    >
      <LogOut size={13} /> Sign Out
    </button>
  </div>
)}
```

- [ ] **Step 9: Type-check**

```bash
cd "D:\3 CLI\New Version\nexus" && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Build**

```bash
cd "D:\3 CLI\New Version\nexus" && npm run build
```

Expected: exit 0.

- [ ] **Step 11: Smoke test in dev**

```bash
cd "D:\3 CLI\New Version\nexus" && npm run dev
```

On mobile viewport (or DevTools mobile emulation):
1. The Settings gear should be replaced by a circular avatar (initials if no photo set)
2. Tapping the avatar opens the floating panel with name, email, Settings, Change Photo, Sign Out
3. Tapping outside the panel closes it
4. Tapping Settings opens the SettingsModal
5. Tapping Sign Out reloads the page and shows the login screen

- [ ] **Step 12: Commit**

```bash
cd "D:\3 CLI\New Version\nexus"
git add src/components/MobileNav.tsx
git commit -m "feat: replace settings gear with avatar button and user panel in mobile nav"
```
