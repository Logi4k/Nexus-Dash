import type { AppData } from "@/types";

export type AuditCsvRow = {
  timestamp: string;
  kind: string;
  label: string;
  detail: string;
  amount: string;
};

function atMidday(isoDay: string) {
  return `${isoDay}T12:00:00.000Z`;
}

/** Merged timeline (newest first) for CSV export — trades, payouts, and journal day notes. */
export function buildAuditFeedCsvRows(data: AppData, limit = 500): AuditCsvRow[] {
  const rows: { at: string; kind: string; label: string; detail: string; amount: string }[] = [];

  for (const t of data.tradeJournal ?? []) {
    const timePart = t.time && /\d/.test(t.time) ? t.time : "12:00:00";
    rows.push({
      at: `${t.date}T${timePart}`,
      kind: "trade",
      label: `${t.instrument} ${t.direction}`,
      detail: [t.setup, t.notes].filter(Boolean).join(" · ") || "",
      amount: String(t.pnl ?? ""),
    });
  }

  for (const w of data.withdrawals ?? []) {
    rows.push({
      at: atMidday(w.date),
      kind: "payout",
      label: w.firm,
      detail: w.notes ?? "",
      amount: String(w.gross ?? ""),
    });
  }

  for (const e of data.journalEntries ?? []) {
    rows.push({
      at: atMidday(e.date),
      kind: "journal_day",
      label: "Journal day",
      detail: [e.bias, e.mood, e.notes].filter(Boolean).join(" · ") || "",
      amount: "",
    });
  }

  rows.sort((a, b) => b.at.localeCompare(a.at));
  return rows.slice(0, limit).map((r) => ({
    timestamp: r.at,
    kind: r.kind,
    label: r.label,
    detail: r.detail,
    amount: r.amount,
  }));
}
