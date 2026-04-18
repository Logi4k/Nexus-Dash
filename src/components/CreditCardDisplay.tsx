import { cn, fmtGBP, pct } from "@/lib/utils";
import type { Debt } from "@/types";

interface Props {
  debt: Debt;
  onClick?: () => void;
}

const CARD_THEMES: Record<string, { bg: string; shine: string; network: string }> = {
  barclaycard: {
    bg: "from-[#1a3a6b] via-[#1e4b8f] to-[#0d2a5e]",
    shine: "from-blue-400/20 via-transparent to-transparent",
    network: "VISA",
  },
  "american express": {
    bg: "from-[#1a1a2e] via-[#16213e] to-[#0f3460]",
    shine: "from-slate-300/20 via-transparent to-transparent",
    network: "AMEX",
  },
  amex: {
    bg: "from-[#1a1a2e] via-[#16213e] to-[#0f3460]",
    shine: "from-slate-300/20 via-transparent to-transparent",
    network: "AMEX",
  },
  default: {
    bg: "from-[#1a1a2e] via-[#16213e] to-[#0a0a1a]",
    shine: "from-white/10 via-transparent to-transparent",
    network: "CARD",
  },
};

function getTheme(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("barclaycard") || lower.includes("barclays")) return CARD_THEMES["barclaycard"];
  if (lower.includes("american express") || lower.includes("amex")) return CARD_THEMES["american express"];
  return CARD_THEMES["default"];
}

export default function CreditCardDisplay({ debt, onClick }: Props) {
  const theme = getTheme(debt.name);
  const utilization = pct(debt.currentBalance, debt.creditLimit);
  const available = debt.creditLimit - debt.currentBalance;
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      className={cn("space-y-4 text-left", onClick && "block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)]")}
      onClick={onClick}
      aria-label={onClick ? `Open ${debt.name} debt details` : undefined}
    >
      {/* The card */}
      <div
        className={cn(
          "credit-card w-full max-w-[340px] mx-auto",
          `bg-gradient-to-br ${theme.bg}`
        )}
        style={{ aspectRatio: "85.6/54" }}
      >
        {/* Shine overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-60",
            theme.shine
          )}
        />

        {/* Circles decoration */}
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full border border-[rgba(var(--border-rgb),0.05)]" />
        <div className="absolute -top-2 -right-2 w-20 h-20 rounded-full border border-[rgba(var(--border-rgb),0.08)]" />
        <div className="absolute bottom-8 -left-6 w-24 h-24 rounded-full border border-[rgba(var(--border-rgb),0.05)]" />

        {/* Card content */}
        <div className="absolute inset-0 p-5 flex flex-col justify-between">
          {/* Top row */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-tx-4 text-[10px] uppercase tracking-widest">
                Balance Due
              </div>
              <div className="text-tx-1 font-bold text-xl tabular-nums mt-0.5">
                {fmtGBP(debt.currentBalance)}
              </div>
            </div>
            <div className="chip" />
          </div>

          {/* Card number placeholder */}
          <div className="text-tx-4 font-mono text-sm tracking-widest">
            •••• •••• •••• ••••
          </div>

          {/* Bottom row */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-tx-4 text-[10px] uppercase">Card</div>
              <div className="text-tx-1 text-sm font-semibold">{debt.name}</div>
            </div>
            <div className="text-right">
              <div className="text-tx-4 text-[10px] uppercase">APR</div>
              <div className="text-tx-2 text-sm font-mono">
                {debt.rate}%
              </div>
            </div>
            <div className="text-tx-3 font-bold text-sm">{theme.network}</div>
          </div>
        </div>
      </div>

      {/* Card stats below */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-bg-card rounded-xl p-3 text-center">
          <div className="text-tx-3 text-[10px] uppercase mb-1">Limit</div>
          <div className="font-semibold text-tx-1 text-sm tabular-nums">
            {fmtGBP(debt.creditLimit)}
          </div>
        </div>
        <div className="bg-bg-card rounded-xl p-3 text-center">
          <div className="text-tx-3 text-[10px] uppercase mb-1">Available</div>
          <div className="font-semibold text-profit text-sm tabular-nums">
            {fmtGBP(available)}
          </div>
        </div>
        <div className="bg-bg-card rounded-xl p-3 text-center">
          <div className="text-tx-3 text-[10px] uppercase mb-1">Monthly</div>
          <div className="font-semibold text-warn text-sm tabular-nums">
            {fmtGBP(debt.monthly)}
          </div>
        </div>
      </div>

      {/* Utilization bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-tx-3">Utilization</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              utilization > 80
                ? "text-loss"
                : utilization > 50
                  ? "text-warn"
                  : "text-profit"
            )}
          >
            {utilization.toFixed(1)}%
          </span>
        </div>
        <div className="progress-track h-2">
          <div
            className={cn(
              "progress-fill",
              utilization > 80
                ? "bg-loss"
                : utilization > 50
                  ? "bg-warn"
                  : "bg-profit"
            )}
            style={{ width: `${Math.min(utilization, 100)}%` }}
          />
        </div>
      </div>
    </Wrapper>
  );
}
