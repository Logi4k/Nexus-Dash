import type { AppData } from "@/types";
import { scopedGetItem, scopedSetItem, scopedRemoveItem } from "@/lib/userScope";

type LegacyUserSettings = {
  t212ApiKey?: string;
};

type AppDataLike = AppData | Partial<AppData>;

const T212_API_KEY_STORAGE_KEY = "nexus.t212ApiKey";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getT212ApiKey(): string {
  if (!canUseLocalStorage()) return "";
  try {
    return scopedGetItem(T212_API_KEY_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setT212ApiKey(apiKey: string): void {
  if (!canUseLocalStorage()) return;
  const normalized = apiKey.trim();
  if (!normalized) return;
  try {
    scopedSetItem(T212_API_KEY_STORAGE_KEY, normalized);
  } catch {
    // Ignore local storage failures and keep the app usable.
  }
}

export function removeT212ApiKey(): void {
  if (!canUseLocalStorage()) return;
  try {
    scopedRemoveItem(T212_API_KEY_STORAGE_KEY);
  } catch {
    // Ignore local storage failures and keep the app usable.
  }
}

export function stripLegacyT212ApiKey<T extends AppDataLike>(data: T): T {
  const userSettings = data.userSettings as (Partial<AppData["userSettings"]> & LegacyUserSettings) | undefined;
  if (!userSettings || !("t212ApiKey" in userSettings)) return data;

  const { t212ApiKey: _legacyApiKey, ...nextUserSettings } = userSettings;

  return {
    ...data,
    userSettings: nextUserSettings,
  } as T;
}

/**
 * Reconciles the T212 API key across three storage locations in priority order:
 *   1. `data.t212ApiKey`       (cloud-synced, multi-device source of truth)
 *   2. `localStorage`           (fast synchronous cache on this device)
 *   3. `data.userSettings.t212ApiKey`  (historical location — removed on write)
 *
 * Always returns AppData with the strongest known value written into `t212ApiKey`
 * and the legacy `userSettings.t212ApiKey` stripped. Local cache is updated to
 * match, so subsequent synchronous reads via getT212ApiKey() always succeed.
 */
export function migrateLegacyT212ApiKey<T extends AppDataLike>(data: T): T {
  const legacyApiKey = (data.userSettings as LegacyUserSettings | undefined)?.t212ApiKey;
  const syncedApiKey = (data as { t212ApiKey?: string }).t212ApiKey;
  const cachedApiKey = getT212ApiKey();

  const resolved = syncedApiKey?.trim() || legacyApiKey?.trim() || cachedApiKey || "";

  if (resolved && resolved !== cachedApiKey) {
    setT212ApiKey(resolved);
  }

  const withSyncedKey = resolved
    ? ({ ...data, t212ApiKey: resolved } as T)
    : data;

  return stripLegacyT212ApiKey(withSyncedKey);
}
