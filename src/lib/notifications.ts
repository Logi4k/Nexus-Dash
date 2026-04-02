import type { AppData } from "@/types";

export interface AppNotification {
  id: string;
  severity: "critical" | "warn" | "info";
  category: "subscription" | "prop" | "debt" | "tax";
  title: string;
  detail: string;
  sideLabel?: string;
}

export function buildAppNotifications(data: AppData): AppNotification[] {
  const notifications: AppNotification[] = [];

  // Subscription renewal notifications
  const renewalDays = data.userSettings?.subscriptionRenewalDays ?? 7;
  const now = new Date();
  for (const sub of data.subscriptions ?? []) {
    if (sub.cancelled) continue;
    const renewal = new Date(sub.nextRenewal);
    const daysUntilRenewal = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilRenewal <= renewalDays && daysUntilRenewal >= 0) {
      notifications.push({
        id: `sub-renewal-${sub.id}`,
        severity: daysUntilRenewal <= 1 ? "critical" : "warn",
        category: "subscription",
        title: `${sub.name} renews ${daysUntilRenewal <= 1 ? "today" : "soon"}`,
        detail: `${sub.amount}/mo`,
        sideLabel: daysUntilRenewal <= 1 ? "Today" : `${daysUntilRenewal}d`,
      });
    }
  }

  // Prop account breach warnings
  for (const account of data.accounts ?? []) {
    if (account.status === "Breached" || account.status === "breached") {
      notifications.push({
        id: `prop-breach-${account.id}`,
        severity: "critical",
        category: "prop",
        title: `${account.name ?? account.firm} breached`,
        detail: `Balance: ${account.balance.toLocaleString()}`,
        sideLabel: "Breached",
      });
    }
  }

  // Debt reminders - cards due soon
  // Note: CreditCard type doesn't have nextPayment, so we skip this for now
  // This can be enhanced when the type is updated

  return notifications;
}

export function buildRawAppNotifications(data: AppData): AppNotification[] {
  return buildAppNotifications(data);
}

export function getNotificationCount(data: AppData): number {
  return buildAppNotifications(data).length;
}
