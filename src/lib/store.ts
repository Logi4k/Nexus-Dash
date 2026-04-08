// Set DEBUG=true to see internal sync state in the console. Disable before shipping.
const DEBUG = false;
const log = (...args: unknown[]) => { if (DEBUG) console.log("[store]", ...args); };

import { useSyncExternalStore, useCallback } from "react";
import type { AppData } from "@/types";
import seedData from "@/data/data.json";
import { supabase, getSession } from "@/lib/supabase";
import { hydrateTradePhases } from "@/lib/tradePhases";
import { getT212ApiKey, migrateLegacyT212ApiKey, stripLegacyT212ApiKey } from "@/lib/deviceSettings";

// ── Supabase sync state ──────────────────────────────────────────────────────
let _syncedAt: number | null = null;       // ms-since-epoch of last confirmed sync
let _currentUserId: string | null = null;  // set after successful auth
let _realtimeSubscribed = false;           // guard: Realtime channel created at most once
let _authSubscription: { unsubscribe: () => void } | null = null;
let _reconnectHandlersSetup = false;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let _syncOpCount = 0;
let _lastSyncError: string | null = null;
let _realtimeState: "idle" | "connecting" | "connected" | "error" = "idle";

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

function localSave(data: AppData, savedAt = Date.now()): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(SAVED_AT_KEY, savedAt.toString());
    _lastLocalSaveAt = savedAt;
    notifySync();
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

let _lastLocalSaveAt: number | null = localSavedAt() || null;

// ── Merge helper: user data wins, seed fills missing keys ────────────────────
function mergeWithSeed(parsed: Partial<AppData>): AppData {
  let migrated = migrateLegacyT212ApiKey(parsed as AppData);

  // Migrate Expense amounts from string to number
  migrated.expenses = (migrated.expenses ?? []).map((e) => ({
    ...e,
    amount: typeof e.amount === "string" ? parseFloat(e.amount) || 0 : e.amount,
  }));
  migrated.genExpenses = (migrated.genExpenses ?? []).map((e) => ({
    ...e,
    amount: typeof e.amount === "string" ? parseFloat(e.amount) || 0 : e.amount,
  }));

  // Migrate Account statuses to lowercase (remove uppercase variants)
  const NORMALIZED_STATUS: Record<string, string> = {
    Funded: "funded", Challenge: "challenge", Breached: "breached",
  };
  migrated.accounts = (migrated.accounts ?? []).map((acc: AppData["accounts"][number]) => ({
    ...acc,
    status: (NORMALIZED_STATUS[acc.status as string] ?? acc.status) as AppData["accounts"][number]["status"],
  }));

  // If no T212 API key is configured, zero out any stale cached portfolio data
  if (!getT212ApiKey()) {
    migrated.t212 = {
      last_sync: 0,
      free_cash: 0,
      total_value: 0,
      invested: 0,
      ppl: 0,
      result: 0,
    };
    migrated.investments = (migrated.investments ?? []).filter(
      (inv) => !inv.id.startsWith("t212_")
    );
  }

  const merged = { ...(seedData as unknown as AppData), ...migrated };
  return hydrateTradePhases(merged).data;
}

// ── Singleton store ──────────────────────────────────────────────────────────
// Initialise synchronously from localStorage so the UI renders immediately.
// Capture whether localStorage had data so we know if Tauri file is needed.
// For Tauri with no localStorage, leave currentData as null until tauriLoad resolves.
const _localDataOnInit = localLoad();
let currentData: AppData | null = _localDataOnInit
  ? mergeWithSeed(_localDataOnInit)
  : (isTauri ? null : (seedData as unknown as AppData));

// Hydration guard: prevents flash of seed/demo data on fresh Tauri installs.
// False until Tauri file store has been loaded when no localStorage existed.
let _hydrated = !!_localDataOnInit || !isTauri;

const listeners = new Set<() => void>();
const syncListeners = new Set<() => void>();

function buildSyncStatusSnapshot(): SyncStatusSnapshot {
  return {
    enabled: !!_currentUserId,
    userId: _currentUserId,
    localSavedAt: _lastLocalSaveAt,
    syncedAt: _syncedAt,
    syncInFlight: _syncOpCount > 0,
    realtimeState: _realtimeState,
    lastError: _lastSyncError,
  };
}

