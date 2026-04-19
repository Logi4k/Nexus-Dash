/**
 * User-scoped localStorage helpers.
 *
 * On multi-user/shared browser profiles we must never mix data between users.
 * Any data that is "about this user" (their workspace, their journal drafts,
 * their custom instruments, etc.) goes through the scoped helpers here so it
 * gets keyed by `${key}:${userId}` once a user is signed in, falling back to
 * `${key}:guest` before auth.
 *
 * Data that is device- or browser-level (UI chrome state, sidebar collapsed,
 * offline toggle, global third-party caches) should NOT use these helpers —
 * it's device-wide by design.
 */

const GUEST_SCOPE = "guest";

let _scope: string = GUEST_SCOPE;
type ScopeListener = (scope: string) => void;
const _listeners = new Set<ScopeListener>();

export function getScope(): string {
  return _scope;
}

/** Update the active scope. Called by the store when the auth user changes. */
export function setScope(userId: string | null): void {
  const next = userId ?? GUEST_SCOPE;
  if (next === _scope) return;
  _scope = next;
  for (const fn of _listeners) {
    try { fn(_scope); } catch { /* ignore listener errors */ }
  }
}

export function subscribeScope(fn: ScopeListener): () => void {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function scopedKey(baseKey: string, userId?: string | null): string {
  const scope = userId === undefined ? _scope : (userId ?? GUEST_SCOPE);
  return `${baseKey}:${scope}`;
}

/**
 * Read from localStorage using a scoped key. If the scoped key is empty and a
 * legacy unscoped key exists, transparently migrate it to the scoped slot and
 * return its value. This keeps existing users from losing local data when the
 * app upgrades to namespaced storage.
 */
export function scopedGetItem(
  baseKey: string,
  options?: { migrateFromLegacy?: boolean }
): string | null {
  if (typeof window === "undefined") return null;
  const { migrateFromLegacy = true } = options ?? {};
  try {
    const key = scopedKey(baseKey);
    const scoped = window.localStorage.getItem(key);
    if (scoped !== null) return scoped;

    if (migrateFromLegacy) {
      const legacy = window.localStorage.getItem(baseKey);
      if (legacy !== null) {
        window.localStorage.setItem(key, legacy);
        // Only strip the legacy key once we've successfully adopted it into a
        // real (non-guest) scope — otherwise clearing guest data would prevent
        // future sign-ins from migrating.
        if (_scope !== GUEST_SCOPE) {
          window.localStorage.removeItem(baseKey);
        }
        return legacy;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function scopedSetItem(baseKey: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(scopedKey(baseKey), value);
  } catch {
    // storage unavailable or full
  }
}

export function scopedRemoveItem(baseKey: string, options?: { allScopes?: boolean }): void {
  if (typeof window === "undefined") return;
  try {
    if (options?.allScopes) {
      const prefix = `${baseKey}:`;
      const toRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) toRemove.push(k);
      }
      for (const k of toRemove) window.localStorage.removeItem(k);
      window.localStorage.removeItem(baseKey);
    } else {
      window.localStorage.removeItem(scopedKey(baseKey));
    }
  } catch {
    // ignore
  }
}

/**
 * Returns every localStorage key (scoped + legacy) associated with a given
 * base key. Useful for a full "Clear all data" sweep in Settings.
 */
export function listAllScopedKeys(baseKey: string): string[] {
  if (typeof window === "undefined") return [];
  const prefix = `${baseKey}:`;
  const out: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && (k === baseKey || k.startsWith(prefix))) out.push(k);
    }
  } catch {
    // ignore
  }
  return out;
}
