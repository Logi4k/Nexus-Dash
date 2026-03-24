import { useState, useMemo, useEffect } from "react";
import { PAGE_THEMES } from "@/lib/theme";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  Shield,
  Target,
  AlertTriangle,
  Edit2,
  Trash2,
  Banknote,
  PoundSterling,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  DollarSign,
  Activity,
  Award,
  Trophy,
} from "lucide-react";
import { useAppData } from "@/lib/store";
import { fmtGBP, fmtUSD, fmtDate, toNum, pct, cn, getStatusBg, generateId } from "@/lib/utils";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import Modal from "@/components/Modal";
import StatCard from "@/components/StatCard";
import type { Account, AccountStatus, Withdrawal, PassedChallenge } from "@/types";
import type { Expense } from "@/types";


/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const FIRMS = [
  "Lucid Trading",
  "Tradeify",
] as const;

type FilterTab = "all" | "funded" | "Challenge" | "Breached";

const isFundedStatus = (s: string) => s === "funded" || s === "Funded";
const isChallengeStatus = (s: string) => s === "Challenge";
const isBreachedStatus = (s: string) => s === "Breached" || s === "breached";

/* ------------------------------------------------------------------ */
/*  Firm Rules Data                                                     */
/* ------------------------------------------------------------------ */

interface PlanRules {
  drawdown: number;
  mll: number;
  dll: number | null;
  profitTarget: number;
  evalConsistency: string;
  fundedConsistency: string;
  maxContracts: string;
  mllLock: number;
  split: string;
  weekend: boolean;
  scalping: string | null;
  minPayoutDays: string;
  minTradingDays: number | null;
}

const PLAN_RULES: Record<string, Record<string, Record<number, PlanRules>>> = {
  "Lucid Trading": {
    flex: {
      25000: {
        drawdown: 1000, mll: 24000, dll: null, profitTarget: 1250,
        evalConsistency: "50% max/day", fundedConsistency: "None",
        maxContracts: "2 minis / 20 micros", mllLock: 25100,
        split: "90/10", weekend: true, scalping: null,
        minPayoutDays: "5 profitable days", minTradingDays: 2,
      },
      50000: {
        drawdown: 2000, mll: 48000, dll: null, profitTarget: 3000,
        evalConsistency: "50% max/day", fundedConsistency: "None",
        maxContracts: "4 minis / 40 micros", mllLock: 50100,
        split: "90/10", weekend: true, scalping: null,
        minPayoutDays: "5 profitable days", minTradingDays: 2,
      },
      100000: {
        drawdown: 3000, mll: 97000, dll: null, profitTarget: 6000,
        evalConsistency: "50% max/day", fundedConsistency: "None",
        maxContracts: "6 minis / 60 micros", mllLock: 100100,
        split: "90/10", weekend: true, scalping: null,
        minPayoutDays: "5 profitable days", minTradingDays: 2,
      },
      150000: {
        drawdown: 4500, mll: 145500, dll: null, profitTarget: 9000,
        evalConsistency: "50% max/day", fundedConsistency: "None",
        maxContracts: "10 minis / 100 micros", mllLock: 150100,
        split: "90/10", weekend: true, scalping: null,
        minPayoutDays: "5 profitable days", minTradingDays: 2,
      },
    },
    pro: {
      25000: {
        drawdown: 1000, mll: 24000, dll: null, profitTarget: 1500,
        evalConsistency: "None", fundedConsistency: "40% max/day",
        maxContracts: "2 minis / 20 micros", mllLock: 24900,
        split: "90/10", weekend: true, scalping: null,
        minPayoutDays: "5 profitable days", minTradingDays: null,
      },
      50000: {
        drawdown: 2000, mll: 48000, dll: 1200, profitTarget: 3000,
        evalConsistency: "None", fundedConsistency: "40% max/day",
        maxContracts: "4 minis / 40 micros", mllLock: 49900,
        split: "90/10", weekend: true, scalping: null,
        minPayoutDays: "5 profitable days", minTradingDays: null,
      },
      100000: {
        drawdown: 3000, mll: 97000, dll: 1800, profitTarget: 6000,
        evalConsistency: "None", fundedConsistency: "40% max/day",
        maxContracts: "6 minis / 60 micros", mllLock: 99900,
        split: "90/10", weekend: true, scalping: null,
        minPayoutDays: "5 profitable days", minTradingDays: null,
      },
      150000: {
        drawdown: 4500, mll: 145500, dll: 2700, profitTarget: 9000,
        evalConsistency: "None", fundedConsistency: "40% max/day",
        maxContracts: "10 minis / 100 micros", mllLock: 149900,
        split: "90/10", weekend: true, scalping: null,
        minPayoutDays: "5 profitable days", minTradingDays: null,
      },
    },
  },
  "Tradeify": {
    growth: {
      50000: {
        drawdown: 2000, mll: 48000, dll: 1250, profitTarget: 3000,
        evalConsistency: "None", fundedConsistency: "35% max/day",
        maxContracts: "4 minis / 40 micros", mllLock: 50100,
        split: "100% first $15K, 90/10 after", weekend: false, scalping: "10-sec hold rule",
        minPayoutDays: "7 days + 5 qualifying days", minTradingDays: null,
      },
      100000: {
        drawdown: 3500, mll: 96500, dll: 2500, profitTarget: 6000,
        evalConsistency: "None", fundedConsistency: "35% max/day",
        maxContracts: "8 minis / 80 micros", mllLock: 100100,
        split: "100% first $15K, 90/10 after", weekend: false, scalping: "10-sec hold rule",
        minPayoutDays: "7 days + 5 qualifying days", minTradingDays: null,
      },
      150000: {
        drawdown: 5000, mll: 145000, dll: 3750, profitTarget: 9000,
        evalConsistency: "None", fundedConsistency: "35% max/day",
        maxContracts: "12 minis / 120 micros", mllLock: 150100,
        split: "100% first $15K, 90/10 after", weekend: false, scalping: "10-sec hold rule",
        minPayoutDays: "7 days + 5 qualifying days", minTradingDays: null,
      },
    },
    "select-flex": {
      50000: {
        drawdown: 2000, mll: 48000, dll: null, profitTarget: 2500,
        evalConsistency: "40% max/day", fundedConsistency: "None",
        maxContracts: "4 minis / 40 micros", mllLock: 50100,
        split: "90/10", weekend: false, scalping: "10-sec hold rule",
        minPayoutDays: "5 winning days", minTradingDays: 3,
      },
      100000: {
        drawdown: 3000, mll: 97000, dll: null, profitTarget: 5000,
        evalConsistency: "40% max/day", fundedConsistency: "None",
        maxContracts: "8 minis / 80 micros", mllLock: 100100,
        split: "90/10", weekend: false, scalping: "10-sec hold rule",
        minPayoutDays: "5 winning days", minTradingDays: 3,
      },
      150000: {
        drawdown: 4500, mll: 145500, dll: null, profitTarget: 7500,
        evalConsistency: "40% max/day", fundedConsistency: "None",
        maxContracts: "12 minis / 120 micros", mllLock: 150100,
        split: "90/10", weekend: false, scalping: "10-sec hold rule",
        minPayoutDays: "5 winning days", minTradingDays: 3,
      },
    },
  },
};

const FIRM_PLANS: Record<string, { value: string; label: string }[]> = {
  "Lucid Trading": [
    { value: "flex", label: "LucidFlex" },
    { value: "pro",  label: "LucidPro"  },
  ],
  "Tradeify": [
    { value: "growth",      label: "Growth"      },
    { value: "select-flex", label: "Select Flex" },
  ],
};

const PLAN_SIZES_BY_FIRM: Record<string, Record<string, number[]>> = {
  "Lucid Trading": {
    flex: [25000, 50000, 100000, 150000],
    pro:  [25000, 50000, 100000, 150000],
  },
  "Tradeify": {
    growth:       [50000, 100000, 150000],
    "select-flex": [50000, 100000, 150000],
  },
};

const PLAN_LABELS: Record<string, string> = {
  flex:         "LucidFlex",
  pro:          "LucidPro",
  growth:       "Growth",
  "select-flex": "Select Flex",
};

function parsePlanInfo(firm: string, type: string): { plan: string; size: number } | null {
  if (!type) return null;
  const t = type.toLowerCase().replace(/\s+/g, "");

  // Detect size: 25, 50, 100, 150 (with or without K/k)
  const sizeMatch = t.match(/(150|100|50|25)k?/i);
  if (!sizeMatch) return null;
  const raw = parseInt(sizeMatch[1]);
  const size = raw < 1000 ? raw * 1000 : raw;

  let plan: string | null = null;
  if (firm === "Lucid Trading") {
    if (t.includes("lucidpro") || (t.includes("pro") && !t.includes("flex"))) plan = "pro";
    else if (t.includes("flex")) plan = "flex";
  } else if (firm === "Tradeify") {
    if (t.includes("selectflex") || t.includes("select")) plan = "select-flex";
    else if (t.includes("growth")) plan = "growth";
  }

  if (!plan) return null;
  if (!PLAN_RULES[firm]?.[plan]?.[size]) return null;
  return { plan, size };
}

