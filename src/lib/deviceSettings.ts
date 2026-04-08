import type { AppData } from "@/types";

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
    return window.localStorage.getItem(T212_API_KEY_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setT212ApiKey(apiKey: string): void {
  if (!canUseLocalStorage()) return;

  const normalized = apiKey.trim();
  if (!normalized) return;

  try {
    window.localStorage.setItem(T212_API_KEY_STORAGE_KEY, normalized);
  } catch {
    // Ignore local storage failures and keep the app usable.
  }
}

export function removeT212ApiKey(): void {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.removeItem(T212_API_KEY_STORAGE_KEY);
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

export function migrateLegacyT212ApiKey<T extends AppDataLike>(data: T): T {
  const legacyApiKey = (data.userSettings as LegacyUserSettings | undefined)?.t212ApiKey;

  if (legacyApiKey && !getT212ApiKey()) {
    setT212ApiKey(legacyApiKey);
  }

  return stripLegacyT212ApiKey(data);
}
