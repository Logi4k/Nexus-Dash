import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from 'sonner';
import { PAGE_THEMES } from "@/lib/theme";
import { useLocation } from "react-router-dom";
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
  DollarSign,
  Activity,
  Award,
  Trophy,
  Briefcase,
} from "lucide-react";
import { useAppData } from "@/lib/store";
import { getQuickActionState } from "@/lib/quickActions";
import { formatAccountOptionLabel, isActiveAccount } from "@/lib/accountStatus";
import { reconcileLinkedPayoutAccounts } from "@/lib/payouts";
import {
  buildProgramTypeLabel,
  getAccountPhase,
  getDefaultProgramKey,
  getDefaultProgramSize,
  getPromotedProgramKey,
  getProgramOptions,
  getProgramRule,
  getProgramRuleByKeySize,
  getPropAccountSnapshot,
  inferProgramKey,
  normalizeAccountWithPropRules,
  parseAccountSize,
  type PropPhase,
  type PropProgramKey,
} from "@/lib/propRules";
import { fmtGBP, fmtUSD, fmtDate, toNum, pct, cn, getStatusBg, generateId } from "@/lib/utils";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import Modal from "@/components/Modal";
import StatCard from "@/components/StatCard";
import type { Account, AccountStatus, Withdrawal, PassedChallenge, Expense } from "@/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const FIRMS = [
  "Lucid Trading",
  "Tradeify",
  "Topstep",
  "FundingTicks",
  "MyFundedFX",
  "Take Profit Trader",
  "Maven Trading",
] as const;

type FilterTab = "all" | "funded" | "Challenge" | "Breached";

const isFundedStatus = (s: string) => s === "funded" || s === "Funded";
const isChallengeStatus = (s: string) => s === "Challenge";
const isBreachedStatus = (s: string) => s === "Breached" || s === "breached";

function getPhaseForStatus(status: AccountStatus, fallback: PropPhase = "challenge"): PropPhase {
  if (isFundedStatus(status)) return "funded";
  if (isChallengeStatus(status)) return "challenge";
  return fallback;
}

