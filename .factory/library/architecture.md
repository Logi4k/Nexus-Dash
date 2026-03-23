# Architecture

**What belongs here:** Architectural decisions, patterns discovered, key abstractions.

---

## Data Architecture
- Single JSONB blob per user in Supabase `user_data` table
- All app state stored in `AppData` type (src/types/index.ts)
- Offline-first: localStorage (primary) → Tauri file (fallback) → Supabase cloud (sync)
- Supabase Realtime for cross-device live updates

## State Management
- Singleton store using `useSyncExternalStore` (src/lib/store.ts)
- `useAppData()` hook returns `{ data, update }` 
- `update((prev) => ({ ...prev, ...changes }))` pattern for mutations
- `saveData()` handles local + cloud sync automatically

## Theme System
- CSS custom properties defined in index.css
- Two themes: dark (default), bw (black and white)
- Theme toggled via `data-theme` attribute or `theme-bw` class on `<html>`
- Per-page accent colors defined in src/lib/theme.ts (PAGE_THEMES)
- Tailwind config maps CSS variables to utility classes

## Component Patterns
- Pages in src/pages/ (9 pages)
- Shared components in src/components/
- Modals use src/components/Modal.tsx wrapper
- Layout with sidebar (desktop) + bottom nav (mobile) in src/components/Layout.tsx

## Image Storage
- Trade images: IndexedDB (local cache) + Supabase Storage (cloud sync)
- Avatar: Supabase Storage (public bucket)
- Both handled via src/lib/imageStore.ts and src/lib/avatarStorage.ts
