import { useSyncExternalStore, useCallback } from "react";
import type { AppData } from "@/types";
import seedData from "@/data/data.json";
import { supabase, getSession } from "@/lib/supabase";

// ── Supabase sync state ──────────────────────────────────────────────────────
let _syncedAt: number | null = null;       // ms-since-epoch of last confirmed sync
let _currentUserId: string | null = null;  // set after successful auth

const STORAGE_KEY = "nexus_data";

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
  } catch {
    // storage full or unavailable
  }
}

// ── Merge helper: user data wins, seed fills missing keys ────────────────────
function mergeWithSeed(parsed: Partial<AppData>): AppData {
  return { ...(seedData as unknown as AppData), ...parsed };
}

// ── Singleton store ──────────────────────────────────────────────────────────
// Initialise synchronously from localStorage so the UI renders immediately.
// If running in Tauri, we'll asynchronously upgrade from the file-based store.
let currentData: AppData = (() => {
  const parsed = localLoad();
  return parsed ? mergeWithSeed(parsed) : (seedData as unknown as AppData);
})();

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((fn) => fn());
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

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): AppData {
  return currentData;
}

// ── Async boot: upgrade from Tauri file store ────────────────────────────────
// This runs once after module load. If Tauri has richer/newer data than what
// localStorage had, we update in-memory state and notify all subscribers.
if (isTauri) {
  tauriLoad().then((data) => {
    if (data) {
      currentData = mergeWithSeed(data);
      // Sync the upgraded data back to localStorage.
      localSave(currentData);
      notify();
    }
  });
}

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
