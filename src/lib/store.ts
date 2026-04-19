// Debug logging is gated by Vite's DEV flag. Set VITE_DEBUG_STORE=true in a
// local .env to opt-in when running production-like builds locally.
const DEBUG =
  (import.meta as unknown as { env?: { DEV?: boolean; VITE_DEBUG_STORE?: string } })
    .env?.DEV === true ||
  (import.meta as unknown as { env?: { VITE_DEBUG_STORE?: string } })
    .env?.VITE_DEBUG_STORE === "true";
const log = (...args: unknown[]) => { if (DEBUG) console.log("[store]", ...args); };

// Gate all Supabase cloud operations. When false, all data stays local (LocalStorage/Tauri file only).
const SYNC_ENABLED = import.meta.env.VITE_SYNC_ENABLED !== 'false';

import { useSyncExternalStore, useCallback } from "react";
import type { AppData } from "@/types";
import seedData from "@/data/data.json";
import { supabase, getSession } from "@/lib/supabase";
import { hydrateTradePhases } from "@/lib/tradePhases";
import { getT212ApiKey, migrateLegacyT212ApiKey, stripLegacyT212ApiKey } from "@/lib/deviceSettings";
import { scopedGetItem, scopedSetItem, scopedRemoveItem, setScope } from "@/lib/userScope";

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
const OFFLINE_MODE_KEY = "nexus.offlineMode";
const SYNCED_AT_KEY_PREFIX = "nexus.syncedAt.";

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
// These go through userScope so that signed-in users each get their own
// per-userId slot: `nexus_data:${userId}` / `nexus_savedAt:${userId}`.
// Before auth (or while offline) we fall back to the `:guest` scope, which
// also transparently migrates a pre-existing unscoped `nexus_data` entry so
// existing installs don't lose their local cache.
function localLoad(): AppData | null {
  try {
    const stored = scopedGetItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as AppData;
  } catch {
    // ignore
  }
  return null;
}

function localSave(data: AppData, savedAt = Date.now()): void {
  try {
    scopedSetItem(STORAGE_KEY, JSON.stringify(data));
    scopedSetItem(SAVED_AT_KEY, savedAt.toString());
    _lastLocalSaveAt = savedAt;
    notifySync();
  } catch {
    // storage full or unavailable
  }
}

function localSavedAt(): number {
  try {
    const ts = scopedGetItem(SAVED_AT_KEY);
    return ts ? parseInt(ts, 10) : 0;
  } catch {
    return 0;
  }
}

let _lastLocalSaveAt: number | null = localSavedAt() || null;

