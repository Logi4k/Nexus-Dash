import type { AppData, Debt } from "@/types";
import { getPropAccountSnapshot } from "@/lib/propRules";
import { normalizeAccountStatus } from "@/lib/accountStatus";
import { daysUntil, fmtDate, fmtGBP, fmtUSD, toNum, UK_TAX } from "@/lib/utils";

export type AppNotificationCategory = "subscription" | "prop" | "debt" | "tax";
export type AppNotificationSeverity = "info" | "warn" | "critical";

export interface AppNotification {
  id: string;
  category: AppNotificationCategory;
  severity: AppNotificationSeverity;
  title: string;
  detail: string;
  sideLabel: string;
  sortDays: number;
}

function severityWeight(severity: AppNotificationSeverity): number {
  if (severity === "critical") return 0;
  if (severity === "warn") return 1;
  return 2;
}

function getCurrentTaxYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const afterApril5 = month > 4 || (month === 4 && day >= 6);
  const startYear = afterApril5 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    start: `${startYear}-04-06`,
    end: `${endYear}-04-05`,
    deadline: `${endYear + 1}-01-31`,
    endYear,
  };
}

function calcIncomeTax(totalIncome: number): number {
  const taxable = Math.max(0, totalIncome - UK_TAX.PERSONAL_ALLOWANCE);
  const basicBand = Math.min(taxable, UK_TAX.BASIC_RATE_LIMIT - UK_TAX.PERSONAL_ALLOWANCE);
  const higherBand = Math.min(
    Math.max(0, taxable - basicBand),
    UK_TAX.HIGHER_RATE_LIMIT - UK_TAX.BASIC_RATE_LIMIT
  );
  const additionalBand = Math.max(0, taxable - basicBand - higherBand);

  return basicBand * UK_TAX.BASIC_RATE
    + higherBand * UK_TAX.HIGHER_RATE
    + additionalBand * UK_TAX.ADDITIONAL_RATE;
}

function buildSubscriptionNotifications(data: AppData): AppNotification[] {
  const leadDays = data.userSettings?.subscriptionRenewalDays ?? 7;

  return (data.subscriptions ?? [])
    .map((sub) => ({ ...sub, daysLeft: daysUntil(sub.nextRenewal) }))
    .filter((sub) => sub.daysLeft >= 0 && sub.daysLeft <= leadDays)
    .map((sub) => ({
      id: `subscription:${sub.id}:${sub.nextRenewal}`,
      category: "subscription" as const,
      severity: sub.daysLeft <= 2 ? "critical" as const : "warn" as const,
      title: `${sub.name} renewal due`,
      detail: `${fmtGBP(toNum(sub.amount), 0)}/${sub.frequency === "monthly" ? "mo" : sub.frequency === "yearly" ? "yr" : "wk"} on ${fmtDate(sub.nextRenewal)}`,
      sideLabel: sub.daysLeft === 0 ? "Today" : sub.daysLeft === 1 ? "Tomorrow" : `${sub.daysLeft}d`,
      sortDays: sub.daysLeft,
    }));
}

function buildPropNotifications(data: AppData): AppNotification[] {
  return data.accounts.flatMap((account) => {
    const status = normalizeAccountStatus(account.status);
    const snapshot = getPropAccountSnapshot(account);
    const accountLabel = account.name?.trim() || account.type || "Account";

    if (status === "breached" || snapshot?.breached) {
      const overage = snapshot ? Math.abs(Math.min(snapshot.distanceToMll, 0)) : 0;
      return [{
        id: `prop-breached:${account.id}:${Math.round(account.balance)}:${Math.round(overage)}`,
        category: "prop" as const,
        severity: "critical" as const,
        title: `${accountLabel} breached`,
        detail: snapshot
          ? `${account.firm} is below MLL ${fmtUSD(snapshot.mllFloor, 0)} by ${fmtUSD(overage, 0)}`
          : `${account.firm} account is marked as breached`,
        sideLabel: "Breach",
        sortDays: -2,
      }];
    }

    if (!snapshot) return [];

    const warningBuffer = Math.max(snapshot.initialBalance * 0.02, 500);
    if (snapshot.distanceToMll > warningBuffer) return [];

    return [{
      id: `prop-buffer:${account.id}:${Math.round(snapshot.distanceToMll)}:${Math.round(snapshot.mllFloor)}`,
      category: "prop" as const,
      severity: snapshot.distanceToMll <= 250 ? "critical" as const : "warn" as const,
      title: `${accountLabel} buffer is tight`,
      detail: `${account.firm} has ${fmtUSD(Math.max(snapshot.distanceToMll, 0), 0)} left before MLL ${fmtUSD(snapshot.mllFloor, 0)}`,
      sideLabel: fmtUSD(Math.max(snapshot.distanceToMll, 0), 0),
      sortDays: 0,
    }];
  });
}

