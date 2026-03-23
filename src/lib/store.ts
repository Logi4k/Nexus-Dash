import { useSyncExternalStore, useCallback } from "react";
import type { AppData } from "@/types";
import seedData from "@/data/data.json";
import { supabase, getSession } from "@/lib/supabase";

// ── Supabase sync state ──────────────────────────────────────────────────────
let _syncedAt: number | null = null;       // ms-since-epoch of last confirmed sync
let _currentUserId: string | null = null;  // set after successful auth
let _realtimeSubscribed = false;           // guard: Realtime channel created at most once
let _authSubscription: { unsubscribe: () => void } | null = null;
let _reconnectHandlersSetup = false;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const STORAGE_KEY = "nexus_data";
const SAVED_AT_KEY = "nexus_savedAt";

// ── Environment detection ────────────────────────────────────────────────────
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// ── Tauri invoke helpers ─────────────────────────────────────────────────────
async function tauriLoad(): Promise<AppData | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const raw = await invoke<string>("read_data");
    if (!raw || raw === "{}") return null;
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
}

async function tauriSave(data: AppData): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("save_data", { data: JSON.stringify(data) });
  } catch {
    // fall through to localStorage backup
  }
}

// ── localStorage helpers (browser fallback) ──────────────────────────────────
function localLoad(): AppData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as AppData;
  } catch {
    // ignore
  }
  return null;
}

function localSave(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(SAVED_AT_KEY, Date.now().toString());
  } catch {
    // storage full or unavailable
  }
}

function localSavedAt(): number {
  try {
    const ts = localStorage.getItem(SAVED_AT_KEY);
    return ts ? parseInt(ts, 10) : 0;
  } catch {
    return 0;
  }
}

// ── Merge helper: user data wins, seed fills missing keys ────────────────────
function mergeWithSeed(parsed: Partial<AppData>): AppData {
  return { ...(seedData as unknown as AppData), ...parsed };
}

// ── Singleton store ──────────────────────────────────────────────────────────
// Initialise synchronously from localStorage so the UI renders immediately.
// Capture whether localStorage had data so we know if Tauri file is needed.
const _localDataOnInit = localLoad();
let currentData: AppData = _localDataOnInit
  ? mergeWithSeed(_localDataOnInit)
  : (seedData as unknown as AppData);

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
}

// Restore device-local avatarUrl after a cloud merge (it's never synced).
function withLocalAvatar(data: AppData, localAvatarUrl: string | undefined): AppData {
  if (!localAvatarUrl || !data.userProfile || data.userProfile.avatarUrl) return data;
  return {
    ...data,
    userProfile: { ...data.userProfile, avatarUrl: localAvatarUrl },
  };
}

// Strip large device-local fields before syncing to cloud.
// Base64 Data URLs can be several MB — they would exceed Supabase Realtime's
// message size limit and cause the payload to arrive as null, wiping the store.
// Regular URLs (from Supabase Storage) are small and safe to sync.
function cloudPayload(data: AppData): AppData {
  if (!data.userProfile?.avatarUrl || !data.userProfile.avatarUrl.startsWith("data:")) return data;
  return {
    ...data,
    userProfile: { ...data.userProfile, avatarUrl: undefined },
  };
}

export function saveData(data: AppData): void {
  currentData = data;
  localSave(data);
  if (isTauri) {
    tauriSave(data);
  }
  notify();
  // ── Supabase sync (fire and forget) ────────────────────────────────────────
  if (_currentUserId) {
    void Promise.resolve(
      supabase
        .from("user_data")
        .upsert({ user_id: _currentUserId, payload: cloudPayload(data) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
        .select("updated_at")
        .single()
    ).then(({ data: row, error }) => {
      if (!error && row?.updated_at) {
        _syncedAt = new Date(row.updated_at as string).getTime();
      } else if (error) {
        console.error("[store] Supabase upsert failed:", error.message, error.code);
      }
    }).catch((err: unknown) => {
      console.error("[store] Supabase upsert threw:", err);
    });
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): AppData {
  return currentData;
}

// ── Async boot: seed from Tauri file store if localStorage is empty ──────────
// localStorage writes are synchronous (always up-to-date), Tauri writes are
// fire-and-forget async. We only fall back to the Tauri file when localStorage
// had nothing — never let a potentially-stale Tauri file overwrite it.
if (isTauri) {
  tauriLoad().then((fileData) => {
    if (fileData && !_localDataOnInit) {
      currentData = mergeWithSeed(fileData);
      localSave(currentData);
      notify();
    }
  });
}

// ── Auth state listener ──────────────────────────────────────────────────────
function setupAuthListener(): void {
  if (_authSubscription) return;

  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "TOKEN_REFRESHED" && session) {
      // Token refreshed — Realtime should auto-reconnect with new token
      // but re-init sync to be safe
      console.log("[store] Token refreshed, re-syncing");
    } else if (event === "SIGNED_OUT") {
      _currentUserId = null;
      _realtimeSubscribed = false;
      _syncedAt = null;
      // Unsubscribe from Realtime
      supabase.removeAllChannels();
      console.log("[store] Signed out, sync disabled");
    }
  });

  _authSubscription = data.subscription;
}

