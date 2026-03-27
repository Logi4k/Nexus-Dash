import { invoke } from "@tauri-apps/api/core";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const isMobileUserAgent =
  typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function isDesktopUpdaterRuntime(): boolean {
  return isTauri && !isMobileUserAgent;
}

export interface DesktopUpdateStatus {
  supported: boolean;
  configured: boolean;
  currentVersion: string;
  available: boolean;
  version?: string | null;
  date?: string | null;
  body?: string | null;
  error?: string | null;
}

export interface DesktopUpdateInstallResult {
  installed: boolean;
  version?: string | null;
  restartRequired: boolean;
}

export async function checkDesktopUpdate(): Promise<DesktopUpdateStatus> {
  if (!isDesktopUpdaterRuntime()) {
    return {
      supported: false,
      configured: false,
      currentVersion: "web",
      available: false,
      version: null,
      date: null,
      body: null,
      error: null,
    };
  }

  return invoke<DesktopUpdateStatus>("check_desktop_update");
}

export async function installDesktopUpdate(): Promise<DesktopUpdateInstallResult> {
  return invoke<DesktopUpdateInstallResult>("install_desktop_update");
}

export async function requestDesktopRestart(): Promise<void> {
  await invoke("request_app_restart");
}
