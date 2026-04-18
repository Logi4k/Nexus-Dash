import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { fmtGBP, cn, toNum } from "@/lib/utils";
import { useBWMode, bwColor } from "@/lib/useBWMode";
import type { Expense, Withdrawal } from "@/types";

const FIRMS = [
  "Lucid Trading",
  "Tradeify",
  "Topstep",
  "FundingTicks",
  "MyFundedFX",
  "Take Profit Trader",
  "Maven Trading",
] as const;

const FIRM_SHORT: Record<string, string> = {
  "Lucid Trading":    "Lucid",
  "Tradeify":         "Tradeify",
  "Topstep":          "Topstep",
  "FundingTicks":     "FTicks",
  "MyFundedFX":       "MFFX",
  "Take Profit Trader": "TPT",
  "Maven Trading":    "Maven",
};

const FIRM_COLOR: Record<string, string> = {
  "Lucid Trading":      "#5b8bbf",
  "Tradeify":           "#9b8ec2",
  "Topstep":            "#c49060",
  "FundingTicks":       "#5aadaa",
  "MyFundedFX":         "#fbbf24",
  "Take Profit Trader": "#c070a0",
  "Maven Trading":      "#4a9a7a",
};
const getFirmColor = (firm: string) => FIRM_COLOR[firm] ?? "#6b7280";