function buildDebtNotifications(data: AppData): AppNotification[] {
  const leadDays = Math.max(7, data.userSettings?.subscriptionRenewalDays ?? 7);
  const allDebts: Debt[] = [...(data.debts ?? []), ...(data.otherDebts ?? [])];

  return allDebts
    .map((debt) => ({ debt, daysLeft: daysUntil(debt.nextPayment) }))
    .filter(({ debt, daysLeft }) => debt.currentBalance > 0 && daysLeft >= 0 && daysLeft <= leadDays)
    .map(({ debt, daysLeft }) => ({
      id: `debt:${debt.id}:${debt.nextPayment}:${Math.round(debt.currentBalance)}`,
      category: "debt" as const,
      severity: daysLeft <= 2 ? "critical" as const : "warn" as const,
      title: `${debt.name} payment due`,
      detail: `${fmtGBP(debt.monthly, 0)} due on ${fmtDate(debt.nextPayment)} · ${fmtGBP(debt.currentBalance, 0)} outstanding`,
      sideLabel: daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`,
      sortDays: daysLeft,
    }));
}

function buildTaxNotifications(data: AppData): AppNotification[] {
  const taxYear = getCurrentTaxYear();
  const salary = data.taxSettings?.salary ?? 30000;
  const savedSoFar = data.taxSettings?.savedSoFar ?? 0;
  const savingsGoalOverride = data.taxSettings?.savingsGoalOverride ?? null;

  const withdrawalsThisYear = data.withdrawals.filter((w) => w.date >= taxYear.start && w.date <= taxYear.end);
  const tradingIncome = withdrawalsThisYear.reduce((sum, withdrawal) => sum + toNum(withdrawal.gross), 0);
  const expensesThisYear = data.expenses
    .filter((expense) => expense.date >= taxYear.start && expense.date <= taxYear.end)
    .reduce((sum, expense) => sum + toNum(expense.amount), 0);

  const tradingProfit = Math.max(0, tradingIncome - expensesThisYear);
  const totalIncome = salary + tradingProfit;
  const additionalIncomeTax = Math.max(0, calcIncomeTax(totalIncome) - calcIncomeTax(salary));
  const poaEach = additionalIncomeTax > 1000 ? additionalIncomeTax / 2 : 0;
  const totalDueJan31 = additionalIncomeTax + poaEach;
  const remaining = Math.max(0, totalDueJan31 - savedSoFar);
  const daysToDeadline = daysUntil(taxYear.deadline);
  const monthsToDeadline = Math.max(1, Math.ceil(daysToDeadline / 30));
  const effectiveMonthlyGoal = savingsGoalOverride ?? (totalDueJan31 > 0 ? totalDueJan31 / monthsToDeadline : 0);

  if (totalDueJan31 <= 0 || remaining <= 0 || daysToDeadline > 120) {
    return [];
  }

  const severity: AppNotificationSeverity =
    daysToDeadline <= 30 || remaining > effectiveMonthlyGoal * 2.5
      ? "critical"
      : "warn";

  return [{
    id: `tax:deadline:${taxYear.deadline}:${Math.round(remaining)}`,
    category: "tax",
    severity,
    title: "Tax payment still needs funding",
    detail: `${fmtGBP(remaining, 0)} remaining before ${fmtDate(taxYear.deadline)} · target ${fmtGBP(effectiveMonthlyGoal, 0)}/mo`,
    sideLabel: daysToDeadline === 0 ? "Today" : `${daysToDeadline}d`,
    sortDays: daysToDeadline,
  }];
}

function sortNotifications(notifications: AppNotification[]): AppNotification[] {
  return notifications.sort((a, b) => {
    const severityDiff = severityWeight(a.severity) - severityWeight(b.severity);
    if (severityDiff !== 0) return severityDiff;
    return a.sortDays - b.sortDays;
  });
}

export function buildRawAppNotifications(data: AppData): AppNotification[] {
  return sortNotifications([
    ...buildPropNotifications(data),
    ...buildDebtNotifications(data),
    ...buildTaxNotifications(data),
    ...buildSubscriptionNotifications(data),
  ]);
}

export function buildAppNotifications(data: AppData): AppNotification[] {
  const dismissed = new Set(data.userSettings?.dismissedNotificationIds ?? []);
  return buildRawAppNotifications(data).filter((notification) => !dismissed.has(notification.id));
}

export function getNotificationCount(data: AppData): number {
  return buildAppNotifications(data).length;
}
