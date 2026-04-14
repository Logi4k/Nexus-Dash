import type { AppData } from "@/types";

export interface BackupEnvelope {
  formatVersion: number;
  exportedAt: string;
  data: AppData;
}

export const BACKUP_FORMAT_VERSION = 2;

export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function toCSV(rows: Record<string, unknown>[], headers: string[]) {
  const escape = (value: unknown) => {
    const normalized = String(value ?? "").replace(/"/g, '""');
    return /[,"\n]/.test(normalized) ? `"${normalized}"` : normalized;
  };

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export function buildBackupEnvelope(data: AppData): BackupEnvelope {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function buildMonthlyReviewMarkdown(data: AppData) {
  const totalWithdrawals = (data.withdrawals ?? []).reduce(
    (sum, withdrawal) => sum + Number(withdrawal.gross ?? 0),
    0
  );
  const totalPropExpenses = (data.expenses ?? []).reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );
  const totalOtherExpenses = (data.genExpenses ?? []).reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );
  const totalDebt = [...(data.debts ?? []), ...(data.otherDebts ?? [])].reduce(
    (sum, debt) => sum + Number(debt.currentBalance ?? 0),
    0
  );
  const tradeCount = data.tradeJournal?.length ?? 0;
  const accountCount = data.accounts?.length ?? 0;

  return [
    "# Nexus Monthly Review",
    "",
    `Generated: ${new Date().toLocaleString("en-GB")}`,
    "",
    "## Overview",
    `- Trades logged: ${tradeCount}`,
    `- Active prop accounts: ${accountCount}`,
    `- Total withdrawals: £${totalWithdrawals.toFixed(2)}`,
    `- Prop expenses: £${totalPropExpenses.toFixed(2)}`,
    `- Overhead expenses: £${totalOtherExpenses.toFixed(2)}`,
    `- Current debt: £${totalDebt.toFixed(2)}`,
    "",
    "## Coaching Prompts",
    "- Which setup or account generated the cleanest results this period?",
    "- Where did costs rise faster than payouts or portfolio growth?",
    "- What is the next one decision that improves cash discipline this month?",
    "",
  ].join("\n");
}