let syncSnapshot: SyncStatusSnapshot = buildSyncStatusSnapshot();

function notify(): void {
  listeners.forEach((fn) => fn());
}

function notifySync(): void {
  const next = buildSyncStatusSnapshot();
  const changed =
    syncSnapshot.enabled !== next.enabled ||
    syncSnapshot.userId !== next.userId ||
    syncSnapshot.localSavedAt !== next.localSavedAt ||
    syncSnapshot.syncedAt !== next.syncedAt ||
    syncSnapshot.syncInFlight !== next.syncInFlight ||
    syncSnapshot.realtimeState !== next.realtimeState ||
    syncSnapshot.lastError !== next.lastError;

  if (!changed) return;
  syncSnapshot = next;
  syncListeners.forEach((fn) => fn());
}

function beginSyncOp(): void {
  _syncOpCount += 1;
  notifySync();
}

function endSyncOp(): void {
  _syncOpCount = Math.max(0, _syncOpCount - 1);
  notifySync();
}

function setSyncError(error: string | null): void {
  if (_lastSyncError === error) return;
  _lastSyncError = error;
  notifySync();
}

function setSyncedAt(timestamp: number | null): void {
  if (_syncedAt === timestamp) return;
  _syncedAt = timestamp;
  notifySync();
}

function setCurrentUserId(userId: string | null): void {
  if (_currentUserId === userId) return;
  _currentUserId = userId;
  notifySync();
}

function setRealtimeState(state: "idle" | "connecting" | "connected" | "error"): void {
  if (_realtimeState === state) return;
  _realtimeState = state;
  notifySync();
}

function isLocalAvatarDataUrl(avatarUrl: string | undefined): boolean {
  return !!avatarUrl?.startsWith("data:");
}

// Restore a device-local draft avatar after a cloud merge.
// Remote avatar URLs should not be restored here, otherwise a cloud-side delete
// would be overwritten by a stale local copy.
function withLocalAvatar(data: AppData, localAvatarUrl: string | undefined): AppData {
  const userProfile = data.userProfile;
  if (!isLocalAvatarDataUrl(localAvatarUrl) || !userProfile || userProfile.avatarUrl) return data;
  return {
    ...data,
    userProfile: { ...userProfile, avatarUrl: localAvatarUrl },
  };
}

// Strip large device-local fields before syncing to cloud.
// Base64 Data URLs can be several MB — they would exceed Supabase Realtime's
// message size limit and cause the payload to arrive as null, wiping the store.
// Regular URLs (from Supabase Storage) are small and safe to sync.
function cloudPayload(data: AppData): AppData {
  const sanitized = stripLegacyT212ApiKey(data);
  const userProfile = sanitized.userProfile;

  if (!userProfile || !isLocalAvatarDataUrl(userProfile.avatarUrl)) return sanitized;

  return {
    ...sanitized,
    userProfile: { ...userProfile, avatarUrl: undefined },
  };
}

