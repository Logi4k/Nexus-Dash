import { fmtGBP } from "@/lib/utils";

type DashboardAggregateStripProps = {
  totalIncome: number;
  totalCosts: number;
  totalNet: number;
  profitColor: string;
  lossColor: string;
  bgIncome: string;
  bgCost: string;
  bdrIncome: string;
  bdrCost: string;
};

export function DashboardAggregateStrip({
  totalIncome,
  totalCosts,
  totalNet,
  profitColor,
  lossColor,
  bgIncome,
  bgCost,
  bdrIncome,
  bdrCost,
}: DashboardAggregateStripProps) {
  return (
    <>
      <div className="flex md:hidden items-center gap-1 mb-4 rounded-lg overflow-hidden" style={{ border: `1px solid rgba(var(--border-rgb),0.1)` }}>
        {[
          { label: "Income", value: fmtGBP(totalIncome), color: profitColor, bg: bgIncome },
          { label: "Costs", value: fmtGBP(totalCosts), color: lossColor, bg: bgCost },
          { label: "Net", value: `${totalNet >= 0 ? "+" : ""}${fmtGBP(totalNet)}`, color: totalNet >= 0 ? profitColor : lossColor, bg: totalNet >= 0 ? bgIncome : bgCost },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="flex-1 text-center py-2 px-1.5" style={{ background: bg }}>
            <p className="text-[8px] font-bold uppercase tracking-wider text-tx-4">{label}</p>
            <p className="text-[11px] font-black tabular-nums leading-tight mt-0.5" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
      <div className="hidden md:grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Total Income", value: fmtGBP(totalIncome), color: profitColor, bg: bgIncome, border: bdrIncome },
          { label: "Total Costs", value: fmtGBP(totalCosts), color: lossColor, bg: bgCost, border: bdrCost },
          { label: "Net P&L", value: `${totalNet >= 0 ? "+" : ""}${fmtGBP(totalNet)}`, color: totalNet >= 0 ? profitColor : lossColor, bg: totalNet >= 0 ? bgIncome : bgCost, border: totalNet >= 0 ? bdrIncome : bdrCost },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className="rounded-xl px-3.5 py-2.5" style={{ background: bg, border: `1px solid ${border}` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-tx-4 mb-1">{label}</p>
            <p className="text-base font-black tabular-nums leading-none" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
    </>
  );
}
