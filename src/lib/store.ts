import { useSyncExternalStore, useCallback } from "react";
import type { AppData } from "@/types";
import seedData from "@/data/data.json";

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
  // Always mirror to localStorage as an immediate, synchronous backup.
  localSave(data);
  // Persist to the Tauri file store when available.
  if (isTauri) {
    tauriSave(data);
  }
  notify();
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
