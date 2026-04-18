import type { AppData } from "@/types";

export type DataQualityIssue = {
  id: string;
  severity: "info" | "warn";
  title: string;
  detail: string;
  ref?: string;
};

function withdrawalSignature(w: { date: string; firm: string; gross: number; accountId?: string }) {
  return `${w.date}|${w.firm}|${w.gross}|${w.accountId ?? ""}`;
}

/** Lightweight hygiene checks for exports and the dashboard “data confidence” card. */
export function collectDataQualityIssues(data: AppData): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];
  const withdrawals = data.withdrawals ?? [];
  const counts = new Map<string, number>();
  for (const w of withdrawals) {
    const k = withdrawalSignature(w);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [sig, n] of counts) {
    if (n > 1) {
      issues.push({
        id: `dup-payout-${sig}`,
        severity: "warn",
        title: "Possible duplicate payouts",
        detail: `${n} payout rows share the same date, firm, gross, and account link.`,
        ref: "/prop",
      });
    }
  }

  const accounts = data.accounts ?? [];
  if (accounts.length > 0) {
    const missing = (data.tradeJournal ?? []).filter((t) => !t.accountId);
    if (missing.length > 0) {
      issues.push({
        id: "trades-missing-account",
        severity: "info",
        title: "Journal trades without a linked prop account",
        detail: `${missing.length} trade(s) omit accountId — account filters on Journal will skip them.`,
        ref: "/journal",
      });
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const staleSubs = (data.subscriptions ?? []).filter((s) => {
    if (s.cancelled) return false;
    const t = new Date(s.nextRenewal + "T12:00:00");
    return !Number.isNaN(t.getTime()) && t < today;
  });
  if (staleSubs.length > 0) {
    issues.push({
      id: "subs-stale-renewal",
      severity: "warn",
      title: "Subscriptions past renewal date",
      detail: `${staleSubs.length} active subscription(s) have a next renewal date in the past — update dates on Investments.`,
      ref: "/investments",
    });
  }

  return issues;
}

export function dataQualityRowsForCsv(issues: DataQualityIssue[]): Record<string, string>[] {
  return issues.map((i) => ({
    id: i.id,
    severity: i.severity,
    title: i.title,
    detail: i.detail,
    ref: i.ref ?? "",
  }));
}
