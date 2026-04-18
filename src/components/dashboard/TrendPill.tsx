import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Trend pill ───────────────────────────────────────────────────────────────
export function TrendPill({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
        up ? "text-profit" : "text-loss"
      )}
      style={{
        background: up ? "var(--color-profit-bg)" : "var(--color-loss-bg)",
        border: `1px solid ${up ? "var(--color-profit-border)" : "var(--color-loss-border)"}`,
      }}
    >
      {up ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
      {up ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}
