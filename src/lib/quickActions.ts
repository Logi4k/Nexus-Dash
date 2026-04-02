import { NavigateFunction } from "react-router-dom";

export type QuickAction = "addNote" | "addTrade" | "addExpense" | "addAccount" | "logPayout";

interface QuickActionState {
  quickAction: {
    quickActionId: string;
    action: QuickAction;
  };
}

export function navigateToQuickAction(
  navigate: NavigateFunction,
  path: string,
  action: QuickAction
): void {
  const quickActionId = crypto.randomUUID();
  navigate(path, { state: { quickAction: { quickActionId, action } } });
}

export function getQuickActionState(state: unknown): { quickActionId: string; action: QuickAction } | null {
  if (state && typeof state === "object" && "quickAction" in state) {
    const qa = (state as QuickActionState).quickAction;
    if (qa && typeof qa === "object" && "action" in qa) {
      return { quickActionId: qa.quickActionId, action: qa.action };
    }
  }
  return null;
}