export function saveData(data: AppData): void {
  const normalized = hydrateTradePhases(data).data;
  currentData = normalized;
  localSave(normalized);
  if (isTauri) {
    tauriSave(normalized);
  }
  notify();
  // ── Supabase sync (fire and forget) ────────────────────────────────────────
  if (_currentUserId) {
    beginSyncOp();
    setSyncError(null);
    void Promise.resolve(
      supabase
        .from("user_data")
        .upsert({ user_id: _currentUserId, payload: cloudPayload(normalized) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
        .select("updated_at")
        .single()
    ).then(({ data: row, error }) => {
      if (!error && row?.updated_at) {
        setSyncedAt(new Date(row.updated_at as string).getTime());
      } else if (error) {
        console.error("[store] Supabase upsert failed:", error.message, error.code);
        setSyncError(error.message);
      }
    }).catch((err: unknown) => {
      console.error("[store] Supabase sync failed");
      setSyncError(err instanceof Error ? err.message : "Cloud sync failed");
    }).finally(() => {
      endSyncOp();
    });
  }
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function subscribeSync(callback: () => void): () => void {
  syncListeners.add(callback);
  return () => syncListeners.delete(callback);
}

function getSnapshot(): AppData | null {
  return currentData;
}

export interface SyncStatusSnapshot {
  enabled: boolean;
  userId: string | null;
  localSavedAt: number | null;
  syncedAt: number | null;
  syncInFlight: boolean;
  realtimeState: "idle" | "connecting" | "connected" | "error";
  lastError: string | null;
}

function getSyncStatusSnapshot(): SyncStatusSnapshot {
  return syncSnapshot;
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
      _hydrated = true;
      notify();
    } else if (!fileData && !_localDataOnInit) {
      // No Tauri file either — fall back to seed data
      currentData = seedData as unknown as AppData;
      _hydrated = true;
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
      log("Token refreshed, re-syncing");
    } else if (event === "SIGNED_OUT") {
      setCurrentUserId(null);
      _realtimeSubscribed = false;
      setSyncedAt(null);
      setSyncError(null);
      setRealtimeState("idle");
      // Unsubscribe from Realtime
      supabase.removeAllChannels();
      log("Signed out, sync disabled");
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
        log("App visible, re-syncing");
        await forcePullFromCloud();
      }, 500);
    }
  });

  // Handle network coming back online
  window.addEventListener("online", () => {
    if (_currentUserId) {
      log("Back online, re-syncing");
      // Reconcile by freshness instead of blindly pushing first.
      void syncNow();
    }
  });
}

// ── Supabase sync initialisation ─────────────────────────────────────────────
export async function initSupabaseSync(): Promise<void> {
  setupAuthListener();
  setupReconnectionHandlers();

  beginSyncOp();
  setSyncError(null);

  const session = await getSession();
  if (!session) {
    console.warn("[store] initSupabaseSync: no session, skipping sync");
    endSyncOp();
    return;
  }
  log("initSupabaseSync: user", session.user.id);

  setCurrentUserId(session.user.id);

  // ── Fetch latest row from Supabase ─────────────────────────────────────────
  try {
    const { data: row } = await supabase
      .from("user_data")
      .select("payload, updated_at")
      .eq("user_id", _currentUserId)
      .single();

    if (!currentData) return;
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
        setSyncedAt(pushRow?.updated_at ? new Date(pushRow.updated_at as string).getTime() : cloudTs);
      } else {
        // Cloud is newer or same — apply cloud data
        currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
        localSave(currentData, cloudTs);
        notify();
        setSyncedAt(cloudTs);
      }
    } else {
      // No row yet — push local data to create the initial cloud record
      const { data: newRow, error } = await supabase
        .from("user_data")
        .upsert({ user_id: _currentUserId, payload: cloudPayload(currentData) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
        .select("updated_at")
        .single();
      if (!error && newRow?.updated_at) {
        setSyncedAt(new Date(newRow.updated_at as string).getTime());
      } else if (error) {
        setSyncError(error.message);
      }
    }
  } catch (err) {
    console.error("[store] initSupabaseSync fetch error:", err);
    // Offline or network error — proceed with local data
    setSyncedAt(0);
    setSyncError(err instanceof Error ? err.message : "Initial sync failed");
  } finally {
    endSyncOp();
  }

  // ── Subscribe to Realtime ──────────────────────────────────────────────────
  if (!_realtimeSubscribed) {
    _realtimeSubscribed = true;
    setRealtimeState("connecting");
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
            if (!currentData) return;
            // Preserve local avatarUrl — it's a device-local base64 blob, not synced.
            const localAvatarUrl = currentData.userProfile?.avatarUrl;
            currentData = withLocalAvatar(mergeWithSeed(newRow.payload), localAvatarUrl);
            localSave(currentData, incomingTs);
            setSyncedAt(incomingTs);
            notify();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          log("Realtime connected");
          setRealtimeState("connected");
          setSyncError(null);
        } else if (status === "CHANNEL_ERROR") {
          console.error("[store] Realtime channel error:", err);
          _realtimeSubscribed = false;
          setRealtimeState("error");
          setSyncError(err?.message ?? "Realtime channel error");
        } else if (status === "TIMED_OUT") {
          console.warn("[store] Realtime subscription timed out, will retry");
          _realtimeSubscribed = false;
          setRealtimeState("error");
          setSyncError("Realtime subscription timed out");
        } else if (status === "CLOSED") {
          console.warn("[store] Realtime channel closed");
          _realtimeSubscribed = false;
          setRealtimeState("idle");
        }
      });
  }
}

