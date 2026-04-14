import type { RecentEntry } from "@/types";

export interface ViewIntentPayload {
  viewIntent: {
    id: string;
    route: string;
    state: Record<string, unknown>;
    source?: string;
  };
}

export interface RegisteredPageView {
  route: string;
  title: string;
  description?: string;
  state: Record<string, unknown>;
}

export function buildViewIntentState(
  route: string,
  state: Record<string, unknown>,
  source?: string
): ViewIntentPayload {
  return {
    viewIntent: {
      id: `${route}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      route,
      state,
      source,
    },
  };
}

export function getViewIntentState(
  state: unknown
): ViewIntentPayload["viewIntent"] | null {
  if (!state || typeof state !== "object") return null;
  const candidate = (state as { viewIntent?: unknown }).viewIntent;
  if (!candidate || typeof candidate !== "object") return null;

  const parsed = candidate as {
    id?: unknown;
    route?: unknown;
    state?: unknown;
    source?: unknown;
  };

  if (typeof parsed.route !== "string") return null;
  if (!parsed.state || typeof parsed.state !== "object" || Array.isArray(parsed.state)) {
    return null;
  }

  return {
    id: typeof parsed.id === "string" ? parsed.id : parsed.route,
    route: parsed.route,
    state: parsed.state as Record<string, unknown>,
    source: typeof parsed.source === "string" ? parsed.source : undefined,
  };
}

export function upsertRecentEntry(
  existing: RecentEntry[] | undefined,
  next: Omit<RecentEntry, "visitedAt"> & { visitedAt?: string },
  max = 12
): RecentEntry[] {
  const entry: RecentEntry = {
    ...next,
    visitedAt: next.visitedAt ?? new Date().toISOString(),
  };
  const items = existing ?? [];
  const filtered = items.filter(
    (item) =>
      !(
        item.kind === entry.kind &&
        item.route === entry.route &&
        item.label === entry.label &&
        JSON.stringify(item.state ?? {}) === JSON.stringify(entry.state ?? {})
      )
  );
  return [entry, ...filtered].slice(0, max);
}
