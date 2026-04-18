import { ArrowDownToLine, Database, FileSpreadsheet, FileText, ListTree, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import {
  buildBackupEnvelope,
  buildMonthlyReviewMarkdown,
  downloadFile,
  todayISO,
  toCSV,
} from "@/lib/exportUtils";
import { buildAuditFeedCsvRows } from "@/lib/auditFeed";
import { collectDataQualityIssues, dataQualityRowsForCsv } from "@/lib/dataQuality";
import type { AppData } from "@/types";

export default function ExportCenterModal({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: AppData;
}) {
  const actions = [
    {
      id: "backup-json",
      title: "Full backup",
      description: "Export the entire workspace as a versioned JSON backup.",
      Icon: Database,
      run: () => {
        downloadFile(
          JSON.stringify(buildBackupEnvelope(data), null, 2),
          `nexus-backup-${todayISO()}.json`,
          "application/json"
        );
        toast.success("Backup exported");
      },
    },
    {
      id: "trades-csv",
      title: "Trades CSV",
      description: "Export journal trades for spreadsheet analysis.",
      Icon: FileSpreadsheet,
      run: () => {
        downloadFile(
          toCSV((data.tradeJournal ?? []) as unknown as Record<string, unknown>[], [
            "date",
            "time",
            "instrument",
            "direction",
            "entryPrice",
            "exitPrice",
            "contracts",
            "pnl",
            "fees",
            "setup",
            "session",
            "notes",
            "accountId",
          ]),
          `nexus-trades-${todayISO()}.csv`,
          "text/csv"
        );
        toast.success("Trades exported");
      },
    },
    {
      id: "expenses-csv",
      title: "Expenses CSV",
      description: "Export both prop and overhead expenses together.",
      Icon: Wallet,
      run: () => {
        const rows = [
          ...(data.expenses ?? []).map((expense) => ({ ...expense, bucket: "prop" })),
          ...(data.genExpenses ?? []).map((expense) => ({ ...expense, bucket: "overhead" })),
        ] as unknown as Record<string, unknown>[];
        downloadFile(
          toCSV(rows, ["bucket", "date", "description", "amount", "cat", "firm"]),
          `nexus-expenses-${todayISO()}.csv`,
          "text/csv"
        );
        toast.success("Expenses exported");
      },
    },
    {
      id: "payouts-csv",
      title: "Payouts CSV",
      description: "Export all payout history with linked account references.",
      Icon: ArrowDownToLine,
      run: () => {
        downloadFile(
          toCSV((data.withdrawals ?? []) as unknown as Record<string, unknown>[], [
            "date",
            "firm",
            "gross",
            "accountId",
            "notes",
          ]),
          `nexus-payouts-${todayISO()}.csv`,
          "text/csv"
        );
        toast.success("Payouts exported");
      },
    },
    {
      id: "monthly-review",
      title: "Monthly review pack",
      description: "Export a markdown review summary with coaching prompts.",
      Icon: FileText,
      run: () => {
        downloadFile(
          buildMonthlyReviewMarkdown(data),
          `nexus-review-${todayISO()}.md`,
          "text/markdown"
        );
        toast.success("Monthly review exported");
      },
    },
    {
      id: "audit-feed-csv",
      title: "Activity audit (CSV)",
      description: "Trades, payouts, and journal day notes in one chronological export.",
      Icon: ListTree,
      run: () => {
        downloadFile(
          toCSV(buildAuditFeedCsvRows(data) as unknown as Record<string, unknown>[], [
            "timestamp",
            "kind",
            "label",
            "detail",
            "amount",
          ]),
          `nexus-audit-${todayISO()}.csv`,
          "text/csv"
        );
        toast.success("Audit trail exported");
      },
    },
    {
      id: "data-quality-csv",
      title: "Data quality report (CSV)",
      description: "Duplicate payouts, stale renewals, and other hygiene flags.",
      Icon: ShieldAlert,
      run: () => {
        const issues = collectDataQualityIssues(data);
        downloadFile(
          toCSV(dataQualityRowsForCsv(issues) as unknown as Record<string, unknown>[], [
            "id",
            "severity",
            "title",
            "detail",
            "ref",
          ]),
          `nexus-data-quality-${todayISO()}.csv`,
          "text/csv"
        );
        toast.success("Data quality report exported");
      },
    },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Export Center" size="md">
      <div className="space-y-3">
        <div className="rounded-2xl border border-border-subtle bg-bg-hover px-4 py-3">
          <div className="text-sm font-semibold text-tx-1">Export workspace data and reporting packs</div>
          <div className="mt-1 text-xs text-tx-4">
            Use these exports for backup, accountant handoff, external analysis, or monthly reviews.
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map(({ id, title, description, Icon, run }) => (
            <button
              key={id}
              type="button"
              onClick={run}
              className="rounded-2xl border border-border-subtle bg-bg-hover px-4 py-4 text-left transition-[background-color,border-color,transform] hover:-translate-y-0.5 hover:border-border"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-muted">
                <Icon size={16} className="text-tx-2" />
              </div>
              <div className="mt-3 text-sm font-semibold text-tx-1">{title}</div>
              <div className="mt-1 text-xs leading-relaxed text-tx-4">{description}</div>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
