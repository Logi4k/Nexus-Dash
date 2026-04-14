import type { NavigateFunction } from "react-router-dom";

export type QuickAction =
  | "addNote"
  | "addTrade"
  | "addExpense"
  | "addAccount"
  | "logPayout";

export interface QuickActionState {
  action: QuickAction;
  quickActionId: string;
}

export function buildQuickActionState(action: QuickAction): QuickActionState {
  return {
    action,
    quickActionId: `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

export function navigateToQuickAction(
  navigate: NavigateFunction,
  path: string,
  action: QuickAction
): void {
  navigate(path, { state: buildQuickActionState(action) });
}

export function getQuickActionState(state: unknown): QuickActionState | null {
  if (!state || typeof state !== "object") return null;

  const candidate = state as {
    action?: unknown;
    quickActionId?: unknown;
  };

  if (typeof candidate.action !== "string") return null;

  return {
    action: candidate.action as QuickAction,
    quickActionId:
      typeof candidate.quickActionId === "string"
        ? candidate.quickActionId
        : candidate.action,
  };
}