function readOfflineMode(): boolean {
  try {
    return localStorage.getItem(OFFLINE_MODE_KEY) === "true" || localStorage.getItem(OFFLINE_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function readConfirmedSyncAt(userId: string): number | null {
  try {
    const raw = localStorage.getItem(`${SYNCED_AT_KEY_PREFIX}${userId}`);
    const value = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeConfirmedSyncAt(userId: string, timestamp: number): void {
  try {
    if (Number.isFinite(timestamp) && timestamp > 0) {
      localStorage.setItem(`${SYNCED_AT_KEY_PREFIX}${userId}`, String(timestamp));
    }
  } catch {
    // ignore storage failures
  }
}

// ── Helper: Check if data is seed data (should never be pushed to cloud) ──────
function isSeedData(data: AppData | null): boolean {
  if (!data) return true;
  
  // Check if data has the protected flag (user's real data)
  if ((data as any)._protected) return false;
  
  // Check if data is identical to seed data by comparing key fields
  const seedAccounts = (seedData as any).accounts ?? [];
  const dataAccounts = data.accounts ?? [];
  
  // If accounts match seed data exactly, it's likely seed data
  if (seedAccounts.length === dataAccounts.length && seedAccounts.length > 0) {
    const seedIds = seedAccounts.map((a: any) => a.id).sort();
    const dataIds = dataAccounts.map((a: any) => a.id).sort();
    if (JSON.stringify(seedIds) === JSON.stringify(dataIds)) {
      return true;
    }
  }
  
  // Check if expenses match seed data
  const seedExpenses = (seedData as any).expenses ?? [];
  const dataExpenses = data.expenses ?? [];
  
  if (seedExpenses.length === dataExpenses.length && seedExpenses.length > 0) {
    const seedIds = seedExpenses.map((e: any) => e.id).sort();
    const dataIds = dataExpenses.map((e: any) => e.id).sort();
    if (JSON.stringify(seedIds) === JSON.stringify(dataIds)) {
      return true;
    }
  }
  
  return false;
}

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

function createStarterWorkspace(): AppData {
  const base = seedData as unknown as AppData;
  return hydrateTradePhases({
    ...base,
    expenses: [],
    genExpenses: [],
    withdrawals: [],
    investments: [],
    wealthTargets: [],
    accounts: [],
    debts: [],
    creditCards: [],
    subscriptions: [],
    t212: {
      last_sync: 0,
      free_cash: 0,
      total_value: 0,
      invested: 0,
      ppl: 0,
      result: 0,
    },
    t212History: [],
    marketTickers: [],
    otherDebts: [],
    tradeJournal: [],
    economicEvents: [],
    journalEntries: [],
    sessionChecklist: [],
    passedChallenges: [],
    ideaTopics: [],
    ideaNotes: [],
    categoryBudgets: {},
  }).data;
}

const starterWorkspace = createStarterWorkspace();

// ── Singleton store ──────────────────────────────────────────────────────────
// Initialise synchronously from localStorage so the UI renders immediately.
// Capture whether localStorage had data so we know if Tauri file is needed.
// For Tauri with no localStorage, leave currentData as null until tauriLoad resolves.
// _hasLocalData tracks whether localStorage had a real cached copy — used to guard
// the initial cloud push so we never flood the cloud with seed/demo data.
const _localDataOnInit = localLoad();
let _hasLocalData = _localDataOnInit !== null;

// FIX: Never initialize with seed data — always start with null or real data
// This prevents seed data from being pushed to cloud on first sign-in
let currentData: AppData | null = _localDataOnInit
  ? mergeWithSeed(_localDataOnInit)
  : null;

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
  if (_currentUserId && timestamp !== null) {
    writeConfirmedSyncAt(_currentUserId, timestamp);
  }
  notifySync();
}

function setCurrentUserId(userId: string | null): void {
  if (_currentUserId === userId) return;
  _currentUserId = userId;
  // Switch the active localStorage scope so every subsequent scoped read/write
  // targets this user's namespace (`${key}:${userId}`), keeping multi-user
  // profiles on shared browsers from bleeding data into each other.
  setScope(userId);
  // Refresh the local-save timestamp from the newly active scope so conflict
  // resolution during cloud sync compares like with like.
  _lastLocalSaveAt = localSavedAt() || null;
  _syncedAt = userId ? readConfirmedSyncAt(userId) : null;
  notifySync();
}

export function getCurrentUserId(): string | null {
  return _currentUserId;
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
  _hasLocalData = true;
  localSave(normalized);
  if (isTauri) {
    tauriSave(normalized);
  }
  notify();
  // ── Supabase sync (fire and forget) ────────────────────────────────────────
  // FIX: Never push seed data to cloud
  if (_currentUserId && !readOfflineMode() && !isSeedData(normalized)) {
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
  } else if (_currentUserId && isSeedData(normalized)) {
    log("Skipping cloud sync for seed data");
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

function getSnapshot(): AppData {
  return currentData ?? starterWorkspace;
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
      _hasLocalData = true;
      localSave(currentData);
      notify();
    }
    // FIX: Don't load seed data if no Tauri file — keep currentData as null
    // The UI will render with seed data via getSnapshot(), but we won't push it to cloud
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
  if (!SYNC_ENABLED) {
    log("SYNC_ENABLED=false, skipping all cloud operations");
    return;
  }
  if (readOfflineMode()) {
    log("Offline mode enabled, skipping cloud sync");
    setCurrentUserId(null);
    return;
  }
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
  log("initSupabaseSync: session found, user:", session.user.id);
  setCurrentUserId(session.user.id);
  const confirmedSyncAt = _syncedAt;

  // ── Fetch latest row from Supabase ─────────────────────────────────────────
  try {
    log("Fetching user_data for user:", _currentUserId);
    const { data: row, error: fetchError } = await supabase
      .from("user_data")
      .select("payload, updated_at")
      .eq("user_id", _currentUserId)
      .maybeSingle();

    log("Fetch result:", { row: !!row, fetchError });
    if (fetchError) {
      console.error("[store] Fetch error:", fetchError.code, fetchError.message);
      setSyncError(fetchError.message);
      throw new Error(fetchError.message);
    }

    if (row?.payload) {
      const cloudTs = new Date(row.updated_at as string).getTime();
      const localTs = currentData ? localSavedAt() : 0;
      const localAvatarUrl = currentData?.userProfile?.avatarUrl;
      log("Cloud data found. cloudTs:", cloudTs, "localTs:", localTs, "cloud wins:", !currentData || localTs <= cloudTs);

      // FIX: Never push seed data to cloud, always prefer cloud data
      const localIsSeed = isSeedData(currentData);
      const cloudIsSeed = isSeedData(row.payload as AppData);
      const cloudIsProtected = (row.payload as any)?._protected;
      const cloudChangedSinceLastSync = confirmedSyncAt === null || cloudTs > confirmedSyncAt;
      const localChangedSinceLastSync =
        !!currentData && !localIsSeed && confirmedSyncAt !== null && localTs > confirmedSyncAt;
      
      if (cloudIsSeed && currentData && !localIsSeed) {
        log("Cloud row looks like seed data, pushing protected local data instead");
        const { data: pushRow, error: pushErr } = await supabase
          .from("user_data")
          .upsert({ user_id: _currentUserId, payload: cloudPayload(currentData) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
          .select("updated_at")
          .single();
        if (pushErr) {
          setSyncError(pushErr.message);
          throw new Error(pushErr.message);
        }
        setSyncedAt(pushRow?.updated_at ? new Date(pushRow.updated_at as string).getTime() : localTs);
      } else if (cloudIsSeed) {
        log("Cloud row looks like seed data and no real local data exists; leaving workspace local-only");
      } else if (localIsSeed) {
        // Local is seed data — always apply cloud data, never push seed to cloud
        log("Local is seed data, applying cloud data (never push seed to cloud)");
        currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
        localSave(currentData, cloudTs);
        notify();
        setSyncedAt(cloudTs);
      } else if (cloudIsProtected && _syncedAt === null) {
        // Cloud data is protected and this is first sync — always apply cloud data
        log("Cloud data is protected, applying cloud data");
        currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
        localSave(currentData, cloudTs);
        notify();
        setSyncedAt(cloudTs);
      } else if (currentData && localChangedSinceLastSync && !cloudChangedSinceLastSync && localTs > cloudTs) {
        // Local is newer AND we have synced before — push local to cloud, keep local data
        // On first sign-in (_syncedAt === null), always prefer cloud to avoid stale seed data overwriting real cloud data
        log("Local is newer and previously synced, pushing to cloud");
        const { data: pushRow, error: pushErr } = await supabase
          .from("user_data")
          .upsert({ user_id: _currentUserId, payload: cloudPayload(currentData) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
          .select("updated_at")
          .single();
        if (pushErr) {
          setSyncError(pushErr.message);
          throw new Error(pushErr.message);
        }
        setSyncedAt(pushRow?.updated_at ? new Date(pushRow.updated_at as string).getTime() : cloudTs);
      } else {
        // Cloud is newer, same, or local has not hydrated yet — apply cloud data
        log("Applying cloud data. Account count:", (row.payload as AppData)?.accounts?.length);
        currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
        localSave(currentData, cloudTs);
        notify();
        setSyncedAt(cloudTs);
      }
    } else {
      if (!currentData || !_hasLocalData) {
        // Cold desktop boot with no local cache yet. Wait for Tauri/local hydration
        // rather than creating a seed/demo cloud row.
        // Also guard: never push seed/demo data to the cloud even if currentData
        // is populated (non-Tauri browser path gets seedData as currentData).
        log("No cloud row and no local data (or using seed data), skipping initial push");
        // Do not return from initSupabaseSync here — Realtime still needs to subscribe below.
      } else {
        // No row yet — push local data to create the initial cloud record
        log("No cloud row found, pushing local data as initial record");
        const { data: newRow, error } = await supabase
          .from("user_data")
          .upsert({ user_id: _currentUserId, payload: cloudPayload(currentData) as unknown as Record<string, unknown> }, { onConflict: "user_id" })
          .select("updated_at")
          .single();
        if (!error && newRow?.updated_at) {
          setSyncedAt(new Date(newRow.updated_at as string).getTime());
        } else if (error) {
          console.error("[store] Upsert error:", error.code, error.message);
          setSyncError(error.message);
          throw new Error(error.message);
        }
      }
    }
  } catch (err) {
    console.error("[store] initSupabaseSync fetch error:", err);
    setSyncedAt(0);
    const message = err instanceof Error ? err.message : "Initial sync failed";
    setSyncError(message);
    throw err instanceof Error ? err : new Error(message);
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
          
          // FIX: Never apply seed data from cloud
          if (isSeedData(newRow.payload as AppData)) {
            log("Skipping Realtime update: incoming data is seed data");
            return;
          }
          
          const incomingTs = new Date(newRow.updated_at).getTime();
          if (incomingTs > (_syncedAt ?? 0)) {
            // Preserve local avatarUrl — it's a device-local base64 blob, not synced.
            const localAvatarUrl = currentData?.userProfile?.avatarUrl;
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
  if (!SYNC_ENABLED) return false;
  if (readOfflineMode()) return false;
  if (!_currentUserId) return false;
  beginSyncOp();
  setSyncError(null);
  try {
    const { data: row } = await supabase
      .from("user_data")
      .select("payload, updated_at")
      .eq("user_id", _currentUserId)
      .single();
    if (row?.payload) {
      // FIX: Never apply seed data from cloud
      if (isSeedData(row.payload as AppData)) {
        log("forcePullFromCloud: skipping seed data from cloud");
        return false;
      }
      
      const localAvatarUrl = currentData?.userProfile?.avatarUrl;
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
  if (readOfflineMode()) return false;
  if (!_currentUserId) return false;
  if (!currentData) return false;
  
  // FIX: Never push seed data to cloud
  if (isSeedData(currentData)) {
    log("forcePushToCloud: skipping seed data");
    return false;
  }
  
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

export type SyncNowResult = { ok: true } | { ok: false; message: string };

export async function syncNow(): Promise<SyncNowResult> {
  if (!SYNC_ENABLED) {
    return { ok: false, message: "Cloud sync is disabled in this build." };
  }
  if (readOfflineMode()) {
    return { ok: false, message: "Turn off offline mode to sync with the cloud." };
  }
  if (!_currentUserId) {
    return { ok: false, message: "Sign in to sync your workspace." };
  }

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
      return { ok: false, message: error.message };
    }

    const localTs = localSavedAt();
    const cloudTs = row?.updated_at ? new Date(row.updated_at as string).getTime() : null;
    const cloudIsSeed = row?.payload ? isSeedData(row.payload as AppData) : false;

    const cloudChangedSinceLastSync = cloudTs !== null && (_syncedAt === null || cloudTs > _syncedAt);
    const localChangedSinceLastSync =
      !!currentData && !isSeedData(currentData) && _syncedAt !== null && localTs > _syncedAt;

    if (
      row?.payload &&
      !cloudIsSeed &&
      cloudTs !== null &&
      (!currentData || cloudTs >= localTs || cloudChangedSinceLastSync || !localChangedSinceLastSync)
    ) {
      const localAvatarUrl = currentData?.userProfile?.avatarUrl;
      currentData = withLocalAvatar(mergeWithSeed(row.payload as Partial<AppData>), localAvatarUrl);
      localSave(currentData, cloudTs);
      setSyncedAt(cloudTs);
      notify();
      return { ok: true };
    }

    if (!currentData) {
      const message = "No local workspace loaded yet — try again in a moment.";
      setSyncError(message);
      return { ok: false, message };
    }
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
      return { ok: true };
    }

    if (pushError) {
      console.error("[store] syncNow push failed:", pushError.message, pushError.code);
      setSyncError(pushError.message);
      return { ok: false, message: pushError.message };
    }

    setSyncError(null);
    return { ok: false, message: "Already up to date — nothing to push." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    setSyncError(message);
    return { ok: false, message };
  } finally {
    endSyncOp();
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAppData() {
  const data = useSyncExternalStore(subscribe, getSnapshot);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    saveData(updater(currentData ?? createStarterWorkspace()));
  }, []);

  return { data, update };
}

export function loadData(): AppData | null {
  return currentData;
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncStatusSnapshot);
}
