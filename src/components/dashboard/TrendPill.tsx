import { TrendingUp, TrendingDown } from "lucide-react";

// ── Palette constants (semantic – readable on both light and dark) ────────────
const PROFIT = "#22c55e";
const LOSS   = "#f87171";

// ── Trend pill ───────────────────────────────────────────────────────────────
export function TrendPill({ value, suffix = "%" }: { value: number; suffix?: string }) {
  const up = value >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
      style={{
        background: up ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
        color: up ? PROFIT : LOSS,
        border: `1px solid ${up ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      {up ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
      {up ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  );
}