function getRules(firm: string, type: string): PlanRules | null {
  const info = parsePlanInfo(firm, type);
  if (!info) return null;
  return PLAN_RULES[firm]?.[info.plan]?.[info.size] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Empty form factories                                               */
/* ------------------------------------------------------------------ */

const emptyAccountForm = () => {
  const firm      = FIRMS[0] as string; // "Lucid Trading"
  const firstPlan = FIRM_PLANS[firm]?.[0]?.value ?? "";
  const sizes     = PLAN_SIZES_BY_FIRM[firm]?.[firstPlan] ?? [];
  const firstSz   = sizes[0];
  const rules     = firstPlan && firstSz ? PLAN_RULES[firm]?.[firstPlan]?.[firstSz] : null;
  const label     = PLAN_LABELS[firstPlan] ?? firstPlan;
  return {
    firm,
    planKey:        firstPlan,
    planSize:       firstSz ? String(firstSz) : "",
    type:           firstPlan && firstSz ? `${label} ${firstSz / 1000}K` : "",
    name:           "",
    status:         "Challenge" as AccountStatus,
    balance:        "",
    initialBalance: firstSz ? String(firstSz) : "",   // pre-fill & lock to plan size
    sodBalance:     "",
    mll:            rules ? String(rules.mll) : "",
    notes:          "",
    customFirm:     "",
  };
};

const emptyPayoutForm = (firm?: string, accountId?: string) => ({
  firm:      firm ?? (FIRMS[0] as string),
  date:      new Date().toISOString().slice(0, 10),
  gross:     "",
  accountId: accountId ?? "",
  notes: "",
});

/* ------------------------------------------------------------------ */
/*  Firm Analytics Chart                                               */
/* ------------------------------------------------------------------ */

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
  "Lucid Trading":      "#3b82f6",
  "Tradeify":           "#8b5cf6",
  "Topstep":            "#f97316",
  "FundingTicks":       "#1dd4b4",
  "MyFundedFX":         "#f59e0b",
  "Take Profit Trader": "#ec4899",
  "Maven Trading":      "#22c55e",
};
const getFirmColor = (firm: string) => FIRM_COLOR[firm] ?? "#6b7280";