const emptyAccountForm = (phase: PropPhase = "challenge") => {
  const firm = FIRMS[0] as string;
  const planKey = getDefaultProgramKey(firm, phase);
  const planSize = planKey ? getDefaultProgramSize(planKey) : null;
  const rules = planKey && planSize ? getProgramRuleByKeySize(planKey, planSize) : null;

  return {
    firm,
    planKey: planKey ?? "",
    planSize: planSize ? String(planSize) : "",
    type: planKey && planSize ? buildProgramTypeLabel(planKey, planSize) : "",
    name: "",
    status: phase === "funded" ? ("Funded" as AccountStatus) : ("Challenge" as AccountStatus),
    balance: planSize ? String(planSize) : "",
    initialBalance: planSize ? String(planSize) : "",
    peakBalance: planSize ? String(planSize) : "",
    sodBalance: "",
    mll: rules && planSize ? String(planSize - rules.drawdown) : "",
    profitTarget: rules?.profitTarget ? String(rules.profitTarget) : "",
    notes: "",
    customFirm: "",
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
  const [isCollapsed, setIsCollapsed] = useState(true);

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
    let data = [...firmData];
    if (isCollapsed) {
      // Show only top 3 firms by net P&L when collapsed
      data = data.sort((a, b) => b.net - a.net).slice(0, 3);
    } else {
      // Show all firms, sorted as selected
      data.sort((a, b) => {
        if (sortBy === "net")    return b.net - a.net;
        if (sortBy === "spent")  return b.spent - a.spent;
        return b.earned - a.earned;
      });
    }
    return data;
  }, [firmData, sortBy, isCollapsed]);

  const maxVal = useMemo(() =>
    Math.max(...sorted.map((f) => Math.max(f.spent, f.earned)), 1),
    [sorted]
  );

  const totalSpent  = sorted.reduce((s, f) => s + f.spent,  0);
  const totalEarned = sorted.reduce((s, f) => s + f.earned, 0);
  const totalNet    = totalEarned - totalSpent;

  if (firmData.length === 0) return null;

  return (
    <div className="card p-5">
      {/* Header with Collapse/Expand Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <div className="text-tx-4 text-[10px] uppercase tracking-widest font-medium">Firm Analytics</div>
          <div className="text-tx-1 text-sm font-semibold mt-0.5">Performance by Firm</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-[11px] font-semibold"
            style={{
              background: "rgba(var(--surface-rgb),0.06)",
              border: "1px solid rgba(var(--border-rgb),0.12)",
              color: "var(--tx-2)"
            }}
          >
            {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            {isCollapsed ? "Show All" : "Show Less"}
          </button>
          {!isCollapsed && (
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
          )}
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
  const [firmTab, setFirmTab] = useState<"Lucid Trading" | "Tradeify" | "Topstep">("Lucid Trading");
  const [phaseTab, setPhaseTab] = useState<PropPhase>("challenge");
  const [planTab, setPlanTab] = useState<PropProgramKey>("lucid-flex-challenge");

  const availablePlans = getProgramOptions(firmTab, phaseTab);
  const activePlan = availablePlans.some((plan) => plan.key === planTab)
    ? planTab
    : (availablePlans[0]?.key ?? getDefaultProgramKey(firmTab, phaseTab) ?? "lucid-flex-challenge");
  const availableSizes = availablePlans.find((plan) => plan.key === activePlan)?.sizes ?? [];

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

  const formatDll = (rule: ReturnType<typeof getProgramRuleByKeySize>): string => {
    if (!rule) return "None";
    switch (rule.dll.kind) {
      case "none":
        return "None";
      case "fixed":
        return `$${rule.dll.amount.toLocaleString()}`;
      case "threshold-fixed":
        return `$${rule.dll.amount.toLocaleString()} -> $${rule.dll.scaledAmount.toLocaleString()} @ ${fmtUSD(rule.dll.thresholdBalance, 0)}`;
      case "threshold-profit-percent":
        return rule.dll.amount
          ? `$${rule.dll.amount.toLocaleString()} -> 60% of peak profit @ ${fmtUSD(rule.dll.thresholdBalance, 0)}`
          : `60% of peak profit @ ${fmtUSD(rule.dll.thresholdBalance, 0)}`;
      default:
        return "None";
    }
  };

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
            Official reference
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-tx-3" /> : <ChevronDown size={14} className="text-tx-3" />}
      </button>

      {open && (
        <div className="border-t border-white/[0.06]">
          <div className="flex px-5 pt-4 gap-1 border-b border-white/[0.06] pb-0">
            {(["Lucid Trading", "Tradeify", "Topstep"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFirmTab(f);
                  const nextPlan = getDefaultProgramKey(f, phaseTab);
                  if (nextPlan) setPlanTab(nextPlan);
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

          <div className="flex items-center justify-between gap-3 px-5 pt-3">
            <div className="flex gap-1">
              {([
                { key: "challenge" as const, label: "Challenge" },
                { key: "funded" as const, label: "Funded" },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setPhaseTab(key);
                    const nextPlan = getDefaultProgramKey(firmTab, key);
                    if (nextPlan) setPlanTab(nextPlan);
                  }}
                  className={cn("tab-pill", phaseTab === key && "active")}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[10px] uppercase tracking-[0.14em] text-tx-4">
              {phaseTab === "challenge" ? "Targets + evaluation rules" : "Trailing drawdown + payout rules"}
            </span>
          </div>

          <div className="flex gap-1 px-5 pt-3 flex-wrap">
            {availablePlans.map((plan) => (
              <button
                key={plan.key}
                onClick={() => setPlanTab(plan.key)}
                className={cn(
                  "tab-pill",
                  activePlan === plan.key && "active"
                )}
              >
                {plan.label}
              </button>
            ))}
          </div>

          <div className={cn("grid gap-4 p-5", availableSizes.length === 4 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
            {availableSizes.map((size) => {
              const rule = getProgramRuleByKeySize(activePlan, size);
              if (!rule) return null;
              return (
                <div
                  key={size}
                  className="rounded-xl p-4"
                  style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
                >
                  <div className="text-tx-1 font-bold text-sm mb-0.5">
                    {(size / 1000).toFixed(0)}K {rule.label}
                  </div>
                  <div className="text-tx-3 text-[10px] mb-3">
                    {rule.firm === "Topstep" ? "Balance-based MLL" : "EOD trailing drawdown"}
                  </div>

                  <RuleRow label="EOD Drawdown" highlight="neutral">
                    {fmtUSD(rule.drawdown)}
                  </RuleRow>
                  <RuleRow label="Initial MLL" highlight="neutral">
                    {fmtUSD(size - rule.drawdown)}
                  </RuleRow>
                  <RuleRow label="MLL Locks at" highlight="neutral">
                    {fmtUSD(rule.lockFloor)}
                  </RuleRow>
                  <RuleRow label="Lock Trigger" highlight="neutral">
                    {fmtUSD(rule.lockBalance)}
                  </RuleRow>
                  <RuleRow label="Daily Loss Limit" highlight={rule.dll.kind === "none" ? "good" : "warn"}>
                    {formatDll(rule)}
                  </RuleRow>
                  {rule.profitTarget !== null && (
                    <RuleRow label="Profit Target" highlight="neutral">
                      {fmtUSD(rule.profitTarget)}
                    </RuleRow>
                  )}
                  {rule.evalConsistency && (
                    <RuleRow label="Eval Consistency" highlight={rule.evalConsistency.toLowerCase().includes("no") ? "good" : "warn"}>
                      {rule.evalConsistency}
                    </RuleRow>
                  )}
                  {rule.fundedConsistency && (
                    <RuleRow label="Funded Consistency" highlight={rule.fundedConsistency.toLowerCase().includes("no") ? "good" : "warn"}>
                      {rule.fundedConsistency}
                    </RuleRow>
                  )}
                  <RuleRow label="Max Contracts" highlight="neutral">
                    {rule.maxContracts}
                  </RuleRow>
                  {rule.split && (
                    <RuleRow label="Profit Split" highlight="neutral">
                      {rule.split}
                    </RuleRow>
                  )}
                  {rule.payoutPolicy && (
                    <RuleRow label="Payout Rule" highlight="neutral">
                      {rule.payoutPolicy}
                    </RuleRow>
                  )}
                  {rule.weekendHolding !== null && (
                    <RuleRow label="Weekend Holding" highlight={rule.weekendHolding ? "good" : "warn"}>
                      {rule.weekendHolding ? "Allowed" : "Not allowed"}
                    </RuleRow>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-5 pb-4 text-tx-3 text-[10px] space-y-1">
            <p>All amounts are shown in USD. The app calculates the MLL from the current balance, the account size, and the highest recorded balance on the account.</p>
            <p>Tradeify and Lucid are modeled as EOD trailing drawdown products. Topstep funded accounts are modeled as the current Express Funded standard path.</p>
          </div>
        </div>
      )}
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
  const [detailOpen, setDetailOpen] = useState(false);
  const snapshot = useMemo(() => getPropAccountSnapshot(account), [account]);
  const derivedPhase = snapshot?.phase ?? getAccountPhase(account) ?? "challenge";
  const funded = derivedPhase === "funded";
  const challenge = derivedPhase === "challenge";
  const breached  = isBreachedStatus(account.status);
  const displayName = account.name || account.type || "—";
  const statusColor = funded ? "#22c55e" : challenge ? "#f59e0b" : "#ef4444";
  const statusBg    = funded ? "rgba(34,197,94,0.05)" : challenge ? "rgba(245,158,11,0.05)" : "rgba(239,68,68,0.05)";
  const firmColor   = bwColor(getFirmColor(account.firm), bw);
  const initialBalance = snapshot?.initialBalance ?? toNum(account.initialBalance ?? account.balance);
  const balance = toNum(account.balance);
  const pnl = balance - initialBalance;
  const pnlPercent = initialBalance > 0 ? pct(pnl, initialBalance) : 0;
  const phaseLabel = funded ? "Funded" : "Challenge";
  const bufferRatio = snapshot
    ? Math.max(0, Math.min((snapshot.distanceToMll / Math.max(snapshot.lockFloor - (snapshot.initialBalance - snapshot.program.drawdown), 1)) * 100, 100))
    : 0;
  const performanceLabel = `${pnl >= 0 ? "+" : ""}${fmtUSD(pnl)} · ${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(1)}%`;
  const targetValue = snapshot
    ? challenge && snapshot.profitTarget !== null
      ? fmtUSD(snapshot.profitTarget)
      : fmtUSD(snapshot.mllFloor)
    : "Manual";
  const targetMeta = snapshot
    ? challenge && snapshot.amountToPass !== null
      ? `${fmtUSD(snapshot.amountToPass)} left`
      : `${fmtUSD(snapshot.distanceToMll)} buffer`
    : "No preset matched";
  const progressLabel = snapshot
    ? challenge
      ? `${snapshot.progressPct?.toFixed(0) ?? "0"}% to pass`
      : `${Math.max(snapshot.distanceToMll, 0) <= Math.max(snapshot.initialBalance * 0.02, 500) ? "Tight buffer" : "Healthy buffer"}`
    : "No preset matched";
  const progressMeta = snapshot
    ? challenge
      ? `Start ${fmtUSD(snapshot.initialBalance)}`
      : `Lock ${fmtUSD(snapshot.lockFloor)} · peak ${fmtUSD(snapshot.peakBalance)}`
    : "";
  const progressWidth = challenge ? snapshot?.progressPct ?? 0 : bufferRatio;
  const closeDetail = () => setDetailOpen(false);
  const handleEdit = () => {
    closeDetail();
    onEdit();
  };
  const handlePayout = () => {
    closeDetail();
    onPayout();
  };
  const handleConfirmDelete = () => {
    setConfirmDelete(false);
    closeDetail();
    onDelete();
  };
  const actionControls = (
    <>
      {funded && !breached && (
        <button onClick={handlePayout} className="p-1.5 rounded-lg transition-all text-tx-3 hover:text-profit" title="Record payout">
          <PoundSterling size={12} />
        </button>
      )}
      <button onClick={handleEdit} className="p-1.5 rounded-lg transition-all text-tx-3 hover:text-tx-1" title="Edit">
        <Edit2 size={12} />
      </button>
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-lg transition-all text-tx-3 hover:text-loss" title="Delete">
          <Trash2 size={12} />
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={handleConfirmDelete}
            className="px-2 py-1 rounded text-[10px] font-semibold transition-all"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="px-2 py-1 rounded text-[10px] font-semibold transition-all"
            style={{ background: "rgba(var(--surface-rgb),0.07)", color: "var(--tx-3)" }}
          >
            No
          </button>
        </div>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl",
        breached && "opacity-75"
      )}
      style={{
        background: statusBg,
        border: `1px solid ${statusColor}20`,
      }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-full" style={{ background: statusColor }} />
      <div className="sm:hidden px-3.5 py-3">
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={cn("badge text-[10px]", getStatusBg(account.status))}>{account.status}</span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: `${firmColor}15`, color: firmColor, border: `1px solid ${firmColor}30` }}
              >
                {FIRM_SHORT[account.firm] ?? account.firm.split(" ")[0]}
              </span>
              {snapshot?.program && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-white/[0.08] text-tx-3">
                  {snapshot.program.label}
                </span>
              )}
            </div>
            <div className="text-tx-1 text-sm font-bold leading-tight truncate">{displayName}</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.07)" }}>
                <p className="text-[9px] uppercase tracking-[0.16em] text-tx-4">Balance</p>
                <p className={cn("mt-1 text-sm font-black tabular-nums", breached ? "text-tx-3" : "text-tx-1")}>{fmtUSD(balance)}</p>
              </div>
              <div className="rounded-xl px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.07)" }}>
                <p className="text-[9px] uppercase tracking-[0.16em] text-tx-4">{challenge ? "Need" : "Buffer"}</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-tx-1">{challenge ? targetValue : fmtUSD(snapshot?.distanceToMll ?? 0)}</p>
              </div>
            </div>
          </button>
          <div className="flex items-start gap-1 shrink-0">
            {actionControls}
          </div>
        </div>

        <div className="mt-2.5 rounded-xl px-2.5 py-2" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="min-w-0 truncate text-tx-3">{progressLabel}</span>
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-tx-2"
            >
              <BookOpen size={10} />
              Details
            </button>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${progressWidth}%`,
                background: challenge
                  ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                  : bufferRatio > 40
                    ? "linear-gradient(90deg,#16a34a,#4ade80)"
                    : bufferRatio > 15
                      ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                      : "linear-gradient(90deg,#dc2626,#ef4444)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="hidden sm:grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <span className={cn("badge text-[10px]", getStatusBg(account.status))}>{account.status}</span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: `${firmColor}15`, color: firmColor, border: `1px solid ${firmColor}30` }}
            >
              {FIRM_SHORT[account.firm] ?? account.firm.split(" ")[0]}
            </span>
            {snapshot?.program && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-white/[0.08] text-tx-3">
                {snapshot.program.label}
              </span>
            )}
            {breached && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-white/[0.08] text-tx-3">
                Was {phaseLabel}
              </span>
            )}
          </div>
          <div className="text-tx-1 text-sm font-bold leading-tight truncate">{displayName}</div>
          <div className="text-tx-4 text-[11px] mt-0.5 truncate">{account.firm}</div>
          {account.notes && (
            <p className="text-[10px] text-tx-4 mt-2 leading-relaxed">{account.notes}</p>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4 mb-1">Balance</p>
          <p className={cn("text-lg font-black tabular-nums", breached ? "text-tx-3" : "text-tx-1")}>{fmtUSD(balance)}</p>
          <p className={cn("text-[11px] font-semibold tabular-nums mt-1", pnl >= 0 ? "text-profit" : "text-loss")}>
            {performanceLabel}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4 mb-1">{challenge ? "Pass Target" : "MLL Floor"}</p>
          {snapshot ? (
            <>
              <p className="text-sm font-bold tabular-nums text-tx-1">
                {challenge && snapshot.profitTarget !== null ? fmtUSD(snapshot.profitTarget) : fmtUSD(snapshot.mllFloor)}
              </p>
              <p className="text-[11px] text-tx-3 mt-1">
                {challenge && snapshot.amountToPass !== null
                  ? `${fmtUSD(snapshot.amountToPass)} left to pass`
                  : `${fmtUSD(snapshot.distanceToMll)} buffer`}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold tabular-nums text-tx-1">Manual</p>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4 mb-1">{challenge ? "Progress" : "Risk"}</p>
          {snapshot ? (
            <>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-tx-3">
                  {challenge
                    ? `${snapshot.progressPct?.toFixed(0) ?? "0"}% of target`
                    : `${Math.max(snapshot.distanceToMll, 0) <= Math.max(snapshot.initialBalance * 0.02, 500) ? "Tight buffer" : "Healthy buffer"}`}
                </span>
                {snapshot.currentDll !== null && (
                  <span className="font-medium text-tx-2">DLL {fmtUSD(snapshot.currentDll)}</span>
                )}
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${challenge ? snapshot.progressPct ?? 0 : bufferRatio}%`,
                    background: challenge
                      ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                      : bufferRatio > 40
                        ? "linear-gradient(90deg,#16a34a,#4ade80)"
                        : bufferRatio > 15
                          ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                          : "linear-gradient(90deg,#dc2626,#ef4444)",
                  }}
                />
              </div>
              <p className="text-[10px] text-tx-4 mt-1">
                {challenge
                  ? `Start ${fmtUSD(snapshot.initialBalance)}`
                  : `Peak ${fmtUSD(snapshot.peakBalance)} · lock ${fmtUSD(snapshot.lockFloor)}`}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-tx-3">No preset matched</p>
          )}
        </div>

        <div className="flex items-start gap-1 justify-end">
          {actionControls}
        </div>
      </div>

      <Modal open={detailOpen} onClose={closeDetail} title={displayName} size="sm">
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("badge text-[10px]", getStatusBg(account.status))}>{account.status}</span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: `${firmColor}15`, color: firmColor, border: `1px solid ${firmColor}30` }}
            >
              {account.firm}
            </span>
            {snapshot?.program && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-white/[0.08] text-tx-3">
                {snapshot.program.label}
              </span>
            )}
            {breached && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-white/[0.08] text-tx-3">
                Was {phaseLabel}
              </span>
            )}
          </div>

          {account.notes && (
            <p className="text-sm leading-relaxed text-tx-3">{account.notes}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-tx-4">Balance</p>
              <p className={cn("mt-1 text-base font-black tabular-nums", breached ? "text-tx-3" : "text-tx-1")}>{fmtUSD(balance)}</p>
              <p className={cn("mt-1 text-[11px] font-semibold tabular-nums", pnl >= 0 ? "text-profit" : "text-loss")}>
                {performanceLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-tx-4">{challenge ? "Need to pass" : "MLL floor"}</p>
              <p className="mt-1 text-base font-black tabular-nums text-tx-1">{targetValue}</p>
              <p className="mt-1 text-[11px] text-tx-3">{targetMeta}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-tx-2">{progressLabel}</span>
              {snapshot && snapshot.currentDll !== null && (
                <span className="text-tx-3">DLL {fmtUSD(snapshot.currentDll)}</span>
              )}
            </div>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progressWidth}%`,
                  background: challenge
                    ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                    : bufferRatio > 40
                      ? "linear-gradient(90deg,#16a34a,#4ade80)"
                      : bufferRatio > 15
                        ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                        : "linear-gradient(90deg,#dc2626,#ef4444)",
                }}
              />
            </div>
            {progressMeta && (
              <p className="mt-2 text-[11px] text-tx-3">{progressMeta}</p>
            )}
          </div>

          <div className="modal-action-bar">
            {funded && !breached && (
              <button className="btn-success btn flex-1" onClick={handlePayout}>
                <PoundSterling size={14} />
                Log Payout
              </button>
            )}
            <button className="btn-primary btn flex-1" onClick={handleEdit}>
              <Edit2 size={14} />
              Edit
            </button>
            {!confirmDelete ? (
              <button className="btn-ghost btn" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
                Delete
              </button>
            ) : (
              <>
                <button className="btn-danger btn flex-1" onClick={handleConfirmDelete}>
                  Confirm Delete
                </button>
                <button className="btn-ghost btn" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PropAccounts() {
  const { data, update } = useAppData();
  const location = useLocation();
  const handledLocationAction = useRef<string | null>(null);

  const [tab, setTab] = useState<FilterTab>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);

  useEffect(() => {
    const quickAction = getQuickActionState(location.state);
    const requestKey = quickAction?.quickActionId ?? null;

    if (!quickAction?.action) {
      handledLocationAction.current = null;
      return;
    }
    if (handledLocationAction.current === requestKey) return;

    if (quickAction.action === "addAccount") {
      handledLocationAction.current = requestKey;
      setEditAccount(null);
      setForm(emptyAccountForm());
      setAddOpen(true);
    } else if (quickAction.action === "logPayout") {
      handledLocationAction.current = requestKey;
      setEditPayoutId(null);
      setPayoutForm(emptyPayoutForm());
      setPayoutOpen(true);
    }
  }, [location.state]);

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

  const fallbackPhase = editAccount?.phaseHint ?? "challenge";
  const formPhase = getPhaseForStatus(form.status, fallbackPhase);
  const availablePlans = getProgramOptions(form.firm, formPhase);
  const firmHasPlans = availablePlans.length > 0;
  const activePlanKey = availablePlans.some((plan) => plan.key === form.planKey)
    ? (form.planKey as PropProgramKey)
    : (availablePlans[0]?.key ?? "");
  const availablePlanSizes = availablePlans.find((plan) => plan.key === activePlanKey)?.sizes ?? [];

  useEffect(() => {
    const normalizedAccounts = data.accounts.map(normalizeAccountWithPropRules);
    const changed = normalizedAccounts.some((account, index) => {
      const current = data.accounts[index];
      return (
        account.status !== current.status ||
        account.mll !== current.mll ||
        account.initialBalance !== current.initialBalance ||
        account.peakBalance !== current.peakBalance ||
        account.phaseHint !== current.phaseHint
      );
    });

    if (!changed) return;

    update((prev) => ({
      ...prev,
      accounts: prev.accounts.map(normalizeAccountWithPropRules),
    }));
  }, [data.accounts, update]);

  function applyProgramSelection(nextPlanKey: PropProgramKey, nextSize?: number, nextStatus?: AccountStatus) {
    const phase = getPhaseForStatus(nextStatus ?? form.status, formPhase);
    const nextPlans = getProgramOptions(form.firm, phase);
    const fallbackPlan = nextPlans.find((plan) => plan.key === nextPlanKey) ? nextPlanKey : (nextPlans[0]?.key ?? nextPlanKey);
    const planSizes = nextPlans.find((plan) => plan.key === fallbackPlan)?.sizes ?? [];
    const resolvedSize = nextSize && planSizes.includes(nextSize) ? nextSize : planSizes[0];
    const rules = resolvedSize ? getProgramRuleByKeySize(fallbackPlan, resolvedSize) : null;

    setForm((prev) => ({
      ...prev,
      status: nextStatus ?? prev.status,
      planKey: fallbackPlan,
      planSize: resolvedSize ? String(resolvedSize) : "",
      type: resolvedSize ? buildProgramTypeLabel(fallbackPlan, resolvedSize) : prev.type,
      initialBalance: resolvedSize ? String(resolvedSize) : prev.initialBalance,
      balance: !editAccount && resolvedSize ? String(resolvedSize) : prev.balance,
      peakBalance: !editAccount && resolvedSize ? String(resolvedSize) : prev.peakBalance,
      mll: rules && resolvedSize ? String(resolvedSize - rules.drawdown) : prev.mll,
      profitTarget: rules?.profitTarget ? String(rules.profitTarget) : "",
    }));
  }

  function handlePlanKeyChange(planKey: string) {
    applyProgramSelection(planKey as PropProgramKey, form.planSize ? Number(form.planSize) : undefined);
  }

  function handlePlanSizeChange(sizeStr: string) {
    const nextSize = Number(sizeStr);
    applyProgramSelection(activePlanKey, nextSize);
  }

  function handleStatusChange(nextStatus: AccountStatus) {
    if (!firmHasPlans) {
      setForm((prev) => ({ ...prev, status: nextStatus }));
      return;
    }

    const nextPhase = getPhaseForStatus(nextStatus, formPhase);
    const nextPlans = getProgramOptions(form.firm, nextPhase);
    const nextPlan = nextPlans.find((plan) => plan.key === form.planKey)?.key ?? nextPlans[0]?.key;
    applyProgramSelection(nextPlan ?? activePlanKey, form.planSize ? Number(form.planSize) : undefined, nextStatus);
  }

  function handleFirmChange(firm: string) {
    if (firm === "__other__") {
      setForm((prev) => ({
        ...prev,
        firm,
        customFirm: "",
        planKey: "",
        planSize: "",
        type: "",
        profitTarget: "",
      }));
      return;
    }

    const nextPlans = getProgramOptions(firm, formPhase);
    const nextPlan = nextPlans[0]?.key ?? "";
    const nextSize = nextPlans[0]?.sizes[0];
    const rules = nextPlan && nextSize ? getProgramRuleByKeySize(nextPlan, nextSize) : null;
    setForm((prev) => ({
      ...prev,
      firm,
      customFirm: "",
      planKey: nextPlan,
      planSize: nextSize ? String(nextSize) : "",
      type: nextPlan && nextSize ? buildProgramTypeLabel(nextPlan, nextSize) : prev.type,
      initialBalance: nextSize ? String(nextSize) : prev.initialBalance,
      balance: !editAccount && nextSize ? String(nextSize) : prev.balance,
      peakBalance: !editAccount && nextSize ? String(nextSize) : prev.peakBalance,
      mll: rules && nextSize ? String(nextSize - rules.drawdown) : prev.mll,
      profitTarget: rules?.profitTarget ? String(rules.profitTarget) : "",
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

  const payoutAccountOptions = useMemo(
    () =>
      [...data.accounts]
        .sort((a, b) => {
          const activityDelta = Number(isActiveAccount(b)) - Number(isActiveAccount(a));
          if (activityDelta !== 0) return activityDelta;
          return (a.name || a.type).localeCompare(b.name || b.type) || a.firm.localeCompare(b.firm);
        })
        .map((account) => ({
          value: account.id,
          label: formatAccountOptionLabel(account, { includeFirm: false }),
          firm: account.firm,
          active: isActiveAccount(account),
        })),
    [data.accounts]
  );

  const payoutAccountLabels = useMemo(
    () =>
      new Map(
        data.accounts.map((account) => [
          account.id,
          formatAccountOptionLabel(account, { includeFirm: false }),
        ])
      ),
    [data.accounts]
  );

  /* ---- Save account ---- */
  const handleSaveAccount = () => {
    if (!form.balance) return;
    const firmName = form.firm === "__other__" ? form.customFirm.trim() : form.firm;
    if (!firmName) return;
    const bal = parseFloat(form.balance);
    const selectedPlanKey = firmHasPlans && activePlanKey ? activePlanKey : null;
    const selectedSize = form.planSize ? Number(form.planSize) : parseAccountSize(form.type);
    let finalType = selectedPlanKey && selectedSize ? buildProgramTypeLabel(selectedPlanKey, selectedSize) : form.type;
    const initBal = form.initialBalance ? parseFloat(form.initialBalance) : selectedSize ?? bal;
    const sodBal = form.sodBalance ? parseFloat(form.sodBalance) : bal;
    const manualMll = form.mll ? parseFloat(form.mll) : undefined;
    let phaseHint = getPhaseForStatus(form.status, fallbackPhase);
    let finalStatus: AccountStatus = form.status;
    let passRecord: import("@/types").PassedChallenge | null = null;
    let peakBalance = Math.max(
      bal,
      initBal,
      editAccount?.peakBalance ?? 0,
      form.peakBalance ? parseFloat(form.peakBalance) : 0
    );

    let snapshot = getPropAccountSnapshot({
      firm: firmName,
      type: finalType,
      status: finalStatus,
      phaseHint,
      balance: bal,
      initialBalance: initBal,
      peakBalance,
    });

    if (snapshot && phaseHint === "challenge" && snapshot.amountToPass !== null && snapshot.amountToPass <= 0) {
      const promotedKey = selectedPlanKey ? getPromotedProgramKey(selectedPlanKey) : null;
      finalStatus = "Funded";
      phaseHint = "funded";
      if (promotedKey && selectedSize) {
        finalType = buildProgramTypeLabel(promotedKey, selectedSize);
      }
      passRecord = {
        id: generateId(),
        firm: firmName,
        type: finalType,
        name: form.name || undefined,
        passedDate: new Date().toISOString().slice(0, 10),
        finalBalance: bal,
        initialBalance: initBal,
        profitTarget: snapshot.profitTarget ?? 0,
      };
      snapshot = getPropAccountSnapshot({
        firm: firmName,
        type: finalType,
        status: finalStatus,
        phaseHint,
        balance: bal,
        initialBalance: initBal,
        peakBalance,
      });
    }

    const baseAccount: Account = {
      id: editAccount?.id ?? generateId(),
      firm: firmName,
      type: finalType,
      name: form.name || undefined,
      status: finalStatus,
      phaseHint,
      balance: bal,
      initialBalance: initBal,
      peakBalance,
      sodBalance: sodBal,
      mll: snapshot?.mllFloor ?? manualMll,
      notes: form.notes || undefined,
      pnlHistory: editAccount?.pnlHistory ?? [],
      pnlEntries: editAccount?.pnlEntries,
      linkedExpenseId: editAccount?.linkedExpenseId,
    };
    const normalizedAccount = normalizeAccountWithPropRules(baseAccount);

    if (editAccount) {
      update((prev) => {
        const updatedAccounts = prev.accounts.map((a) =>
          a.id === editAccount.id
            ? { ...a, ...normalizedAccount }
            : a
        );
        return passRecord
          ? { ...prev, accounts: updatedAccounts, passedChallenges: [...(prev.passedChallenges ?? []), passRecord] }
          : { ...prev, accounts: updatedAccounts };
      });
    } else {
      const qty = Math.max(1, Math.min(addQty, 50));
      const newAccounts: Account[] = Array.from({ length: qty }, () => ({
        ...normalizedAccount,
        id: generateId(),
        pnlHistory: normalizedAccount.pnlHistory ?? [],
      }));
      update((prev) => ({ ...prev, accounts: [...newAccounts, ...prev.accounts] }));
      toast.success('Account added');
    }

    setAddOpen(false);
    setAddQty(1);
    setEditAccount(null);
    setForm(emptyAccountForm());
  };


  /* ---- Open edit ---- */
  const handleOpenEdit = (account: Account) => {
    setEditAccount(account);
    const inferredKey = inferProgramKey(account);
    const inferredSize = parseAccountSize(account.type);
    const rules = getProgramRule(account);
    setForm({
      firm:           account.firm,
      planKey:        inferredKey ?? "",
      planSize:       inferredSize ? String(inferredSize) : "",
      type:           account.type,
      name:           account.name ?? "",
      status:         account.status,
      balance:        String(account.balance),
      initialBalance: account.initialBalance ? String(account.initialBalance) : "",
      peakBalance:    account.peakBalance ? String(account.peakBalance) : "",
      sodBalance:     account.sodBalance ? String(account.sodBalance) : "",
      mll:            account.mll ? String(account.mll) : "",
      profitTarget:   rules?.profitTarget ? String(rules.profitTarget) : "",
      notes:          account.notes ?? "",
      customFirm:     "",
    });
    setAddOpen(true);
  };

  /* ---- Delete account ---- */
  const handleDelete = (id: string) => {
    const deleted = data.accounts.find((a) => a.id === id);
    if (!deleted) return;
    update((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }));
    toast('Account deleted', {
      action: { label: 'Undo', onClick: () => update((prev) => ({ ...prev, accounts: [...prev.accounts, deleted] })) },
      duration: 5000,
    });
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
    const deleted = (data.passedChallenges ?? []).find((c) => c.id === id);
    if (!deleted) return;
    update((prev) => ({
      ...prev,
      passedChallenges: (prev.passedChallenges ?? []).filter((c) => c.id !== id),
    }));
    setDeleteChallengeConfirm(null);
    toast('Challenge deleted', {
      action: { label: 'Undo', onClick: () => update((prev) => ({ ...prev, passedChallenges: [...(prev.passedChallenges ?? []), deleted] })) },
      duration: 5000,
    });
  };

  /* ---- Save payout (add or edit) — also deducts from linked account balance ---- */
  const handleSavePayout = () => {
    if (!payoutForm.gross) return;
    const grossAmt = parseFloat(payoutForm.gross);
    const nextWithdrawalPatch = {
      date: payoutForm.date,
      firm: payoutForm.firm,
      gross: grossAmt,
      accountId: payoutForm.accountId || undefined,
      notes: payoutForm.notes.trim() || undefined,
    };

    if (editPayoutId) {
      update((prev) => {
        const oldWithdrawal = prev.withdrawals.find((withdrawal) => withdrawal.id === editPayoutId);
        if (!oldWithdrawal) return prev;

        const updatedWithdrawal: Withdrawal = {
          ...oldWithdrawal,
          ...nextWithdrawalPatch,
        };

        return {
          ...prev,
          withdrawals: prev.withdrawals.map((withdrawal) =>
            withdrawal.id === editPayoutId ? updatedWithdrawal : withdrawal
          ),
          accounts: reconcileLinkedPayoutAccounts(prev.accounts, oldWithdrawal, updatedWithdrawal),
        };
      });
      toast.success("Payout updated");
    } else {
      const w: Withdrawal = {
        id:    generateId(),
        date:  payoutForm.date,
        firm:  payoutForm.firm,
        gross: grossAmt,
        accountId: payoutForm.accountId || undefined,
        notes: payoutForm.notes.trim() || undefined,
      };
      update((prev) => ({
        ...prev,
        withdrawals: [w, ...prev.withdrawals],
        accounts: reconcileLinkedPayoutAccounts(prev.accounts, null, w),
      }));
      toast.success('Payout logged');
    }
    setPayoutOpen(false);
    setEditPayoutId(null);
    setPayoutForm(emptyPayoutForm());
  };

  /* ---- Delete payout ---- */
  const handleDeletePayout = (id: string) => {
    const deleted = data.withdrawals.find((w) => w.id === id);
    if (!deleted) return;
    update((prev) => ({
      ...prev,
      withdrawals: prev.withdrawals.filter((w) => w.id !== id),
      accounts: reconcileLinkedPayoutAccounts(prev.accounts, deleted, null),
    }));
    setDeletingPayoutId(null);
    toast('Payout deleted', {
      action: {
        label: 'Undo',
        onClick: () =>
          update((prev) => ({
            ...prev,
            withdrawals: [deleted, ...prev.withdrawals],
            accounts: reconcileLinkedPayoutAccounts(prev.accounts, null, deleted),
          })),
      },
      duration: 5000,
    });
  };

  const openPayout = (firm?: string, accountId?: string) => {
    setEditPayoutId(null);
    setPayoutForm(emptyPayoutForm(firm, accountId));
    setPayoutOpen(true);
  };

  const openEditPayout = (w: Withdrawal) => {
    setEditPayoutId(w.id);
    setPayoutForm({
      firm: w.firm,
      date: w.date,
      gross: String(w.gross),
      notes: w.notes ?? "",
      accountId: w.accountId ?? "",
    });
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
    return getProgramRuleByKeySize(activePlanKey, Number(form.planSize));
  }, [firmHasPlans, form.firm, activePlanKey, form.planSize]);

  return (
    <div className="space-y-5 w-full">
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

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="grid gap-3 px-4 py-3 border-b border-white/[0.06] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] hidden lg:grid">
              {["Account", "Balance", "Target / MLL", "Progress / Risk", "Actions"].map((label) => (
                <span key={label} className="text-[10px] uppercase tracking-[0.16em] text-tx-4">
                  {label}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 p-2.5 sm:gap-3 sm:p-3">
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
            {filtered.length === 0 && data.accounts.length === 0 && (
              <div className="col-span-full task-empty">
                <div className="task-empty-copy">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-tx-4">
                    <Briefcase size={12} />
                    Prop Workspace
                  </div>
                  <div>
                    <p className="text-base font-semibold text-tx-1">Add the first challenge or funded account.</p>
                    <p className="mt-1 text-sm text-tx-3">
                      Nexus will track pass targets, trailing MLL, breach status, and payout history once the account is live.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      "Auto-calculate MLL and targets",
                      "See funded and challenge health together",
                      "Link payouts back to the exact account",
                    ].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] text-tx-3"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="task-empty-actions mt-4">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => {
                      setEditAccount(null);
                      setForm(emptyAccountForm());
                      setAddOpen(true);
                    }}
                  >
                    <Plus size={14} /> Add Account
                  </button>
                </div>
              </div>
            )}
            {filtered.length === 0 && data.accounts.length > 0 && (
              <div className="task-empty">
                <div className="task-empty-copy">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-tx-4">
                    <Shield size={12} />
                    Filter View
                  </div>
                  <div>
                    <p className="text-base font-semibold text-tx-1">No accounts match this view.</p>
                    <p className="mt-1 text-sm text-tx-3">
                      Switch back to All to review every account, then narrow down again if needed.
                    </p>
                  </div>
                </div>
                <div className="task-empty-actions mt-4">
                  <button className="btn-ghost btn-sm" onClick={() => setTab("all")}>
                    Show All Accounts
                  </button>
                </div>
              </div>
            )}
            </div>
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
                    const linkedAccountLabel = w.accountId ? payoutAccountLabels.get(w.accountId) : null;
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
                            {linkedAccountLabel && (
                              <div className="mt-1 text-[11px] text-tx-3 break-words">
                                {linkedAccountLabel}
                              </div>
                            )}
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
                        const linkedAccountLabel = w.accountId ? payoutAccountLabels.get(w.accountId) : null;
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
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wFirmCol }} />
                                  <span className="text-tx-1 font-medium text-xs">{w.firm}</span>
                                </div>
                                {linkedAccountLabel && (
                                  <div className="mt-1 text-[11px] text-tx-3">{linkedAccountLabel}</div>
                                )}
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
                  <select className="nx-select" value={form.status} onChange={(e) => handleStatusChange(e.target.value as AccountStatus)}>
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
                      {availablePlans.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
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

              <div>
                <label className="text-tx-3 text-xs block mb-1">Highest Balance Recorded ($)</label>
                <input
                  className="nx-input"
                  type="number"
                  placeholder="Used for trailing MLL"
                  value={form.peakBalance ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, peakBalance: e.target.value }))}
                />
              </div>

              {/* MLL & Profit Target */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Current MLL Floor ($)</label>
                  <input
                    className="nx-input"
                    type="number"
                    placeholder="24000"
                    value={form.mll}
                    readOnly={firmHasPlans}
                    onChange={(e) => setForm((p) => ({ ...p, mll: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Profit Target ($)</label>
                  <input
                    className="nx-input"
                    type="number"
                    placeholder="1250"
                    value={form.profitTarget}
                    readOnly={firmHasPlans}
                    onChange={(e) => setForm((p) => ({ ...p, profitTarget: e.target.value }))}
                  />
                </div>
              </div>

              {modalRules && (
                <div className="rounded-xl px-3 py-2.5 text-[11px] text-tx-3 border border-white/[0.08] bg-white/[0.03]">
                  <div className="flex items-center justify-between gap-3">
                    <span>{modalRules.label} {(modalRules.size / 1000).toFixed(0)}K</span>
                    <span>{fmtUSD(modalRules.drawdown)} drawdown</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <span>Locks at {fmtUSD(modalRules.lockFloor)}</span>
                    <span>{modalRules.profitTarget !== null ? `${fmtUSD(modalRules.profitTarget)} target` : "Funded rule set"}</span>
                  </div>
                </div>
              )}

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

              <div className="modal-action-bar">
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
          <div>
            <label className="text-tx-3 text-xs block mb-1">Firm</label>
            <select className="nx-select" value={payoutForm.firm} onChange={(e) => setPayoutForm((p) => ({ ...p, firm: e.target.value }))}>
              {FIRMS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Linked Account</label>
            <select
              className="nx-select"
              value={payoutForm.accountId}
              onChange={(e) => {
                const nextAccount = payoutAccountOptions.find((option) => option.value === e.target.value);
                setPayoutForm((prev) => ({
                  ...prev,
                  accountId: e.target.value,
                  firm: nextAccount?.firm ?? prev.firm,
                }));
              }}
            >
              <option value="">No linked account</option>
              {payoutAccountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}{option.active ? "" : " - Inactive"}
                </option>
              ))}
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
          <div>
            <label className="text-tx-3 text-xs block mb-1">Notes</label>
            <textarea
              className="nx-input min-h-[88px] resize-y"
              placeholder="Optional"
              value={payoutForm.notes}
              onChange={(e) => setPayoutForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="modal-action-bar">
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
        <div className="modal-action-bar col-span-2">
          <button className="btn-ghost flex-1 btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 btn-sm" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </Modal>
  );
}