// ── Force sync helpers ────────────────────────────────────────────────────────
export async function forcePullFromCloud(): Promise<boolean> {
  if (!_currentUserId) return false;
  beginSyncOp();
  setSyncError(null);
  try {
    const { data: row } = await supabase
      .from("user_data")
      .select("payload, updated_at")
      .eq("user_id", _currentUserId)
      .single();
    if (!currentData) return false;
    if (row?.payload) {
      const localAvatarUrl = currentData.userProfile?.avatarUrl;
      const cloudTs = new Date(row.updated_at as string).getTime();
      currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
      localSave(currentData, cloudTs);
      setSyncedAt(cloudTs);
      notify();
      return true;
    }
    return false;
  } catch (err) {
    setSyncError(err instanceof Error ? err.message : "Pull from cloud failed");
    return false;
  } finally {
    endSyncOp();
  }
}

export async function forcePushToCloud(): Promise<boolean> {
  if (!_currentUserId) return false;
  if (!currentData) return false;
  beginSyncOp();
  setSyncError(null);
  try {
    const { data: pushRow, error } = await supabase
      .from("user_data")
      .upsert({ user_id: _currentUserId, payload: cloudPayload(currentData) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
      .select("updated_at")
      .single();
    if (!error && pushRow?.updated_at) {
      setSyncedAt(new Date(pushRow.updated_at as string).getTime());
      return true;
    }
    if (error) {
      console.error("[store] forcePushToCloud error:", error.message, error.code);
      setSyncError(error.message);
    }
    return false;
  } catch (err) {
    setSyncError(err instanceof Error ? err.message : "Push to cloud failed");
    return false;
  } finally {
    endSyncOp();
  }
}

export async function syncNow(): Promise<boolean> {
  if (!_currentUserId) return false;

  beginSyncOp();
  setSyncError(null);

  try {
    const { data: row, error } = await supabase
      .from("user_data")
      .select("payload, updated_at")
      .eq("user_id", _currentUserId)
      .maybeSingle();

    if (error) {
      console.error("[store] syncNow preflight fetch failed:", error.message, error.code);
      setSyncError(error.message);
      return false;
    }

    const localTs = localSavedAt();
    const cloudTs = row?.updated_at ? new Date(row.updated_at as string).getTime() : null;

    // Prefer the newest side. This avoids stale local app state overwriting a
    // corrected cloud row before the pull happens.
    if (row?.payload && cloudTs !== null && cloudTs >= localTs) {
      if (!currentData) return false;
      const localAvatarUrl = currentData.userProfile?.avatarUrl;
      currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
      localSave(currentData, cloudTs);
      setSyncedAt(cloudTs);
      notify();
      return true;
    }

    if (!currentData) return false;
    const { data: pushRow, error: pushError } = await supabase
      .from("user_data")
      .upsert(
        {
          user_id: _currentUserId,
          payload: cloudPayload(currentData) as unknown as Record<string, unknown>,
        },
        { onConflict: "user_id" },
      )
      .select("updated_at")
      .single();

    if (!pushError && pushRow?.updated_at) {
      setSyncedAt(new Date(pushRow.updated_at as string).getTime());
      return true;
    }

    if (pushError) {
      console.error("[store] syncNow push failed:", pushError.message, pushError.code);
      setSyncError(pushError.message);
    }

    return false;
  } catch (err) {
    setSyncError(err instanceof Error ? err.message : "Sync failed");
    return false;
  } finally {
    endSyncOp();
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAppData() {
  const data = useSyncExternalStore(subscribe, getSnapshot);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    if (!currentData) return;
    saveData(updater(currentData));
  }, []);

  return { data, update };
}

export function loadData(): AppData | null {
  return currentData;
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncStatusSnapshot);
}