function FirmAnalyticsChart({
  expenses,
  withdrawals,
}: {
  expenses: Expense[];
  withdrawals: Withdrawal[];
}) {
  const bw = useBWMode();
  const [sortBy, setSortBy] = useState<"net" | "spent" | "earned">("net");

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
    return [...firmData].sort((a, b) => {
      if (sortBy === "net")    return b.net - a.net;
      if (sortBy === "spent")  return b.spent - a.spent;
      return b.earned - a.earned;
    });
  }, [firmData, sortBy]);

  const maxVal = useMemo(() =>
    Math.max(...firmData.map((f) => Math.max(f.spent, f.earned)), 1),
    [firmData]
  );

  const totalSpent  = firmData.reduce((s, f) => s + f.spent,  0);
  const totalEarned = firmData.reduce((s, f) => s + f.earned, 0);
  const totalNet    = totalEarned - totalSpent;

  if (firmData.length === 0) return null;

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-tx-4 text-[10px] uppercase tracking-widest font-medium">Firm Analytics</div>
          <div className="text-tx-1 text-sm font-semibold mt-0.5">Performance by Firm</div>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-0.5">
          {(["net", "spent", "earned"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={cn(
                "text-[10px] px-2.5 py-1 rounded-md capitalize transition-all",
                sortBy === s ? "bg-white/90 text-bg-base font-bold" : "text-tx-3 hover:text-tx-1"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Total Spent",  value: totalSpent,  cls: "text-loss" },
          { label: "Total Earned", value: totalEarned, cls: "text-profit" },
          { label: "Net P&L",      value: totalNet,    cls: totalNet >= 0 ? "text-profit" : "text-loss" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg p-2.5 bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-[10px] text-tx-4 mb-1">{s.label}</p>
            <p className={cn("text-sm font-bold tabular-nums font-mono", s.cls)}>
              {s.value >= 0 && s.label === "Net P&L" ? "+" : ""}{fmtGBP(s.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Firm rows */}
      <div className="flex flex-col gap-2.5">
        {sorted.map((f, i) => {
          const spentPct  = (f.spent  / maxVal) * 100;
          const earnPct   = (f.earned / maxVal) * 100;
          const isProfit  = f.net >= 0;
          const firmCol   = bwColor(getFirmColor(f.firm), bw);
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
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${spentPct}%`, background: "#ef4444aa" }} />
                  </div>
                  <span className="text-[10px] text-tx-3 tabular-nums font-mono w-16 text-right shrink-0">{fmtGBP(f.spent)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-tx-3 w-10 text-right shrink-0">earned</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
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

/* ------------------------------------------------------------------ */
/*  Trading Insights Sidebar                                           */
/* ------------------------------------------------------------------ */

function TradingInsightsSidebar({
  expenses,
  withdrawals,
  accounts,
  passedChallenges,
}: {
  expenses: Expense[];
  withdrawals: Withdrawal[];
  accounts: Account[];
  passedChallenges: PassedChallenge[];
}) {
  const bw = useBWMode();
  const [taxRate, setTaxRate] = useState(20);
  const firmData = useMemo(() => FIRMS.map((firm) => {
    const spent  = expenses.filter((e) => e.description === firm).reduce((s, e) => s + toNum(e.amount), 0);
    const earned = withdrawals.filter((w) => w.firm === firm).reduce((s, w) => s + toNum(w.gross), 0);
    return { firm, spent, earned, net: earned - spent, roi: spent > 0 ? ((earned - spent) / spent) * 100 : 0 };
  }).filter((f) => f.spent > 0 || f.earned > 0).sort((a, b) => b.net - a.net), [expenses, withdrawals]);

  const totalSpent  = firmData.reduce((s, f) => s + f.spent, 0);
  const totalEarned = firmData.reduce((s, f) => s + f.earned, 0);

  const funded    = accounts.filter((a) => isFundedStatus(a.status)).length;
  const challenge = accounts.filter((a) => isChallengeStatus(a.status)).length;
  const breached  = accounts.filter((a) => isBreachedStatus(a.status)).length;
  const total     = accounts.length;

  const recentPayouts = [...withdrawals].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const avgPayout     = withdrawals.length > 0
    ? withdrawals.reduce((s, w) => s + toNum(w.gross), 0) / withdrawals.length
    : 0;
  const bestPayout    = withdrawals.reduce((m, w) => toNum(w.gross) > m ? toNum(w.gross) : m, 0);

  // Pass rate: funded / (funded + breached) if we have history
  const passRate = (funded + breached) > 0 ? (funded / (funded + breached)) * 100 : null;

  // Monthly payout sparkline (last 6 months)
  const monthlySparkData = useMemo(() => {
    const byMonth: Record<string, number> = {};
    withdrawals.forEach((w) => {
      const key = w.date.slice(0, 7);
      byMonth[key] = (byMonth[key] ?? 0) + toNum(w.gross);
    });
    const keys = Object.keys(byMonth).sort().slice(-6);
    return keys.length >= 2 ? keys.map((k) => byMonth[k]) : null;
  }, [withdrawals]);

  return (
    <div className="flex flex-col gap-4">

      {/* ROI Overview */}
      {(() => {
        const net = totalEarned - totalSpent;
        const roiPct = totalSpent > 0 ? (net / totalSpent) * 100 : 0;
        const isPos = net >= 0;
        return (
          <div className="card p-4 overflow-hidden relative"
            style={{
              background: isPos
                ? "linear-gradient(135deg, rgba(34,197,94,0.07) 0%, transparent 60%)"
                : "linear-gradient(135deg, rgba(239,68,68,0.07) 0%, transparent 60%)",
              borderColor: isPos ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
            }}
          >
            {/* Big background ROI % watermark */}
            <div className="absolute right-2 top-1 text-[52px] font-black tabular-nums select-none pointer-events-none"
              style={{ color: isPos ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)", lineHeight: 1 }}
            >
              {roiPct >= 0 ? "+" : ""}{roiPct.toFixed(0)}%
            </div>

            <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-2">Overall ROI</p>

            {/* Net P&L prominent */}
            <div className={cn("text-[26px] font-black tabular-nums leading-none mb-1", isPos ? "text-profit" : "text-loss")}>
              {isPos ? "+" : ""}{fmtGBP(net)}
            </div>

            {/* ROI % badge */}
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: isPos ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                  color: isPos ? "#4ade80" : "#f87171",
                  border: `1px solid ${isPos ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                }}
              >
                {roiPct >= 0 ? "+" : ""}{roiPct.toFixed(1)}% ROI
              </span>
              {totalSpent > 0 && (
                <span className="text-[10px] text-tx-4">{withdrawals.length} payouts</span>
              )}
            </div>

            {/* Spent vs Earned row */}
            <div className="flex items-center justify-between text-xs mb-2">
              <div>
                <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-0.5">Invested</p>
                <p className="text-loss font-bold tabular-nums">{fmtGBP(totalSpent)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-0.5">Earned</p>
                <p className="text-profit font-bold tabular-nums">{fmtGBP(totalEarned)}</p>
              </div>
            </div>

            {/* Progress bar */}
            {totalSpent > 0 && (
              <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06]">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", isPos ? "bg-profit" : "bg-loss")}
                  style={{ width: `${Math.min((totalEarned / Math.max(totalSpent, totalEarned)) * 100, 100)}%` }}
                />
              </div>
            )}

            {/* Monthly payout sparkline */}
            {monthlySparkData && monthlySparkData.length >= 2 && (() => {
              const W = 200, H = 32;
              const mn = Math.min(...monthlySparkData);
              const mx = Math.max(...monthlySparkData);
              const rng = mx - mn || 1;
              const pts = monthlySparkData.map((v, i) => [
                (i / (monthlySparkData.length - 1)) * W,
                H - 4 - ((v - mn) / rng) * (H - 8),
              ]);
              const sparkColor = isPos ? "#22c55e" : "#ef4444";
              const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
              const area = `${line} L ${W} ${H} L 0 ${H} Z`;
              return (
                <div className="mt-3">
                  <div className="text-[10px] text-tx-3 uppercase tracking-wider mb-1">Monthly Payouts</div>
                  <div className="relative" style={{ height: H }}>
                    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="payout-spark-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={sparkColor} stopOpacity="0.2" />
                          <stop offset="100%" stopColor={sparkColor} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={area} fill="url(#payout-spark-grad)" />
                      <path d={line} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx={pts[pts.length-1][0].toFixed(1)} cy={pts[pts.length-1][1].toFixed(1)} r="2.5" fill={sparkColor} />
                    </svg>
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Challenge Record */}
      {(() => {
        const passes = passedChallenges.length;
        const fails  = accounts.filter((a) => isBreachedStatus(a.status)).length;
        const total  = passes + fails;
        const rate   = total > 0 ? (passes / total) * 100 : null;

        const firmRows = FIRMS.map((firm) => {
          const p = passedChallenges.filter((c) => c.firm === firm).length;
          const f = accounts.filter((a) => a.firm === firm && isBreachedStatus(a.status)).length;
          return { firm, p, f, t: p + f };
        }).filter((r) => r.t > 0).sort((a, b) => b.t - a.t);

        return (
          <div className="card p-4 overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.05) 0%, transparent 60%)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <Trophy size={13} className="text-amber-400 shrink-0" />
              <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium">Challenge Record</p>
            </div>

            {/* Overall */}
            <div className="flex items-end justify-between mb-1">
              <div>
                <span className="text-[22px] font-black tabular-nums leading-none"
                  style={{ color: rate !== null && rate >= 50 ? "#fbbf24" : rate !== null ? "#f87171" : undefined }}>
                  {rate !== null ? `${rate.toFixed(0)}%` : "No data"}
                </span>
                {total > 0 && (
                  <p className="text-[10px] text-tx-4 mt-0.5">{passes} passed · {fails} failed</p>
                )}
              </div>
              {rate !== null && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mb-1"
                  style={{
                    background: rate >= 50 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.1)",
                    color: rate >= 50 ? "#fbbf24" : "#f87171",
                    border: `1px solid ${rate >= 50 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.2)"}`,
                  }}>
                  {passes}/{total}
                </span>
              )}
            </div>

            {rate !== null && (
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${rate}%`, background: rate >= 50 ? "#f59e0b" : "#ef4444" }} />
              </div>
            )}

            {/* Per-firm breakdown */}
            {firmRows.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-1">By Firm</p>
                {firmRows.map((r) => {
                  const firmRate = r.t > 0 ? (r.p / r.t) * 100 : 0;
                  return (
                    <div key={r.firm} className="flex items-center gap-2 text-[11px]">
                      <span className="text-tx-2 truncate flex-1 min-w-0">{r.firm}</span>
                      <span className="text-profit tabular-nums font-mono shrink-0">{r.p}✓</span>
                      <span className="text-loss tabular-nums font-mono shrink-0">{r.f}✗</span>
                      <span className="tabular-nums font-mono shrink-0 w-9 text-right"
                        style={{ color: firmRate >= 50 ? "#fbbf24" : "#f87171" }}>
                        {firmRate.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {total === 0 && (
              <p className="text-[10px] text-tx-4">No challenge history yet.</p>
            )}
          </div>
        );
      })()}

      {/* Payout Tax Estimator */}
      {withdrawals.length > 0 && (() => {
        const totalGross   = withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
        const estimatedTax = totalGross * (taxRate / 100);
        const netAfterTax  = totalGross - estimatedTax;
        return (
          <div className="card p-4"
            style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.05) 0%, transparent 60%)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <PoundSterling size={13} className="text-purple-400 shrink-0" />
              <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium">Tax Estimate</p>
            </div>

            {/* Total gross */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-tx-3">Total Gross</span>
              <span className="text-sm font-bold tabular-nums font-mono text-tx-1">{fmtGBP(totalGross)}</span>
            </div>

            {/* Tax rate input */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-tx-3 flex-1">Tax Rate</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Math.min(60, Math.max(0, Number(e.target.value))))}
                  className="nx-input w-14 text-right text-sm py-0.5 px-2 [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                />
                <span className="text-[11px] text-tx-3">%</span>
              </div>
            </div>

            <div className="h-px mb-3" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Estimated tax */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-tx-3">Estimated Tax</span>
              <span className="text-sm font-bold tabular-nums font-mono text-loss">−{fmtGBP(estimatedTax)}</span>
            </div>

            {/* Net after tax */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-tx-3">Net After Tax</span>
              <span className="text-sm font-bold tabular-nums font-mono text-profit">{fmtGBP(netAfterTax)}</span>
            </div>

            <p className="text-[10px] text-tx-3">Estimate only. Consult a tax advisor.</p>
          </div>
        );
      })()}

      {/* Payout stats */}
      {withdrawals.length > 0 && (
        <div className="card p-4">
          <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3">Payout Stats</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg p-2.5 text-center"
              style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
              <p className="text-[10px] text-tx-4">Count</p>
              <p className="text-base font-bold text-tx-1">{withdrawals.length}</p>
            </div>
            <div className="rounded-lg p-2.5 text-center"
              style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
              <p className="text-[10px] text-tx-4">Avg</p>
              <p className="text-sm font-bold text-profit tabular-nums font-mono">{fmtGBP(avgPayout)}</p>
            </div>
            <div className="col-span-2 rounded-lg p-2.5 text-center"
              style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
              <p className="text-[10px] text-tx-4">Best Payout</p>
              <p className="text-lg font-bold text-profit tabular-nums font-mono">{fmtGBP(bestPayout)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Challenge pass rate */}
      {passRate !== null && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-tx-3 font-medium">Challenge Pass Rate</span>
            <span className="text-sm font-bold px-2.5 py-1 rounded-lg tabular-nums"
              style={{
                background: passRate >= 50 ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                color: passRate >= 50 ? "#4ade80" : "#fbbf24",
                border: `1px solid ${passRate >= 50 ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
              }}>
              {passRate.toFixed(0)}%
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${passRate}%`, background: passRate >= 50 ? "#22c55e" : "#f59e0b" }} />
          </div>
          <p className="text-[10px] text-tx-3 mt-1">{funded} funded · {breached} breached</p>
        </div>
      )}

      {/* Empty state */}
      {withdrawals.length === 0 && firmData.length === 0 && (
        <div className="card p-4 text-center text-tx-4 text-xs">
          <p>Add accounts and record payouts to see insights here.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rules Reference Panel                                              */
/* ------------------------------------------------------------------ */

function RulesReferencePanel() {
  const [open, setOpen] = useState(false);
  const [firmTab, setFirmTab] = useState<"Lucid Trading" | "Tradeify">("Lucid Trading");
  const [planTab, setPlanTab] = useState<string>("flex");

  // When firm tab changes, reset plan tab to first available
  const availablePlans = FIRM_PLANS[firmTab] ?? [];
  const activePlan = availablePlans.some((p) => p.value === planTab) ? planTab : availablePlans[0]?.value ?? "";
  const availableSizes = PLAN_SIZES_BY_FIRM[firmTab]?.[activePlan] ?? [];

  const RuleRow = ({
    label,
    children,
    highlight,
  }: {
    label: string;
    children: React.ReactNode;
    highlight?: "good" | "warn" | "bad" | "neutral";
  }) => (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-tx-3 text-xs">{label}</span>
      <span
        className={cn(
          "text-xs font-medium",
          highlight === "good" ? "text-profit" :
          highlight === "warn" ? "text-warn" :
          highlight === "bad"  ? "text-loss"  : "text-tx-2"
        )}
      >
        {children}
      </span>
    </div>
  );

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-accent" />
          <span className="text-sm font-semibold text-tx-1">Firm Rules Reference</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: "rgba(var(--surface-rgb),0.08)", color: "var(--tx-2)", border: "1px solid rgba(var(--border-rgb),0.15)" }}
          >
            Lucid · Tradeify
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-tx-3" /> : <ChevronDown size={14} className="text-tx-3" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.06]">
          {/* Firm tabs */}
          <div className="flex px-5 pt-4 gap-1 border-b border-white/[0.06] pb-0">
            {(["Lucid Trading", "Tradeify"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFirmTab(f);
                  setPlanTab(FIRM_PLANS[f]?.[0]?.value ?? "");
                }}
                className={cn(
                  "px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-all",
                  firmTab === f
                    ? "text-accent border-accent bg-accent/5"
                    : "text-tx-3 border-transparent hover:text-tx-2"
                )}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Plan tabs */}
          <div className="flex gap-1 px-5 pt-3">
            {availablePlans.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlanTab(p.value)}
                className={cn(
                  "tab-pill",
                  activePlan === p.value && "active"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Size columns */}
          <div className={cn("grid gap-4 p-5", availableSizes.length === 4 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
            {availableSizes.map((size) => {
              const r = PLAN_RULES[firmTab]?.[activePlan]?.[size];
              if (!r) return null;
              const planLabel = PLAN_LABELS[activePlan] ?? activePlan;
              return (
                <div
                  key={size}
                  className="rounded-xl p-4"
                  style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
                >
                  <div className="text-tx-1 font-bold text-sm mb-0.5">
                    ${(size / 1000).toFixed(0)}K {planLabel}
                  </div>
                  <div className="text-tx-3 text-[10px] mb-3">
                    {firmTab === "Lucid Trading" ? "EOD Trailing" : "EOD Trailing (hard intraday)"}
                  </div>

                  <RuleRow label="EOD Drawdown" highlight="neutral">
                    ${r.drawdown.toLocaleString()}
                  </RuleRow>
                  <RuleRow label="Initial MLL" highlight="neutral">
                    ${r.mll.toLocaleString()}
                  </RuleRow>
                  <RuleRow label="MLL Locks at" highlight="neutral">
                    ${r.mllLock.toLocaleString()}
                  </RuleRow>
                  <RuleRow label="Daily Loss Limit" highlight={r.dll ? "warn" : "good"}>
                    {r.dll ? `$${r.dll.toLocaleString()}` : "None"}
                  </RuleRow>
                  <RuleRow label="Profit Target" highlight="neutral">
                    ${r.profitTarget.toLocaleString()}
                  </RuleRow>
                  <RuleRow label="Eval Consistency" highlight={r.evalConsistency === "None" ? "good" : "warn"}>
                    {r.evalConsistency}
                  </RuleRow>
                  <RuleRow label="Funded Consistency" highlight={r.fundedConsistency === "None" ? "good" : "warn"}>
                    {r.fundedConsistency}
                  </RuleRow>
                  <RuleRow label="Max Contracts" highlight="neutral">
                    {r.maxContracts}
                  </RuleRow>
                  <RuleRow label="Profit Split" highlight="neutral">
                    {r.split}
                  </RuleRow>
                  <RuleRow label="Weekend Holding" highlight={r.weekend ? "good" : "warn"}>
                    {r.weekend ? "✓ Allowed" : "✗ Not allowed"}
                  </RuleRow>
                  {r.scalping && (
                    <RuleRow label="Scalping Rule" highlight="warn">
                      {r.scalping}
                    </RuleRow>
                  )}
                  <RuleRow label="Payout Requirement" highlight="neutral">
                    {r.minPayoutDays}
                  </RuleRow>
                  {r.minTradingDays && (
                    <RuleRow label="Min Trading Days" highlight="neutral">
                      {r.minTradingDays} days
                    </RuleRow>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="px-5 pb-4 text-tx-3 text-[10px]">
            * All amounts shown in USD. MLL updates at end-of-day (EOD) and trails upward with equity.
            {firmTab === "Tradeify" && " Tradeify drawdown is a hard intraday breach — account fails instantly if balance touches the MLL floor."}
            {firmTab === "Lucid Trading" && " Payouts on LucidFlex do not affect the MLL. Positions must close by 4:45 PM ET daily."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Account Card Rules Mini-Panel                                      */
/* ------------------------------------------------------------------ */

function AccountRulesPanel({ firm, type, status }: { firm: string; type: string; status: string }) {
  const rules = useMemo(() => getRules(firm, type), [firm, type]);
  const info   = useMemo(() => parsePlanInfo(firm, type), [firm, type]);
  const [open, setOpen] = useState(false);

  if (!rules || !info) return null;
  const funded    = isFundedStatus(status);
  const challenge = isChallengeStatus(status);

  const RuleChip = ({
    label, value, ok,
  }: {
    label: string; value: string; ok?: boolean | null;
  }) => (
    <div
      className="flex items-center justify-between gap-2 text-[10px]"
    >
      <span className="text-tx-4">{label}</span>
      <span
        className={cn(
          "font-medium",
          ok === true  ? "text-profit" :
          ok === false ? "text-warn"   : "text-tx-3"
        )}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="border-t border-white/[0.04] pt-2.5 mt-1">
      <button
        className="flex items-center gap-1.5 text-[10px] text-tx-3 hover:text-tx-2 transition-colors w-full"
        onClick={() => setOpen((p) => !p)}
      >
        <BookOpen size={10} />
        <span>Account Rules — {PLAN_LABELS[info.plan]} ${(info.size / 1000).toFixed(0)}K</span>
        {open ? <ChevronUp size={10} className="ml-auto" /> : <ChevronDown size={10} className="ml-auto" />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg px-3 py-2.5" style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
          <RuleChip label="EOD Drawdown" value={`$${rules.drawdown.toLocaleString()}`} />
          <RuleChip label="MLL Floor" value={`$${rules.mll.toLocaleString()}`} />
          <RuleChip label="MLL Lock" value={`$${rules.mllLock.toLocaleString()}`} />
          <RuleChip
            label="Daily Loss Limit"
            value={rules.dll ? `$${rules.dll.toLocaleString()}` : "None"}
            ok={rules.dll === null}
          />
          {challenge && (
            <>
              <RuleChip label="Profit Target" value={`$${rules.profitTarget.toLocaleString()}`} />
              <RuleChip
                label="Eval Consistency"
                value={rules.evalConsistency}
                ok={rules.evalConsistency === "None" ? true : null}
              />
              {rules.minTradingDays && (
                <RuleChip label="Min Days" value={`${rules.minTradingDays} days`} />
              )}
            </>
          )}
          {funded && (
            <>
              <RuleChip
                label="Funded Consistency"
                value={rules.fundedConsistency}
                ok={rules.fundedConsistency === "None" ? true : null}
              />
              <RuleChip label="Payout" value={rules.minPayoutDays} />
              <RuleChip label="Split" value={rules.split} />
            </>
          )}
          <RuleChip label="Max Contracts" value={rules.maxContracts} />
          <RuleChip label="Weekend Holding" value={rules.weekend ? "✓ Allowed" : "✗ Not allowed"} ok={rules.weekend ? true : false} />
          {rules.scalping && (
            <RuleChip label="Scalping" value={rules.scalping} ok={false} />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Account Card                                                       */
/* ------------------------------------------------------------------ */

function DrawdownMeter({ ratio, label, sublabel }: { ratio: number; label: string; sublabel: string }) {
  const segments = 20;
  const filled = Math.round((ratio / 100) * segments);
  const color = ratio > 50 ? "#22c55e" : ratio > 20 ? "#f59e0b" : "#ef4444";
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] text-tx-3 uppercase tracking-wider font-medium">{label}</span>
        <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{sublabel}</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-300"
            style={{
              height: 6,
              background: i < filled
                ? (i < 4 ? "#ef4444" : i < 8 ? "#f59e0b" : "#22c55e")
                : "rgba(var(--border-rgb,255,255,255),0.08)",
              opacity: i < filled ? 1 : 0.4,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[10px] text-tx-3">Danger</span>
        <span className="text-[10px] text-tx-3">Safe</span>
      </div>
    </div>
  );
}

function AccountCard({
  account,
  onEdit,
  onDelete,
  onPayout,
}: {
  account: Account;
  onEdit: () => void;
  onDelete: () => void;
  onPayout: () => void;
}) {
  const bw = useBWMode();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const funded    = isFundedStatus(account.status);
  const challenge = isChallengeStatus(account.status);
  const breached  = isBreachedStatus(account.status);

  const mllProgress = useMemo(() => {
    if (!funded || !account.mll || !account.balance) return null;
    const bal  = toNum(account.balance);
    const mll  = toNum(account.mll);
    const init = toNum(account.initialBalance ?? 0);
    const buffer    = bal - mll;
    const maxBuffer = init ? init - mll : bal * 0.1;
    const ratio = (buffer / Math.max(maxBuffer, 1)) * 100;
    return { buffer, ratio: Math.max(0, Math.min(ratio, 100)) };
  }, [funded, account.mll, account.balance, account.initialBalance]);

  // Use actual profit target from PLAN_RULES, fallback to 10% of initial balance
  const acctRules = useMemo(() => getRules(account.firm, account.type), [account.firm, account.type]);
  const profitTarget = acctRules?.profitTarget ?? (account.initialBalance ? toNum(account.initialBalance) * 0.10 : null);

  const challengeProgress = useMemo(() => {
    if (!challenge || !account.initialBalance) return null;
    const equity = toNum(account.balance) - toNum(account.initialBalance);
    const target = profitTarget ?? toNum(account.initialBalance) * 0.10;
    const progress = target > 0 ? Math.max(0, Math.min((equity / target) * 100, 100)) : 0;
    return { equity, target, progress };
  }, [challenge, account.balance, account.initialBalance, profitTarget]);

  const displayName = account.name || account.type || "—";
  const hasRules    = !!(account.firm === "Lucid Trading" || account.firm === "Tradeify");

  const statusColor = funded ? "#22c55e" : challenge ? "#f59e0b" : "#ef4444";
  const statusBg    = funded ? "rgba(34,197,94,0.06)" : challenge ? "rgba(245,158,11,0.06)" : "rgba(239,68,68,0.04)";
  const firmColor   = bwColor(getFirmColor(account.firm), bw);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl flex flex-col gap-0",
        breached && "opacity-60"
      )}
      style={{
        background: statusBg,
        border: `1px solid ${statusColor}20`,
        boxShadow: `0 2px 12px ${statusColor}08`,
      }}
    >
      {/* Colored left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-full" style={{ background: statusColor }} />

      {/* Firm color top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, ${firmColor}80, transparent)` }} />

      {/* Header */}
      <div className="pl-4 pr-3 pt-3.5 pb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={cn("badge text-[10px]", getStatusBg(account.status))}>{account.status}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: `${firmColor}15`, color: firmColor, border: `1px solid ${firmColor}30` }}>
              {FIRM_SHORT[account.firm] ?? account.firm.split(" ")[0]}
            </span>
          </div>
          <div className="text-tx-1 text-sm font-bold leading-tight truncate">{account.firm}</div>
          <div className="text-tx-4 text-[10px] mt-0.5 truncate">{displayName}</div>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
          {!breached && (
            <>
              {funded && (
                <button onClick={onPayout} className="p-1.5 rounded-lg transition-all text-tx-3 hover:text-profit"
                  title="Record Payout">
                  <PoundSterling size={12} />
                </button>
              )}
              <button onClick={onEdit} className="p-1.5 rounded-lg transition-all text-tx-3 hover:text-tx-1"
                title="Edit">
                <Edit2 size={12} />
              </button>
            </>
          )}
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg transition-all text-tx-3 hover:text-loss"
              title="Delete">
              <Trash2 size={12} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={() => { setConfirmDelete(false); onDelete(); }}
                className="px-2 py-1 rounded text-[10px] font-semibold transition-all"
                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                Confirm
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded text-[10px] font-semibold transition-all"
                style={{ background: "rgba(var(--surface-rgb),0.07)", color: "var(--tx-3)" }}>
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Balance + mini stats */}
      <div className="pl-4 pr-3 pb-3">
        <div className={cn("text-2xl font-black tabular-nums mb-2", breached ? "text-tx-4" : "text-tx-1")}>
          {fmtUSD(toNum(account.balance))}
        </div>

        {/* Stats row */}
        {account.initialBalance && !breached && (
          <div className="flex gap-3 mb-3">
            {(() => {
              const equity = toNum(account.balance) - toNum(account.initialBalance);
              const epct   = pct(equity, toNum(account.initialBalance));
              return (
                <>
                  <div>
                    <p className="text-[10px] text-tx-3 uppercase tracking-wider">P&L</p>
                    <p className="text-[11px] font-bold tabular-nums" style={{ color: equity >= 0 ? "#22c55e" : "#ef4444" }}>
                      {equity >= 0 ? "+" : ""}{fmtUSD(equity)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-tx-3 uppercase tracking-wider">% Change</p>
                    <p className="text-[11px] font-bold tabular-nums" style={{ color: equity >= 0 ? "#22c55e" : "#ef4444" }}>
                      {epct >= 0 ? "+" : ""}{epct.toFixed(1)}%
                    </p>
                  </div>
                  {account.mll && (
                    <div>
                      <p className="text-[10px] text-tx-3 uppercase tracking-wider">MLL</p>
                      <p className="text-[11px] font-bold tabular-nums text-tx-3">{fmtUSD(account.mll)}</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Drawdown meter for funded accounts */}
        {funded && mllProgress !== null && (
          <DrawdownMeter
            ratio={mllProgress.ratio}
            label="Drawdown Buffer"
            sublabel={`${fmtUSD(mllProgress.buffer)} · ${mllProgress.ratio.toFixed(0)}% safe`}
          />
        )}

        {/* Challenge profit target progress */}
        {challengeProgress && (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] text-tx-4 uppercase tracking-wider font-medium">Profit Target</span>
              <span className="text-[10px] font-bold tabular-nums font-mono" style={{ color: challengeProgress.equity >= 0 ? "#22c55e" : "#ef4444" }}>
                {challengeProgress.equity >= 0 ? "+" : ""}{fmtUSD(challengeProgress.equity)} / {fmtUSD(challengeProgress.target)}
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden relative" style={{ background: "rgba(var(--border-rgb,255,255,255),0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${challengeProgress.progress}%`,
                  background: challengeProgress.equity >= 0
                    ? "linear-gradient(90deg,#16a34a,#22c55e,#4ade80)"
                    : "linear-gradient(90deg,#dc2626,#ef4444)",
                }}
              />
              <div className="absolute right-0 top-0 bottom-0 w-0.5" style={{ background: "rgba(var(--border-rgb,255,255,255),0.25)" }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-tx-3">Start</span>
              <span className="text-[10px] text-tx-3">{challengeProgress.progress.toFixed(0)}% complete</span>
            </div>
          </div>
        )}

        {/* Breached note */}
        {breached && account.initialBalance && (
          <div className="flex items-center gap-1.5 mt-1">
            <XCircle size={11} style={{ color: "#ef4444" }} />
            <span className="text-[11px] font-medium" style={{ color: "#f87171" }}>Account breached · Cost: {fmtUSD(toNum(account.initialBalance))}</span>
          </div>
        )}

        {/* Notes */}
        {account.notes && (
          <div className="text-tx-4 text-[10px] leading-relaxed border-t mt-2 pt-2" style={{ borderColor: "rgba(var(--border-rgb,255,255,255),0.06)" }}>
            {account.notes}
          </div>
        )}

        {/* Rules mini-panel — funded accounts only */}
        {hasRules && funded && !breached && (
          <AccountRulesPanel firm={account.firm} type={account.type} status={account.status} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PropAccounts() {
  const { data, update } = useAppData();
  const location = useLocation();
  const navigate = useNavigate();

  const [tab, setTab] = useState<FilterTab>("Challenge");
  const [addOpen, setAddOpen] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);

  useEffect(() => {
    const action = (location.state as { action?: string } | null)?.action;
    if (action === "addAccount") {
      setAddOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (action === "logPayout") {
      setPayoutOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = useState(emptyAccountForm());
  const [payoutForm, setPayoutForm] = useState(emptyPayoutForm());
  const [sortBy, setSortBy] = useState<"status" | "balance-desc" | "balance-asc" | "firm">("status");
  const [editPayoutId, setEditPayoutId] = useState<string | null>(null);
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null);
  const [editChallengeId, setEditChallengeId] = useState<string | null>(null);
  const [deleteChallengeConfirm, setDeleteChallengeConfirm] = useState<string | null>(null);

  /* ---- Page theme + filter state ---- */
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.prop, isBW);
  const [filters, setFilters] = useState({ status: "all", sort: "balance" });

  /* ---- Detect if selected firm has plan rules ---- */
  const firmHasPlans = !!FIRM_PLANS[form.firm];
  const availablePlans = FIRM_PLANS[form.firm] ?? [];
  const activePlanKey  = availablePlans.some((p) => p.value === form.planKey)
    ? form.planKey
    : availablePlans[0]?.value ?? "";
  const availablePlanSizes = PLAN_SIZES_BY_FIRM[form.firm]?.[activePlanKey] ?? [];

  /* ---- Auto-fill MLL + initialBalance when plan + size are set ---- */
  function handlePlanKeyChange(planKey: string) {
    const sizes = PLAN_SIZES_BY_FIRM[form.firm]?.[planKey] ?? [];
    const sz    = form.planSize && sizes.includes(Number(form.planSize)) ? Number(form.planSize) : sizes[0];
    const rules = PLAN_RULES[form.firm]?.[planKey]?.[sz];
    const label = PLAN_LABELS[planKey] ?? planKey;
    setForm((p) => ({
      ...p,
      planKey,
      planSize:       sz ? String(sz) : "",
      type:           sz ? `${label} ${sz / 1000}K` : label,
      mll:            rules ? String(rules.mll) : p.mll,
      initialBalance: sz ? String(sz) : p.initialBalance,
    }));
  }

  function handlePlanSizeChange(sizeStr: string) {
    const sz    = Number(sizeStr);
    const rules = PLAN_RULES[form.firm]?.[activePlanKey]?.[sz];
    const label = PLAN_LABELS[activePlanKey] ?? activePlanKey;
    setForm((p) => ({
      ...p,
      planSize:       sizeStr,
      type:           sz ? `${label} ${sz / 1000}K` : p.type,
      mll:            rules ? String(rules.mll) : p.mll,
      initialBalance: sizeStr,   // lock initial balance to plan size
    }));
  }

  function handleFirmChange(firm: string) {
    const plans     = FIRM_PLANS[firm] ?? [];
    const firstPlan = plans[0]?.value ?? "";
    const sizes     = PLAN_SIZES_BY_FIRM[firm]?.[firstPlan] ?? [];
    const firstSz   = sizes[0];
    const rules     = PLAN_RULES[firm]?.[firstPlan]?.[firstSz];
    const label     = PLAN_LABELS[firstPlan] ?? firstPlan;
    setForm((p) => ({
      ...p,
      firm,
      customFirm:     "",
      planKey:        firstPlan,
      planSize:       firstSz ? String(firstSz) : "",
      type:           firstPlan && firstSz ? `${label} ${firstSz / 1000}K` : "",
      mll:            rules ? String(rules.mll) : "",
      initialBalance: firstSz ? String(firstSz) : "",
    }));
  }

  /* ---- Counts ---- */
  const counts = useMemo(() => {
    const a = data.accounts;
    return {
      all:      a.length,
      funded:   a.filter((x) => isFundedStatus(x.status)).length,
      challenge: a.filter((x) => isChallengeStatus(x.status)).length,
      breached: a.filter((x) => isBreachedStatus(x.status)).length,
    };
  }, [data.accounts]);

  /* ---- Net P&L ---- */
  const netPnL = useMemo(() => {
    const totalWithdrawals = data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
    const totalExpenses    = data.expenses.reduce((s, e) => s + toNum(e.amount), 0);
    return totalWithdrawals - totalExpenses;
  }, [data.withdrawals, data.expenses]);

  /* ---- Filtered + sorted accounts ---- */
  const filtered = useMemo(() => {
    let base = data.accounts;
    if (tab === "funded")    base = data.accounts.filter((a) => isFundedStatus(a.status));
    else if (tab === "Challenge") base = data.accounts.filter((a) => isChallengeStatus(a.status));
    else if (tab === "Breached")  base = data.accounts.filter((a) => isBreachedStatus(a.status));

    // Apply FilterBar status filter
    if (filters.status !== "all") {
      base = base.filter((a) => a.status.toLowerCase() === filters.status);
    }

    const arr = [...base];
    const statusOrder = (s: string) => isFundedStatus(s) ? 0 : isChallengeStatus(s) ? 1 : 2;
    switch (sortBy) {
      case "status":
        return arr.sort((a, b) => {
          const d = statusOrder(a.status) - statusOrder(b.status);
          return d !== 0 ? d : toNum(b.balance) - toNum(a.balance);
        });
      case "balance-desc": return arr.sort((a, b) => toNum(b.balance) - toNum(a.balance));
      case "balance-asc":  return arr.sort((a, b) => toNum(a.balance) - toNum(b.balance));
      case "firm":         return arr.sort((a, b) => a.firm.localeCompare(b.firm) || b.balance - a.balance);
      default: return arr;
    }
  }, [data.accounts, tab, sortBy, filters.status]);

  /* ---- Withdrawals total ---- */
  const totalWithdrawals = useMemo(
    () => data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0),
    [data.withdrawals]
  );

  /* ---- Save account ---- */
  const handleSaveAccount = () => {
    if (!form.balance) return;
    const firmName = form.firm === "__other__" ? form.customFirm.trim() : form.firm;
    if (!firmName) return;
    const bal     = parseFloat(form.balance);
    const initBal = form.initialBalance ? parseFloat(form.initialBalance) : bal;
    const sodBal  = form.sodBalance ? parseFloat(form.sodBalance) : bal;
    const mll     = form.mll ? parseFloat(form.mll) : undefined;

    // Auto-promote: if saving a Challenge account whose balance has reached the profit target,
    // automatically set status to Funded and record the pass in history.
    let finalStatus: AccountStatus = form.status;
    let passRecord: import("@/types").PassedChallenge | null = null;

    if (isChallengeStatus(form.status)) {
      const planRules = getRules(firmName, form.type);
      const target = planRules?.profitTarget ?? (initBal * 0.10);
      const equity = bal - initBal;
      if (equity >= target) {
        finalStatus = "Funded";
        passRecord = {
          id:             generateId(),
          firm:           firmName,
          type:           form.type,
          name:           form.name || undefined,
          passedDate:     new Date().toISOString().slice(0, 10),
          finalBalance:   bal,
          initialBalance: initBal,
          profitTarget:   target,
        };
      }
    }

    if (editAccount) {
      update((prev) => {
        const updatedAccounts = prev.accounts.map((a) =>
          a.id === editAccount.id
            ? { ...a, firm: firmName, type: form.type, name: form.name || undefined, status: finalStatus, balance: bal, initialBalance: initBal, sodBalance: sodBal, mll, notes: form.notes || undefined }
            : a
        );
        return passRecord
          ? { ...prev, accounts: updatedAccounts, passedChallenges: [...(prev.passedChallenges ?? []), passRecord] }
          : { ...prev, accounts: updatedAccounts };
      });
    } else {
      const qty = Math.max(1, Math.min(addQty, 50));
      const newAccounts: Account[] = Array.from({ length: qty }, () => ({
        id:             generateId(),
        firm:           firmName,
        type:           form.type,
        name:           form.name || undefined,
        status:         form.status,
        balance:        bal,
        initialBalance: initBal,
        sodBalance:     sodBal,
        mll,
        notes:          form.notes || undefined,
        pnlHistory:     [],
      }));
      update((prev) => ({ ...prev, accounts: [...newAccounts, ...prev.accounts] }));
    }

    setAddOpen(false);
    setAddQty(1);
    setEditAccount(null);
    setForm(emptyAccountForm());
  };


  /* ---- Open edit ---- */
  const handleOpenEdit = (account: Account) => {
    setEditAccount(account);
    const info = parsePlanInfo(account.firm, account.type);
    setForm({
      firm:           account.firm,
      planKey:        info?.plan ?? "",
      planSize:       info ? String(info.size) : "",
      type:           account.type,
      name:           account.name ?? "",
      status:         account.status,
      balance:        String(account.balance),
      initialBalance: account.initialBalance ? String(account.initialBalance) : "",
      sodBalance:     account.sodBalance ? String(account.sodBalance) : "",
      mll:            account.mll ? String(account.mll) : "",
      notes:          account.notes ?? "",
      customFirm:     "",
    });
    setAddOpen(true);
  };

  /* ---- Delete account ---- */
  const handleDelete = (id: string) => {
    update((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }));
  };

  /* ---- Edit passed challenge ---- */
  const handleSaveChallenge = (patch: Partial<import("@/types").PassedChallenge>) => {
    if (!editChallengeId) return;
    update((prev) => ({
      ...prev,
      passedChallenges: (prev.passedChallenges ?? []).map((c) =>
        c.id === editChallengeId ? { ...c, ...patch } : c
      ),
    }));
    setEditChallengeId(null);
  };

  /* ---- Delete passed challenge ---- */
  const handleDeleteChallenge = (id: string) => {
    update((prev) => ({
      ...prev,
      passedChallenges: (prev.passedChallenges ?? []).filter((c) => c.id !== id),
    }));
    setDeleteChallengeConfirm(null);
  };

  /* ---- Save payout (add or edit) — also deducts from linked account balance ---- */
  const handleSavePayout = () => {
    if (!payoutForm.gross) return;
    const grossAmt = parseFloat(payoutForm.gross);
    if (editPayoutId) {
      const oldW     = data.withdrawals.find((w) => w.id === editPayoutId);
      const oldGross = oldW ? toNum(oldW.gross) : 0;
      const diff     = grossAmt - oldGross;
      update((prev) => {
        const updatedWithdrawals = prev.withdrawals.map((w) =>
          w.id === editPayoutId
            ? { ...w, date: payoutForm.date, firm: payoutForm.firm, gross: grossAmt, notes: payoutForm.notes || undefined }
            : w
        );
        const updatedAccounts = payoutForm.accountId && diff !== 0
          ? prev.accounts.map((a) =>
              a.id === payoutForm.accountId
                ? { ...a, balance: Math.max(0, toNum(a.balance) - diff) }
                : a
            )
          : prev.accounts;
        return { ...prev, withdrawals: updatedWithdrawals, accounts: updatedAccounts };
      });
    } else {
      const w: Withdrawal = {
        id:    generateId(),
        date:  payoutForm.date,
        firm:  payoutForm.firm,
        gross: grossAmt,
        notes: payoutForm.notes || undefined,
      };
      update((prev) => ({
        ...prev,
        withdrawals: [w, ...prev.withdrawals],
        // Deduct payout from linked funded account balance
        accounts: payoutForm.accountId
          ? prev.accounts.map((a) =>
              a.id === payoutForm.accountId
                ? { ...a, balance: Math.max(0, toNum(a.balance) - grossAmt) }
                : a
            )
          : prev.accounts,
      }));
    }
    setPayoutOpen(false);
    setEditPayoutId(null);
    setPayoutForm(emptyPayoutForm());
  };

  /* ---- Delete payout ---- */
  const handleDeletePayout = (id: string) => {
    update((prev) => ({ ...prev, withdrawals: prev.withdrawals.filter((w) => w.id !== id) }));
    setDeletingPayoutId(null);
  };

  const openPayout = (firm?: string, accountId?: string) => {
    setEditPayoutId(null);
    setPayoutForm(emptyPayoutForm(firm, accountId));
    setPayoutOpen(true);
  };

  const openEditPayout = (w: Withdrawal) => {
    setEditPayoutId(w.id);
    setPayoutForm({ firm: w.firm, date: w.date, gross: String(w.gross), notes: w.notes ?? "", accountId: "" });
    setPayoutOpen(true);
  };

  /* ---- Tab config ---- */
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",       label: "All",       count: counts.all       },
    { key: "funded",    label: "Funded",    count: counts.funded    },
    { key: "Challenge", label: "Challenge", count: counts.challenge  },
    { key: "Breached",  label: "Breached",  count: counts.breached  },
  ];

  /* ---- Preview rules for selected plan in modal ---- */
  const modalRules = useMemo(() => {
    if (!firmHasPlans || !activePlanKey || !form.planSize) return null;
    return PLAN_RULES[form.firm]?.[activePlanKey]?.[Number(form.planSize)] ?? null;
  }, [firmHasPlans, form.firm, activePlanKey, form.planSize]);

  return (
    <div className="space-y-5 w-full page-enter">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Prop</div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="page-title">Prop Accounts</h1>
          <div className="flex items-center gap-2">
            <button className="btn-success btn" onClick={() => openPayout()}>
              <Banknote size={14} />
              Record Payout
            </button>
            <button
              className="btn-primary btn"
              onClick={() => {
                setEditAccount(null);
                setForm(emptyAccountForm());
                setAddOpen(true);
              }}
            >
              <Plus size={14} />
              Add Account
            </button>
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      {(() => {
        const fundedCapital = data.accounts
          .filter((a) => isFundedStatus(a.status))
          .reduce((s, a) => s + (parseFloat(String(a.balance)) || 0), 0);
        const totalPayouts = data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
        return (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Active Funded"    value={counts.funded}    prefix="" suffix="" decimals={0} icon={<Shield size={15} className="text-profit" />}      accentColor="#22c55e" delay={0}   />
            <StatCard label="Active Challenges" value={counts.challenge} prefix="" suffix="" decimals={0} icon={<Target size={15} className="text-warn" />}         accentColor="#f59e0b" delay={60}  />
            <StatCard label="Total Breached"   value={counts.breached}  prefix="" suffix="" decimals={0} icon={<AlertTriangle size={15} className="text-loss" />}   accentColor="#ef4444" delay={120} />
            <StatCard label="Funded Capital"   value={fundedCapital}                                     icon={<DollarSign size={15} className="text-profit" />}    accentColor="#22c55e" delay={150} />
            <StatCard label="Total Payouts"    value={totalPayouts}                                      icon={<Award size={15} className={netPnL >= 0 ? "text-profit" : "text-loss"} />} accentColor={netPnL >= 0 ? "#22c55e" : "#ef4444"} delay={180} />
          </div>
        );
      })()}

      {/* Rules Reference Panel */}
      <RulesReferencePanel />

      {/* Two-column layout: main content + insights sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── Left: Analytics + Accounts + History ── */}
        <div className="flex flex-col gap-5">

          {/* Firm Analytics */}
          <FirmAnalyticsChart expenses={data.expenses} withdrawals={data.withdrawals} />

          {/* Filter tabs + sort controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {tabs.map(({ key, label, count }) => (
                <button key={key} onClick={() => setTab(key)} className={cn("tab-pill", tab === key && "active")}>
                  {label}{" "}
                  <span className={cn("ml-1 text-[10px]", tab === key ? "opacity-70" : "opacity-40")}>({count})</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-tx-4 text-[10px] uppercase tracking-wider">Sort</span>
              <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "rgba(var(--surface-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
                {([
                  { key: "status"       as const, label: "Status"    },
                  { key: "balance-desc" as const, label: "Bal ↓"     },
                  { key: "balance-asc"  as const, label: "Bal ↑"     },
                  { key: "firm"         as const, label: "Firm"       },
                ]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150",
                      sortBy === key
                        ? "bg-white/90 text-bg-base shadow-sm"
                        : "text-tx-3 hover:text-tx-1"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="text-tx-4 text-[10px]">{filtered.length} accounts</span>
            </div>
          </div>

          {/* Account cards grid */}
          <div className={cn(
            "grid gap-3",
            tab === "Challenge"
              ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
              : "grid-cols-1 md:grid-cols-2"
          )}>
            {filtered.map((account, i) => (
              <div key={account.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i * 30, 180)}ms`, animationFillMode: "both" }}>
                <AccountCard
                  account={account}
                  onEdit={() => handleOpenEdit(account)}
                  onDelete={() => handleDelete(account.id)}
                  onPayout={() => openPayout(account.firm, account.id)}
                />
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-16 text-center text-tx-3 text-sm">No accounts match this filter.</div>
            )}
          </div>

          {/* Payout History */}
          {data.withdrawals.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-tx-3 text-[10px] uppercase tracking-wider font-medium">Payout History</div>
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-tx-4" />
                  <span className="text-[11px] font-bold text-profit tabular-nums">+{fmtGBP(totalWithdrawals)}</span>
                  <span className="text-tx-4 text-[10px]">{data.withdrawals.length} payouts</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 md:hidden">
                {(() => {
                  const sorted = [...data.withdrawals].sort((a, b) => b.date.localeCompare(a.date));
                  const maxPayout = Math.max(...sorted.map((w) => toNum(w.gross)));
                  const chronological = [...sorted].reverse();
                  const runningMap: Record<string, number> = {};
                  let running = 0;
                  for (const w of chronological) {
                    running += toNum(w.gross);
                    runningMap[w.id] = running;
                  }
                  return sorted.map((w, idx) => {
                    const wFirmCol = bwColor(getFirmColor(w.firm), isBW);
                    const amount = toNum(w.gross);
                    const isTop = amount === maxPayout;
                    const isFirst = idx === sorted.length - 1;
                    const runningTotal = runningMap[w.id] ?? 0;
                    return (
                      <div
                        key={w.id}
                        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                        style={{ background: isTop ? "rgba(34,197,94,0.04)" : undefined }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs text-tx-2">
                              {isTop && <span className="text-[10px]">Top</span>}
                              {isFirst && !isTop && <span className="text-[10px]">First</span>}
                              <span className="font-mono tabular-nums">{fmtDate(w.date)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wFirmCol }} />
                              <span className="text-sm font-medium text-tx-1 break-words">{w.firm}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {deletingPayoutId === w.id ? (
                              <>
                                <button
                                  onClick={() => handleDeletePayout(w.id)}
                                  className="px-2 py-1 rounded text-[10px] font-semibold bg-loss/15 text-loss hover:bg-loss/25 transition-all"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeletingPayoutId(null)}
                                  className="px-2 py-1 rounded text-[10px] font-semibold bg-white/[0.05] text-tx-3 hover:text-tx-1 transition-all"
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEditPayout(w)}
                                  className="p-1.5 rounded text-tx-3 hover:text-tx-1 hover:bg-white/[0.07] transition-all"
                                  title="Edit payout"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => setDeletingPayoutId(w.id)}
                                  className="p-1.5 rounded text-tx-3 hover:text-loss hover:bg-loss/10 transition-all"
                                  title="Delete payout"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-tx-4">Amount</p>
                            <p className="mt-1 font-bold font-mono tabular-nums text-profit">+{fmtGBP(amount)}</p>
                          </div>
                          <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-tx-4">Running</p>
                            <p className="mt-1 font-mono tabular-nums text-tx-3">{fmtGBP(runningTotal)}</p>
                          </div>
                          <div className="col-span-2 rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                            <p className="text-[10px] uppercase tracking-wide text-tx-4">Notes</p>
                            <p className="mt-1 text-tx-3 break-words">{w.notes ?? "-"}</p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Date</th>
                      <th className="text-left text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Firm</th>
                      <th className="text-right text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Amount</th>
                      <th className="text-right text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Running</th>
                      <th className="text-left text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Notes</th>
                      <th className="text-right text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {(() => {
                      const sorted = [...data.withdrawals].sort((a, b) => b.date.localeCompare(a.date));
                      const maxPayout = Math.max(...sorted.map((w) => toNum(w.gross)));
                      // Compute running totals from oldest → newest, then reverse for display
                      const chronological = [...sorted].reverse();
                      const runningMap: Record<string, number> = {};
                      let running = 0;
                      for (const w of chronological) {
                        running += toNum(w.gross);
                        runningMap[w.id] = running;
                      }
                      return sorted.map((w, idx) => {
                        const wFirmCol = bwColor(getFirmColor(w.firm), isBW);
                        const amount = toNum(w.gross);
                        const isTop = amount === maxPayout;
                        const isFirst = idx === sorted.length - 1;
                        const runningTotal = runningMap[w.id] ?? 0;
                        return (
                          <tr key={w.id} className="group transition-colors"
                            style={{ background: isTop ? "rgba(34,197,94,0.04)" : undefined }}>
                            <td className="py-2.5 pr-4 text-tx-2 font-mono tabular-nums text-xs">
                              <div className="flex items-center gap-1.5">
                                {isTop && <span className="text-[10px]">🏆</span>}
                                {isFirst && !isTop && <span className="text-[10px]">🥇</span>}
                                {fmtDate(w.date)}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wFirmCol }} />
                                <span className="text-tx-1 font-medium text-xs">{w.firm}</span>
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 font-bold font-mono tabular-nums text-right"
                              style={{ color: isTop ? "#4ade80" : "#22c55e" }}>
                              +{fmtGBP(amount)}
                            </td>
                            <td className="py-2.5 pr-4 text-[11px] font-mono tabular-nums text-right text-tx-3">
                              {fmtGBP(runningTotal)}
                            </td>
                            <td className="py-2.5 pr-4 text-tx-3 text-xs">{w.notes ?? "—"}</td>
                            <td className="py-2.5 text-right">
                              {deletingPayoutId === w.id ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleDeletePayout(w.id)}
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-loss/15 text-loss hover:bg-loss/25 transition-all"
                                  >Confirm</button>
                                  <button
                                    onClick={() => setDeletingPayoutId(null)}
                                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/[0.05] text-tx-3 hover:text-tx-1 transition-all"
                                  >No</button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-all">
                                  <button
                                    onClick={() => openEditPayout(w)}
                                    className="p-1.5 rounded text-tx-3 hover:text-tx-1 hover:bg-white/[0.07] transition-all"
                                    title="Edit payout"
                                  ><Edit2 size={11} /></button>
                                  <button
                                    onClick={() => setDeletingPayoutId(w.id)}
                                    className="p-1.5 rounded text-tx-3 hover:text-loss hover:bg-loss/10 transition-all"
                                    title="Delete payout"
                                  ><Trash2 size={11} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/[0.08]">
                      <td colSpan={2} className="pt-3 text-tx-3 text-xs font-medium">Total</td>
                      <td className="pt-3 text-right text-profit font-bold font-mono tabular-nums">+{fmtGBP(totalWithdrawals)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {/* Passed Challenge History */}
          {(data.passedChallenges ?? []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-tx-4 text-[10px] uppercase tracking-widest font-medium">Challenge Journey</div>
                  <div className="text-tx-1 text-sm font-semibold mt-0.5">Passed Challenges</div>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-warn" />
                  <span className="text-[11px] font-bold text-warn tabular-nums">{data.passedChallenges!.length} passed</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {[...(data.passedChallenges ?? [])].sort((a, b) => b.passedDate.localeCompare(a.passedDate)).map((c) => {
                  const firmCol = bwColor(getFirmColor(c.firm), isBW);
                  const profit  = c.finalBalance - c.initialBalance;
                  const isDeleting = deleteChallengeConfirm === c.id;
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl group transition-all"
                      style={{ background: `${firmCol}08`, border: `1px solid ${isDeleting ? "#ef444430" : `${firmCol}18`}` }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: `${firmCol}20` }}>
                        <CheckCircle2 size={13} style={{ color: firmCol }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-tx-1">{c.firm}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: `${firmCol}15`, color: firmCol, border: `1px solid ${firmCol}28` }}>
                            {c.type}
                          </span>
                          {c.name && <span className="text-[10px] text-tx-3">{c.name}</span>}
                        </div>
                        <div className="text-[10px] text-tx-3 mt-0.5">Passed {fmtDate(c.passedDate)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-bold font-mono tabular-nums text-profit">
                          +{fmtUSD(profit)}
                        </div>
                        <div className="text-[10px] text-tx-3 font-mono">of {fmtUSD(c.profitTarget)} target</div>
                      </div>
                      {/* Actions */}
                      {isDeleting ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDeleteChallenge(c.id)}
                            className="text-[10px] px-2 py-1 rounded font-semibold transition-all"
                            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                          >Delete</button>
                          <button
                            onClick={() => setDeleteChallengeConfirm(null)}
                            className="text-[10px] px-2 py-1 rounded font-semibold transition-all text-tx-3 hover:text-tx-1"
                            style={{ background: "rgba(var(--surface-rgb),0.07)" }}
                          >Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditChallengeId(c.id)}
                            className="p-1.5 rounded hover:bg-white/[0.07] text-tx-3 hover:text-tx-1 transition-all"
                            title="Edit"
                          ><Edit2 size={11} /></button>
                          <button
                            onClick={() => setDeleteChallengeConfirm(c.id)}
                            className="p-1.5 rounded hover:bg-loss/10 text-tx-4 hover:text-loss transition-all"
                            title="Delete"
                          ><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Right: Trading Insights Sidebar ── */}
        <div className="xl:sticky xl:top-6">
          <TradingInsightsSidebar
            expenses={data.expenses}
            withdrawals={data.withdrawals}
            accounts={data.accounts}
            passedChallenges={data.passedChallenges ?? []}
          />
        </div>

      </div>

      {/* ── Add / Edit Account Modal ─────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditAccount(null); setAddQty(1); }}
        title={editAccount ? "Edit Account" : "Add Account"}
        size="md"
      >
        <div className="space-y-3">
          {(
            <div className="space-y-3">
              {/* Firm + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Firm</label>
                  <select className="nx-select" value={form.firm} onChange={(e) => handleFirmChange(e.target.value)}>
                    {FIRMS.map((f) => <option key={f} value={f}>{f}</option>)}
                    <option value="__other__">Other…</option>
                  </select>
                  {form.firm === "__other__" && (
                    <input
                      className="nx-input mt-1.5"
                      placeholder="Enter firm name…"
                      value={form.customFirm}
                      onChange={(e) => setForm((p) => ({ ...p, customFirm: e.target.value }))}
                      autoFocus
                    />
                  )}
                </div>
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Status</label>
                  <select className="nx-select" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as AccountStatus }))}>
                    <option value="Challenge">Challenge</option>
                    <option value="Funded">Funded</option>
                    <option value="Breached">Breached</option>
                  </select>
                </div>
              </div>

              {/* Plan selects (Lucid / Tradeify only) */}
              {firmHasPlans ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-tx-3 text-xs block mb-1">Plan</label>
                    <select
                      className="nx-select"
                      value={activePlanKey}
                      onChange={(e) => handlePlanKeyChange(e.target.value)}
                    >
                      {availablePlans.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-tx-3 text-xs block mb-1">Account Size</label>
                    <select
                      className="nx-select"
                      value={form.planSize}
                      onChange={(e) => handlePlanSizeChange(e.target.value)}
                    >
                      {availablePlanSizes.map((sz) => (
                        <option key={sz} value={sz}>${(sz / 1000).toFixed(0)}K</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Account Type</label>
                  <input className="nx-input" placeholder="e.g. 50K Flex" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
                </div>
              )}

              {/* Balance */}
              <div>
                <label className="text-tx-3 text-xs block mb-1">Current Balance ($)</label>
                <input className="nx-input" type="number" placeholder="50000" value={form.balance} onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))} />
              </div>

              {!editAccount && (
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Quantity <span className="opacity-50 text-[10px]">(add multiple at once)</span></label>
                  <input
                    className="nx-input"
                    type="number"
                    min={1}
                    max={50}
                    value={addQty}
                    onChange={(e) => setAddQty(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button className="btn-primary btn flex-1" onClick={handleSaveAccount}>
                  {editAccount ? "Update Account" : addQty > 1 ? `Add ${addQty} Accounts` : "Add Account"}
                </button>
                <button className="btn-ghost btn" onClick={() => { setAddOpen(false); setEditAccount(null); setAddQty(1); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Record / Edit Payout Modal ─────────────────────────────── */}
      <Modal
        open={payoutOpen}
        onClose={() => { setPayoutOpen(false); setEditPayoutId(null); setPayoutForm(emptyPayoutForm()); }}
        title={editPayoutId ? "Edit Payout" : "Record Payout"}
        size="sm"
      >
        <div className="space-y-3">
          {/* Linked account info banner */}
          {payoutForm.accountId && (() => {
            const linkedAcc = data.accounts.find((a) => a.id === payoutForm.accountId);
            if (!linkedAcc) return null;
            const col = bwColor(getFirmColor(linkedAcc.firm), isBW);
            return (
              <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: `${col}10`, border: `1px solid ${col}22` }}>
                <CheckCircle2 size={12} style={{ color: col }} />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-tx-1">{linkedAcc.firm}</span>
                  <span className="text-[10px] text-tx-4 ml-1.5">{linkedAcc.name || linkedAcc.type}</span>
                </div>
                <span className="text-[10px] text-tx-4">
                  Balance: <span className="font-mono font-semibold text-tx-2">{fmtUSD(toNum(linkedAcc.balance))}</span>
                </span>
              </div>
            );
          })()}
          <div>
            <label className="text-tx-3 text-xs block mb-1">Firm</label>
            <select className="nx-select" value={payoutForm.firm} onChange={(e) => setPayoutForm((p) => ({ ...p, firm: e.target.value }))}>
              {FIRMS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Date</label>
            <input className="nx-input" type="date" value={payoutForm.date} onChange={(e) => setPayoutForm((p) => ({ ...p, date: e.target.value }))} />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">
              Gross Amount (£)
              {payoutForm.accountId && <span className="text-[10px] text-tx-3 ml-1.5">— will deduct from account balance</span>}
            </label>
            <input className="nx-input" type="number" placeholder="0.00" value={payoutForm.gross} onChange={(e) => setPayoutForm((p) => ({ ...p, gross: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <button className="btn-success btn flex-1" onClick={handleSavePayout}>
              <Banknote size={14} />
              {editPayoutId ? "Update Payout" : "Save Payout"}
            </button>
            <button className="btn-ghost btn" onClick={() => { setPayoutOpen(false); setEditPayoutId(null); setPayoutForm(emptyPayoutForm()); }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Passed Challenge Modal ─────────────────────────────── */}
      {editChallengeId && (() => {
        const ch = (data.passedChallenges ?? []).find((c) => c.id === editChallengeId);
        if (!ch) return null;
        return (
          <EditChallengeModal
            challenge={ch}
            onClose={() => setEditChallengeId(null)}
            onSave={handleSaveChallenge}
          />
        );
      })()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit Challenge Modal                                               */
/* ------------------------------------------------------------------ */

function EditChallengeModal({
  challenge, onClose, onSave,
}: {
  challenge: import("@/types").PassedChallenge;
  onClose: () => void;
  onSave: (patch: Partial<import("@/types").PassedChallenge>) => void;
}) {
  const [firm, setFirm] = useState(challenge.firm);
  const [type, setType] = useState(challenge.type);
  const [name, setName] = useState(challenge.name ?? "");
  const [passedDate, setPassedDate] = useState(challenge.passedDate);
  const [finalBalance, setFinalBalance] = useState(String(challenge.finalBalance));
  const [initialBalance, setInitialBalance] = useState(String(challenge.initialBalance));
  const [profitTarget, setProfitTarget] = useState(String(challenge.profitTarget));

  function handleSave() {
    onSave({
      firm, type, name: name || undefined,
      passedDate,
      finalBalance: parseFloat(finalBalance) || 0,
      initialBalance: parseFloat(initialBalance) || 0,
      profitTarget: parseFloat(profitTarget) || 0,
    });
  }

  return (
    <Modal open onClose={onClose} title="Edit Passed Challenge" size="md">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-tx-3 text-xs block mb-1">Firm</label>
          <select className="nx-select" value={firm} onChange={(e) => setFirm(e.target.value)}>
            {FIRMS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Type / Plan</label>
          <input className="nx-input" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Evaluation 50K" />
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Nickname <span className="opacity-50">(optional)</span></label>
          <input className="nx-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main account" />
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Date Passed</label>
          <input className="nx-input" type="date" value={passedDate} onChange={(e) => setPassedDate(e.target.value)} />
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Initial Balance ($)</label>
          <input className="nx-input" type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} min="0" step="100" />
        </div>
        <div>
          <label className="text-tx-3 text-xs block mb-1">Final Balance ($)</label>
          <input className="nx-input" type="number" value={finalBalance} onChange={(e) => setFinalBalance(e.target.value)} min="0" step="100" />
        </div>
        <div className="col-span-2">
          <label className="text-tx-3 text-xs block mb-1">Profit Target ($)</label>
          <input className="nx-input" type="number" value={profitTarget} onChange={(e) => setProfitTarget(e.target.value)} min="0" step="100" />
        </div>
        <div className="col-span-2 flex gap-2 pt-1">
          <button className="btn-ghost flex-1 btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 btn-sm" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </Modal>
  );
}