export function FirmAnalyticsChart({
  expenses,
  withdrawals,
}: {
  expenses: Expense[];
  withdrawals: Withdrawal[];
}) {
  const isBW = useBWMode();
  const [sortBy, setSortBy] = useState<"net" | "spent" | "earned">("net");
  const [isCollapsed, setIsCollapsed] = useState(true);

  const firmData = useMemo(() => {
    return FIRMS.map((firm) => {
      const spent  = expenses.filter((e) => e.description === firm).reduce((s, e) => s + toNum(e.amount), 0);
      const earned = withdrawals.filter((w) => w.firm === firm).reduce((s, w) => s + toNum(w.gross), 0);
      const net    = earned - spent;
      const roi    = spent > 0 ? ((earned - spent) / spent) * 100 : null;
      return { firm, short: FIRM_SHORT[firm] ?? firm, spent, earned, net, roi };
    }).filter((f) => f.spent > 0 || f.earned > 0);
  }, [expenses, withdrawals]);

  const sorted = useMemo(() => {
    let data = [...firmData];
    if (isCollapsed) {
      // Show only top 3 firms by net P&L when collapsed
      data = data.sort((a, b) => b.net - a.net).slice(0, 3);
    } else {
      // Show all firms, sorted as selected
      data.sort((a, b) => {
        if (sortBy === "net")    return b.net - a.net;
        if (sortBy === "spent")  return b.spent - a.spent;
        return b.earned - a.earned;
      });
    }
    return data;
  }, [firmData, sortBy, isCollapsed]);

  const maxVal = useMemo(() =>
    Math.max(...sorted.map((f) => Math.max(f.spent, f.earned)), 1),
    [sorted]
  );

  const totalSpentAll = useMemo(
    () => firmData.reduce((s, f) => s + f.spent, 0),
    [firmData]
  );
  const totalEarnedAll = useMemo(
    () => firmData.reduce((s, f) => s + f.earned, 0),
    [firmData]
  );
  const totalNetAll = totalEarnedAll - totalSpentAll;

  if (firmData.length === 0) return null;

  return (
    <div className={cn("card p-5", isBW && "card--parchment-panel")}>
      {/* Header with Collapse/Expand Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="text-tx-4 text-[10px] uppercase tracking-widest font-medium">Firm Analytics</div>
          <div className="text-tx-1 text-sm font-semibold mt-0.5">Performance by Firm</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors"
            style={{
              background: "rgba(var(--surface-rgb),0.06)",
              border: "1px solid rgba(var(--border-rgb),0.12)",
              color: "var(--tx-2)"
            }}
          >
            {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {isCollapsed ? "Show All" : "Show Less"}
          </button>
          {!isCollapsed && (
            <div className="flex items-center gap-1 bg-[rgba(var(--border-rgb),0.04)] rounded-lg p-0.5">
              {(["net", "spent", "earned"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[10px] capitalize transition-colors",
                    sortBy === s ? "font-bold" : "text-tx-3 hover:text-tx-1"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Totals strip — all firms; collapsed mobile = single compact bar */}
      <div
        className={cn(
          "mb-4",
          isCollapsed
            ? "max-sm:flex max-sm:flex-row max-sm:overflow-hidden max-sm:rounded-lg max-sm:border max-sm:border-[rgba(var(--border-rgb),0.1)] max-sm:divide-x max-sm:divide-[rgba(var(--border-rgb),0.1)] max-sm:bg-[rgba(var(--border-rgb),0.02)] sm:grid sm:grid-cols-3 sm:gap-2 sm:rounded-none sm:border-0 sm:divide-x-0 sm:bg-transparent"
            : "grid grid-cols-1 gap-2 sm:grid-cols-3",
        )}
      >
        {([
          { short: "Spent", label: "Total Spent", value: totalSpentAll, cls: "text-loss", showPlus: false },
          { short: "Earned", label: "Total Earned", value: totalEarnedAll, cls: "text-profit", showPlus: false },
          { short: "Net", label: "Net P&L", value: totalNetAll, cls: totalNetAll >= 0 ? "text-profit" : "text-loss", showPlus: true },
        ] as const).map((s) => (
          <div
            key={s.label}
            className={cn(
              "text-center",
              isCollapsed
                ? "max-sm:flex max-sm:flex-1 max-sm:flex-col max-sm:justify-center max-sm:px-1 max-sm:py-1.5 sm:rounded-lg sm:border sm:border-[rgba(var(--border-rgb),0.06)] sm:bg-[rgba(var(--border-rgb),0.03)] sm:p-2.5"
                : "rounded-lg border border-[rgba(var(--border-rgb),0.06)] bg-[rgba(var(--border-rgb),0.03)] p-2.5",
            )}
          >
            <p
              className={cn(
                "text-tx-4 tabular-nums",
                isCollapsed ? "max-sm:text-[8px] max-sm:font-bold max-sm:uppercase max-sm:tracking-wide max-sm:leading-none sm:mb-1 sm:text-[10px]" : "mb-1 text-[10px]",
              )}
            >
              {isCollapsed ? (
                <>
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </>
              ) : (
                s.label
              )}
            </p>
            <p
              className={cn(
                "font-bold tabular-nums font-mono leading-tight",
                s.cls,
                isCollapsed ? "max-sm:text-[11px] sm:text-sm" : "text-sm",
              )}
            >
              {s.showPlus && s.value >= 0 ? "+" : ""}
              {fmtGBP(s.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Firm bar rows — visible on all screens */}
      <div className="flex flex-col gap-2.5">
        {sorted.map((f, i) => {
          const spentPct  = (f.spent  / maxVal) * 100;
          const earnPct   = (f.earned / maxVal) * 100;
          const isProfit  = f.net >= 0;
          const firmCol   = bwColor(getFirmColor(f.firm), isBW);
          return (
            <div key={f.firm} className="flex flex-col gap-1.5 rounded-xl px-3 py-2.5"
              style={{ background: `${firmCol}06`, border: `1px solid ${firmCol}14` }}>
              {/* Row header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black w-4 tabular-nums" style={{ color: firmCol }}>{i + 1}</span>
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: firmCol }} />
                  <span className="text-xs font-semibold text-tx-1">{f.firm}</span>
                  {f.roi !== null && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-bold tabular-nums",
                      f.roi >= 0 ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                    )}>
                      {f.roi >= 0 ? "+" : ""}{f.roi.toFixed(0)}%
                    </span>
                  )}
                </div>
                <span className={cn("text-xs font-bold tabular-nums font-mono", isProfit ? "text-profit" : "text-loss")}>
                  {isProfit ? "+" : ""}{fmtGBP(f.net)}
                </span>
              </div>
              {/* Dual progress bars */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-tx-3 w-10 text-right shrink-0">spent</span>
                  <div className="flex-1 h-1.5 rounded-full rgba(var(--surface-rgb),0.08) overflow-hidden">
                    <div className="h-full rounded-full transition-[width,background] duration-500"
                      style={{ width: `${spentPct}%`, background: "var(--color-loss)" }} />
                  </div>
                  <span className="text-[10px] text-tx-3 tabular-nums font-mono w-16 text-right shrink-0">{fmtGBP(f.spent)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-tx-3 w-10 text-right shrink-0">earned</span>
                  <div className="flex-1 h-1.5 rounded-full rgba(var(--surface-rgb),0.08) overflow-hidden">
                    <div className="h-full rounded-full transition-[width,background] duration-500"
                      style={{ width: `${earnPct}%`, background: `${firmCol}cc` }} />
                  </div>
                  <span className="text-[10px] text-tx-3 tabular-nums font-mono w-16 text-right shrink-0">{fmtGBP(f.earned)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
