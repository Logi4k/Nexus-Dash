import { CheckCircle2, Target, ArrowUpRight } from "lucide-react";
import { fmtUSD } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useBWMode } from "@/lib/useBWMode";

// ── Palette constants (semantic – readable on both light and dark) ────────────
const PROFIT = "#22c55e";
const WARN   = "#d97706";  // amber-600

// ── Account tile ─────────────────────────────────────────────────────────────
export function AccountTile({
  firm, name, status, balance, type, onClick,
}: {
  firm: string; name?: string; status: string; balance: number;
  type: string; onClick: () => void;
}) {
  const isBW = useBWMode();
  const isFunded = ["funded", "Funded"].includes(status);
  const color = isFunded ? PROFIT : WARN;
  const label = name || firm;

  const paper = isBW
    ? isFunded
      ? {
          bg: "color-mix(in srgb, var(--color-profit-bg) 30%, var(--bg-elevated))",
          border: "color-mix(in srgb, var(--color-profit-border) 48%, rgba(var(--border-rgb),0.12))",
          bgHover: "color-mix(in srgb, var(--color-profit-bg) 48%, var(--bg-elevated))",
          borderHover: "var(--color-profit-border)",
          label: "var(--tx-3)",
          balance: "color-mix(in srgb, var(--color-profit) 38%, var(--tx-2))",
          arrow: "color-mix(in srgb, var(--color-profit) 45%, var(--tx-3))",
        }
      : {
          bg: "color-mix(in srgb, var(--color-warn-bg) 30%, var(--bg-elevated))",
          border: "color-mix(in srgb, var(--color-warn-border) 48%, rgba(var(--border-rgb),0.12))",
          bgHover: "color-mix(in srgb, var(--color-warn-bg) 48%, var(--bg-elevated))",
          borderHover: "var(--color-warn-border)",
          label: "var(--tx-3)",
          balance: "color-mix(in srgb, var(--color-warn) 38%, var(--tx-2))",
          arrow: "color-mix(in srgb, var(--color-warn) 45%, var(--tx-3))",
        }
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open ${label} account`}
      className="group rounded-xl p-3.5 text-left transition-[background-color,border-color,transform] duration-200"
      style={
        paper
          ? { background: paper.bg, border: `1px solid ${paper.border}`, width: "100%" }
          : {
              background: `${color}0a`,
              border: `1px solid ${color}1e`,
              width: "100%",
            }
      }
      onMouseEnter={(e) => {
        if (paper) {
          e.currentTarget.style.background = paper.bgHover;
          e.currentTarget.style.borderColor = paper.borderHover;
        } else {
          e.currentTarget.style.background = `${color}15`;
          e.currentTarget.style.borderColor = `${color}35`;
        }
      }}
      onMouseLeave={(e) => {
        if (paper) {
          e.currentTarget.style.background = paper.bg;
          e.currentTarget.style.borderColor = paper.border;
        } else {
          e.currentTarget.style.background = `${color}0a`;
          e.currentTarget.style.borderColor = `${color}1e`;
        }
      }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <Badge variant={isFunded ? "funded" : "challenge"}>
          {isFunded ? <CheckCircle2 size={8} /> : <Target size={8} />}
          {status}
        </Badge>
        <ArrowUpRight
          size={13}
          className="opacity-0 group-hover:opacity-60 transition-opacity"
          style={paper ? { color: paper.arrow } : { color }}
        />
      </div>
      <p
        className="text-[11px] font-medium truncate mb-1"
        style={paper ? { color: paper.label } : { color: `${color}99` }}
      >
        {label}
      </p>
      <p
        className="text-base font-black tabular-nums"
        style={paper ? { color: paper.balance } : { color }}
      >
        {fmtUSD(balance)}
      </p>
      <p className="text-[10px] uppercase tracking-widest mt-1 text-tx-3">{type}</p>
    </button>
  );
}
