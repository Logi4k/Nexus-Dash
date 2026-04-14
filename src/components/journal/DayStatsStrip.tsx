import { Activity, BarChart3, Target, TrendingUp } from "lucide-react";
import { fmtUSD } from "@/lib/utils";
import { bwColor } from "@/lib/useBWMode";
import { LOSS, PROFIT } from "@/lib/journal";

type DayStatsStripProps = {
  dayStats: {
    total: number;
    winRate: number | null;
    gross: number;
    net: number;
  };
  isBW: boolean;
};

export function DayStatsStrip({ dayStats, isBW }: DayStatsStripProps) {
  if (dayStats.total <= 0) return null;

  const statsItems = [
    { label: "Trades", value: String(dayStats.total), color: "var(--tx-3)", icon: <BarChart3 size={10} />, delay: 0 },
    { label: "Win Rate", value: dayStats.winRate !== null ? `${dayStats.winRate.toFixed(0)}%` : "—", color: bwColor("#5b8bbf", isBW), icon: <Target size={10} />, delay: 60 },
    { label: "Gross", value: fmtUSD(dayStats.gross), color: dayStats.gross >= 0 ? PROFIT : LOSS, icon: <TrendingUp size={10} />, delay: 120 },
    { label: "Net P&L", value: fmtUSD(dayStats.net), color: dayStats.net >= 0 ? PROFIT : LOSS, icon: <Activity size={10} />, delay: 180 },
  ];

  return (
    <>
      <div className="sm:hidden mt-3 pt-3 border-t border-border animate-fade-up">
        <div className="flex items-center justify-center gap-1.5 flex-wrap text-[11px] font-semibold tabular-nums">
          <span style={{ color: "var(--tx-2)" }}>{dayStats.total} trade{dayStats.total !== 1 ? "s" : ""}</span>
          <span className="text-tx-4">·</span>
          <span style={{ color: bwColor("#5b8bbf", isBW) }}>
            {dayStats.winRate !== null ? `${dayStats.winRate.toFixed(0)}% WR` : "—"}
          </span>
          <span className="text-tx-4">·</span>
          <span style={{ color: dayStats.net >= 0 ? PROFIT : LOSS }}>
            {dayStats.net >= 0 ? "+" : ""}{fmtUSD(dayStats.net)} net
          </span>
        </div>
      </div>
      <div className="hidden sm:grid w-full grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-border lg:grid-cols-4">
        {statsItems.map((s) => (
          <div
            key={s.label}
            className="w-full text-center py-3 px-3 rounded-xl min-w-0 animate-fade-up"
            style={{
              background: `${s.color}0d`,
              border: `1px solid ${s.color}25`,
              animationDelay: `${s.delay}ms`,
              animationFillMode: "both",
            }}
          >
            <div className="flex justify-center mb-1" style={{ color: s.color }}>{s.icon}</div>
            <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-sm font-black tabular-nums truncate" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