// ── Reconnection handlers ────────────────────────────────────────────────────
function setupReconnectionHandlers(): void {
  if (_reconnectHandlersSetup) return;
  _reconnectHandlersSetup = true;

  // Handle app coming back to foreground
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && _currentUserId) {
      // Debounce to avoid rapid reconnections
      if (_reconnectTimer) clearTimeout(_reconnectTimer);
      _reconnectTimer = setTimeout(async () => {
        console.log("[store] App visible, re-syncing");
        await forcePullFromCloud();
      }, 500);
    }
  });

  // Handle network coming back online
  window.addEventListener("online", () => {
    if (_currentUserId) {
      console.log("[store] Back online, re-syncing");
      // Push any local changes that happened while offline, then pull
      void forcePushToCloud().then(() => forcePullFromCloud());
    }
  });
}

// ── Supabase sync initialisation ─────────────────────────────────────────────
export async function initSupabaseSync(): Promise<void> {
  setupAuthListener();
  setupReconnectionHandlers();

  const session = await getSession();
  if (!session) {
    console.warn("[store] initSupabaseSync: no session, skipping sync");
    return;
  }
  console.log("[store] initSupabaseSync: user", session.user.id);

  _currentUserId = session.user.id;

  // ── Fetch latest row from Supabase ─────────────────────────────────────────
  try {
    const { data: row } = await supabase
      .from("user_data")
      .select("payload, updated_at")
      .eq("user_id", _currentUserId)
      .single();

    if (row) {
      const cloudTs = new Date(row.updated_at as string).getTime();
      const localTs = localSavedAt();
      const localAvatarUrl = currentData.userProfile?.avatarUrl;

      if (localTs > cloudTs) {
        // Local is newer — push local to cloud, keep local data
        const { data: pushRow } = await supabase
          .from("user_data")
          .upsert({ user_id: _currentUserId, payload: cloudPayload(currentData) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
          .select("updated_at")
          .single();
        _syncedAt = pushRow?.updated_at ? new Date(pushRow.updated_at as string).getTime() : cloudTs;
      } else {
        // Cloud is newer or same — apply cloud data
        currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
        localSave(currentData);
        notify();
        _syncedAt = cloudTs;
      }
    } else {
      // No row yet — push local data to create the initial cloud record
      const { data: newRow, error } = await supabase
        .from("user_data")
        .upsert({ user_id: _currentUserId, payload: cloudPayload(currentData) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
        .select("updated_at")
        .single();
      if (!error && newRow?.updated_at) {
        _syncedAt = new Date(newRow.updated_at as string).getTime();
      }
    }
  } catch (err) {
    console.error("[store] initSupabaseSync fetch error:", err);
    // Offline or network error — proceed with local data
    _syncedAt = 0;
  }

  // ── Subscribe to Realtime ──────────────────────────────────────────────────
  if (!_realtimeSubscribed) {
    _realtimeSubscribed = true;
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
          const newRow = payload.new as { payload: Partial<AppData> | null; updated_at: string };
          // Guard: Supabase Realtime sends null payload when the row exceeds
          // the WebSocket message size limit. Skip rather than wipe local data.
          if (!newRow?.updated_at || !newRow.payload) return;
          const incomingTs = new Date(newRow.updated_at).getTime();
          if (incomingTs > (_syncedAt ?? 0)) {
            // Preserve local avatarUrl — it's a device-local base64 blob, not synced.
            const localAvatarUrl = currentData.userProfile?.avatarUrl;
            currentData = withLocalAvatar(mergeWithSeed(newRow.payload), localAvatarUrl);
            localSave(currentData);
            _syncedAt = incomingTs;
            notify();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("[store] Realtime connected");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[store] Realtime channel error:", err);
          _realtimeSubscribed = false;
        } else if (status === "TIMED_OUT") {
          console.warn("[store] Realtime subscription timed out, will retry");
          _realtimeSubscribed = false;
        } else if (status === "CLOSED") {
          console.warn("[store] Realtime channel closed");
          _realtimeSubscribed = false;
        }
      });
  }
}

// ── Force sync helpers ────────────────────────────────────────────────────────
export async function forcePullFromCloud(): Promise<boolean> {
  if (!_currentUserId) return false;
  try {
    const { data: row } = await supabase
      .from("user_data")
      .select("payload, updated_at")
      .eq("user_id", _currentUserId)
      .single();
    if (row?.payload) {
      const localAvatarUrl = currentData.userProfile?.avatarUrl;
      currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
      localSave(currentData);
      _syncedAt = new Date(row.updated_at as string).getTime();
      notify();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function forcePushToCloud(): Promise<boolean> {
  if (!_currentUserId) return false;
  try {
    const { data: pushRow, error } = await supabase
      .from("user_data")
      .upsert({ user_id: _currentUserId, payload: cloudPayload(currentData) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
      .select("updated_at")
      .single();
    if (!error && pushRow?.updated_at) {
      _syncedAt = new Date(pushRow.updated_at as string).getTime();
      return true;
    }
    if (error) {
      console.error("[store] forcePushToCloud error:", error.message, error.code);
    }
    return false;
  } catch {
    return false;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAppData() {
  const data = useSyncExternalStore(subscribe, getSnapshot);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    saveData(updater(currentData));
  }, []);

  return { data, update };
}

export function loadData(): AppData {
  return currentData;
}
