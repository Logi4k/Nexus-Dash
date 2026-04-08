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
