import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipRow {
  label: string;
  value: ReactNode;
  toneClassName?: string;
  emphasis?: boolean;
}

interface ChartTooltipCardProps {
  title: string;
  rows: TooltipRow[];
  footer?: TooltipRow;
  minWidth?: number;
}

export function ChartTooltipCard({
  title,
  rows,
  footer,
  minWidth = 150,
}: ChartTooltipCardProps) {
  return (
    <div
      className="rounded-2xl px-3 py-2.5"
      style={{
        minWidth,
        background: "rgba(var(--bg-card-rgb),0.96)",
        border: "1px solid rgba(var(--border-rgb),0.12)",
        boxShadow: "var(--elev-3)",
        backdropFilter: "blur(18px)",
      }}
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-tx-4">{title}</p>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 text-xs">
            <span className={cn(row.emphasis ? "font-semibold text-tx-2" : "text-tx-3")}>{row.label}</span>
            <span className={cn("font-mono font-bold", row.toneClassName)}>{row.value}</span>
          </div>
        ))}
        {footer && (
          <div className="flex items-center justify-between gap-4 border-t border-[rgba(var(--border-rgb),0.08)] pt-1 text-xs">
            <span className={cn(footer.emphasis ? "font-semibold text-tx-2" : "text-tx-3")}>{footer.label}</span>
            <span className={cn("font-mono font-black", footer.toneClassName)}>{footer.value}</span>
          </div>
        )}
      </div>
    </div>
  );
}
