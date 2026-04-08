import { CheckCircle2, Target, ArrowUpRight } from "lucide-react";
import { fmtUSD } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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
  const isFunded = ["funded", "Funded"].includes(status);
  const color = isFunded ? PROFIT : WARN;
  const label = name || firm;

  return (
    <div
      onClick={onClick}
      className="rounded-xl p-3.5 cursor-pointer group transition-all duration-200"
      style={{
        background: `${color}0a`,
        border: `1px solid ${color}1e`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${color}15`;
        e.currentTarget.style.borderColor = `${color}35`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${color}0a`;
        e.currentTarget.style.borderColor = `${color}1e`;
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
          style={{ color }}
        />
      </div>
      <p
        className="text-[11px] font-medium truncate mb-1"
        style={{ color: `${color}99` }}
      >
        {label}
      </p>
      <p
        className="text-base font-black tabular-nums"
        style={{ color }}
      >
        {fmtUSD(balance)}
      </p>
      <p className="text-[10px] uppercase tracking-widest mt-1 text-tx-3">{type}</p>
    </div>
  );
}
