# Mobile Fixes & Nav Avatar Design

> **For agentic workers:** This spec drives a writing-plans + subagent-driven-development workflow.

**Goal:** Fix three mobile issues: content overlapping the status bar, broken economic calendar and market news in production APK builds, and replace the Settings gear with a profile photo avatar that opens a user panel (Settings, Change Photo, Sign Out).

**Active project path:** `D:\3 CLI\New Version\nexus`

---

## Context

Nexus is a Tauri 2 + React 18 + TypeScript + Vite app with desktop (Windows .exe) and Android (.apk) targets. The issues below were discovered after the first Android APK build.

- `AppData` type in `src/types/index.ts`
- `useAppData()` hook in `src/lib/store.ts` returns `{ data, update }`
- `data.userProfile` is optional (`userProfile?: UserProfile`)
- `data.userProfile?.avatarUrl` — base64 data URL of the user's profile photo (already stored by `SettingsModal.tsx`)
- `data.userProfile?.username` — user's display name
- `data.userProfile?.avatarColor` — hex color fallback for initials circle
- `signOut()` exported from `src/lib/supabase.ts`
- `getSession()` exported from `src/lib/supabase.ts`
- `isTauri` detection: `typeof window !== "undefined" && "__TAURI_INTERNALS__" in window`

---

## Change 1: Safe Area Inset Top

**Problem:** On Android the page content renders behind the phone's status bar. The Layout already handles the bottom safe area but not the top.

**Fix:** In `src/components/Layout.tsx`, add `pt-[env(safe-area-inset-top)]` to the `<main>` element.

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

### Step 1: Install npm package

```bash
npm install @tauri-apps/plugin-http
```

### Step 2: Rust/config changes

**`src-tauri/Cargo.toml`** — add dependency with TLS feature (required for Android):
```toml
tauri-plugin-http = { version = "2", features = ["rustls-tls"] }
```

**`src-tauri/src/lib.rs`** — register the plugin alongside existing ones:
```rust
.plugin(tauri_plugin_http::init())
```

**`src-tauri/capabilities/default.json`** — create this file (the `src-tauri/capabilities/` directory does not exist yet and must also be created):
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

### Step 3: Frontend wrapper

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

### Step 4: Update `src/pages/Market.tsx`

Add these two lines at the **top of the file** (with the other imports):
```typescript
import { tauriFetch } from "@/lib/tauriFetch";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
```

**In `ForexFactoryCalendar` component, `load()` function** — replace:
```typescript
const res = await fetch(`/ff-calendar/ff_calendar_${w}week.json`);
```
with:
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

Note: the `Referer` and `User-Agent` headers are required by `nfs.faireconomy.media` — without them the API returns 403. These are the same headers the Vite proxy already forwards (see `vite.config.ts`).

**Replace the `NEWS_SOURCES` constant** (currently at the top of the file) with two separate constants:
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
```

Keep the `NewsSourceId` type pointing at `NEWS_SOURCES_PROXY` (same shape):
```typescript
type NewsSourceId = (typeof NEWS_SOURCES_PROXY)[number]["id"];
```

**In `NewsFeed` component, `load()` function** — replace:
```typescript
const res = await fetch(url);
```
with:
```typescript
const res = await tauriFetch(url);
```

The `url` variable already comes from `NEWS_SOURCES.find(...)` which now resolves to the correct URL for the current environment.

---

## Change 3: Nav Avatar with User Panel

**Problem:** The MobileNav shows a Settings gear above the nav pill. Replace it with a circular profile photo avatar. Tapping opens a panel with: avatar + name + email, Settings, Change Photo, Sign Out.

### What changes in `src/components/MobileNav.tsx`

1. Add `useRef` and `useEffect` to the React import (currently only `{ type ElementType, useMemo, useState }` is imported).
2. Add `Camera` and `LogOut` to the lucide-react imports. Keep `Settings` — it is used in the user panel. (`Camera` is not currently imported in MobileNav.)
3. Add imports: `import { getSession, signOut } from "@/lib/supabase";`
4. Add state:
   ```tsx
   const [panelOpen, setPanelOpen] = useState(false);
   const [userEmail, setUserEmail] = useState<string | null>(null);
   const panelRef = useRef<HTMLDivElement>(null);
   ```
5. On mount, fetch the email once:
   ```tsx
   useEffect(() => {
     getSession().then((s) => setUserEmail(s?.user.email ?? null));
   }, []);
   ```
6. Click-outside handler to dismiss the panel (use `pointerdown` to work on both desktop mouse and Android touch):
   ```tsx
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
7. Add `Avatar` helper component (defined inside the file, before `MobileNav`):
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
8. **Replace the Settings gear button** with an avatar button:
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
9. **Add user panel** (rendered just before `</nav>`, inside the `<nav>` element, after the above-nav row):

   Define the row style constant inside `MobileNav`:
   ```tsx
   const rowStyle: React.CSSProperties = {
     display: "flex", alignItems: "center", gap: 8,
     width: "100%", padding: "7px 6px", borderRadius: 8,
     fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.72)",
     background: "transparent", border: "none", cursor: "pointer",
     textAlign: "left",
   };
   ```

   Panel JSX:
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

   Note: both "Settings" and "Change Photo" open the SettingsModal — the photo upload section is already inside that modal.

10. Keep `SettingsModal`, `NotificationBell`, and `onOpenCommandPalette`/Search unchanged.

---

## Files to Create / Modify

| File | Action |
|------|--------|
| `src/components/Layout.tsx` | Add `pt-[env(safe-area-inset-top)]` to `<main>` |
| `src/lib/tauriFetch.ts` | Create — CORS-bypassing fetch wrapper |
| `src/pages/Market.tsx` | Add `tauriFetch` import + `isTauri` const at top; update both fetch calls; split `NEWS_SOURCES` |
| `src-tauri/Cargo.toml` | Add `tauri-plugin-http = { version = "2", features = ["rustls-tls"] }` |
| `src-tauri/src/lib.rs` | Register `tauri_plugin_http::init()` |
| `src-tauri/capabilities/default.json` | Create directory + file with `http:default` permission |
| `src/components/MobileNav.tsx` | Add `useRef`/`useEffect` to React import; keep `Settings`, add `LogOut`; add avatar button + user panel |

---

## Out of Scope

- Profile photo upload UI changes (already works in SettingsModal)
- Supabase Storage for avatars (base64 in AppData syncs automatically via existing Supabase sync)
- Desktop sidebar avatar
- News source additions or calendar data changes
