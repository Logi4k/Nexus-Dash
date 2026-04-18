import { Activity, BarChart3, Target, TrendingUp } from "lucide-react";
import { bwColor } from "@/lib/useBWMode";
import { LOSS, PROFIT } from "@/lib/journal";
import StatCard from "@/components/StatCard";

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

  const neutral = bwColor("#64748b", isBW);
  const blue = bwColor("#5b8bbf", isBW);
  const profitC = bwColor(PROFIT, isBW);
  const lossC = bwColor(LOSS, isBW);

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Trades"
          value={dayStats.total}
          prefix=""
          suffix=""
          decimals={0}
          icon={<BarChart3 size={15} />}
          accentColor={neutral}
          delay={0}
        />
        <StatCard
          label="Win Rate"
          value={dayStats.winRate ?? 0}
          prefix=""
          suffix="%"
          decimals={0}
          renderValue={dayStats.winRate === null ? "—" : undefined}
          icon={<Target size={15} />}
          accentColor={blue}
          delay={60}
        />
        <StatCard
          label="Gross"
          value={dayStats.gross}
          prefix="$"
          decimals={2}
          icon={<TrendingUp size={15} />}
          accentColor={dayStats.gross >= 0 ? profitC : lossC}
          delay={120}
        />
        <StatCard
          label="Net P&L"
          value={dayStats.net}
          prefix="$"
          decimals={2}
          icon={<Activity size={15} />}
          accentColor={dayStats.net >= 0 ? profitC : lossC}
          delay={180}
        />
      </div>
    </div>
  );
}
