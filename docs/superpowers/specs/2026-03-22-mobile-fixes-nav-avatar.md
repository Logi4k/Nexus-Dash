# Mobile Fixes & Nav Avatar Design

> **For agentic workers:** This spec drives a writing-plans + subagent-driven-development workflow.

**Goal:** Fix three mobile issues: content overlapping the status bar, broken economic calendar and market news in production APK builds, and replace the Settings gear with a profile photo avatar that opens a user panel.

**Active project path:** `D:\3 CLI\New Version\nexus`

---

## Context

Nexus is a Tauri 2 + React 18 + TypeScript + Vite app with desktop (Windows .exe) and Android (.apk) targets. The issues below were discovered after the first Android APK build.

- `AppData` type in `src/types/index.ts`
- `useAppData()` hook in `src/lib/store.ts` returns `{ data, update }`
- `data.userProfile.avatarUrl` — base64 data URL of the user's profile photo (already stored by `SettingsModal.tsx`)
- `data.userProfile.username` — user's display name (already stored)
- `signOut()` exported from `src/lib/supabase.ts`
- `isTauri` detection: `typeof window !== "undefined" && "__TAURI_INTERNALS__" in window`

---

## Change 1: Safe Area Inset Top

**Problem:** On Android the page content renders behind the phone's status bar. The Layout already handles the bottom safe area but not the top.

**Fix:** In `src/components/Layout.tsx`, add `pt-[env(safe-area-inset-top)]` to the `<main>` element so content is pushed below the status bar.

Current `<main>` className:
```
"flex-1 overflow-y-auto"
```

New `<main>` className:
```
"flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]"
```

No other changes needed.

---

## Change 2: Fix Economic Calendar & Market News in Production

**Problem:** The economic calendar (`/ff-calendar/...`) and market news RSS feeds (`/rss/forexlive`, `/rss/fxstreet`) are fetched via Vite dev-server proxy routes. These proxies only exist during `npm run dev` — in the production APK (and desktop .exe build), those paths return 404 and the components show errors.

**Fix:** Add `tauri-plugin-http` which routes HTTP requests through Rust's `reqwest`, bypassing CORS entirely. A thin frontend wrapper detects whether we're in a Tauri context and uses the plugin's fetch; in dev mode it falls back to the browser's native fetch (which goes through the Vite proxy as before).

### Rust/config changes

**`src-tauri/Cargo.toml`** — add dependency:
```toml
tauri-plugin-http = "2"
```

**`src-tauri/src/lib.rs`** — register the plugin:
```rust
.plugin(tauri_plugin_http::init())
```
(alongside the existing `tauri_plugin_fs::init()` and `tauri_plugin_shell::init()`)

**`src-tauri/capabilities/default.json`** — create this file with HTTP permissions:
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

### Frontend wrapper

**`src/lib/tauriFetch.ts`** (new file):
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

**`src/pages/Market.tsx`** — replace the two `fetch()` calls:

1. In `ForexFactoryCalendar` component, `load()` function — replace:
   ```typescript
   const res = await fetch(`/ff-calendar/ff_calendar_${w}week.json`);
   ```
   with:
   ```typescript
   import { tauriFetch } from "@/lib/tauriFetch";
   // ...
   const url = isTauri
     ? `https://nfs.faireconomy.media/ff_calendar_${w}week.json`
     : `/ff-calendar/ff_calendar_${w}week.json`;
   const res = await tauriFetch(url);
   ```

2. In `NewsFeed` component, `load()` function — replace:
   ```typescript
   const res = await fetch(url);
   ```
   with:
   ```typescript
   import { tauriFetch } from "@/lib/tauriFetch";
   // ...
   const NEWS_SOURCES_DIRECT = [
     { id: "forexlive", label: "ForexLive", url: "https://www.forexlive.com/feed/news" },
     { id: "fxstreet",  label: "FX Street",  url: "https://www.fxstreet.com/rss/news"  },
   ] as const;
   const NEWS_SOURCES_PROXY = [
     { id: "forexlive", label: "ForexLive", url: "/rss/forexlive" },
     { id: "fxstreet",  label: "FX Street",  url: "/rss/fxstreet"  },
   ] as const;
   // In load():
   const sources = isTauri ? NEWS_SOURCES_DIRECT : NEWS_SOURCES_PROXY;
   const { url } = sources.find((s) => s.id === src)!;
   const res = await tauriFetch(url);
   ```

The `isTauri` variable is already declared at module level in `Market.tsx` (imported from utils or re-declared). Check and reuse if already present; add `const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;` at the top of Market.tsx if not.

Also run `npm install @tauri-apps/plugin-http`.

---

## Change 3: Nav Avatar with User Panel

**Problem:** The MobileNav shows a Settings gear above the nav pill. The user wants a circular profile photo avatar instead, with a panel that includes Settings access, Sign Out, and "Change Photo".

### What changes

**`src/components/MobileNav.tsx`:**

1. Remove the `Settings` icon import from lucide-react (and `SettingsModal` import if it moves — see below).
2. Import `getSession` from `@/lib/supabase` and `signOut` from `@/lib/supabase`.
3. Add state: `panelOpen: boolean` (controls user panel visibility).
4. Add state: `userEmail: string | null` — populated once on mount via `getSession().then(s => setUserEmail(s?.user.email ?? null))`.
5. Replace the Settings gear button with a circular avatar button:
   - If `data.userProfile.avatarUrl` is set: render `<img src={avatarUrl} />` in a circle
   - Otherwise: show a circle with initials from `data.userProfile.username` (first 2 chars, uppercase) using `data.userProfile.avatarColor` as background
   - Circle is 32×32, `border-radius: 50%`, indigo ring border
   - `onClick`: toggle `panelOpen`
6. When `panelOpen` is true, render a floating panel anchored above the avatar button:
   - Avatar (same as button, but 40×40)
   - Display name (`data.userProfile.username`)
   - Email (`userEmail`)
   - Divider
   - "Settings" row — opens `SettingsModal`, closes panel
   - "Sign Out" row — calls `signOut()` then `window.location.reload()`
   - Panel dismisses on tap outside (click outside handler on `document`)
7. Keep `SettingsModal` rendered in MobileNav (already there) and `NotificationBell`.
8. The `onOpenCommandPalette` prop and Search button remain unchanged.

### Avatar rendering helper (inline in MobileNav.tsx)

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

### User panel JSX

```tsx
{panelOpen && (
  <div
    ref={panelRef}
    style={{
      position: "fixed",
      bottom: /* height of nav + some offset */ "6rem",
      right: "0.75rem",
      width: 200,
      background: "rgba(10,13,24,0.98)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 16,
      padding: "12px 10px",
      boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
      zIndex: 60,
    }}
  >
    {/* Avatar + name/email */}
    <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 }}>
      <Avatar avatarUrl={data.userProfile?.avatarUrl} username={data.userProfile?.username ?? "Trader"} avatarColor={data.userProfile?.avatarColor} size={36} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{data.userProfile?.username ?? "Trader"}</div>
        {userEmail && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{userEmail}</div>}
      </div>
    </div>
    {/* Settings */}
    <button onClick={() => { setPanelOpen(false); setSettingsOpen(true); }} style={rowStyle}>
      <Settings size={13} /> Settings
    </button>
    {/* Sign Out */}
    <button onClick={async () => { await signOut(); window.location.reload(); }} style={{ ...rowStyle, color: "#f87171" }}>
      <LogOut size={13} /> Sign Out
    </button>
  </div>
)}
```

Where `rowStyle` is:
```tsx
const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  width: "100%", padding: "7px 6px", borderRadius: 8,
  fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.72)",
  background: "transparent", border: "none", cursor: "pointer",
  textAlign: "left",
};
```

Add `LogOut` to lucide-react imports (alongside existing imports).

### Click-outside behaviour

```tsx
const panelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!panelOpen) return;
  function handleClick(e: MouseEvent) {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      setPanelOpen(false);
    }
  }
  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
}, [panelOpen]);
```

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/components/Layout.tsx` | Add `pt-[env(safe-area-inset-top)]` to `<main>` |
| `src/lib/tauriFetch.ts` | Create — CORS-bypassing fetch wrapper |
| `src/pages/Market.tsx` | Use `tauriFetch` + direct URLs for production |
| `src-tauri/Cargo.toml` | Add `tauri-plugin-http = "2"` |
| `src-tauri/src/lib.rs` | Register `tauri_plugin_http::init()` |
| `src-tauri/capabilities/default.json` | Create with `http:default` permission |
| `src/components/MobileNav.tsx` | Replace Settings gear with avatar + user panel |

---

## Out of Scope

- Profile photo upload flow changes (already works in SettingsModal)
- Supabase Storage for avatars (base64 in AppData is sufficient; syncs automatically)
- Desktop sidebar changes (avatar only appears in mobile nav)
- News source additions or calendar data changes
