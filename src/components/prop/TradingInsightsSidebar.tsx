import { useState, useMemo } from "react";
import { PoundSterling, Trophy } from "lucide-react";
import { fmtGBP, cn, toNum } from "@/lib/utils";
import { useBWMode } from "@/lib/useBWMode";
import type { Account, Withdrawal, PassedChallenge, Expense } from "@/types";

const FIRMS = [
  "Lucid Trading",
  "Tradeify",
  "Topstep",
  "FundingTicks",
  "MyFundedFX",
  "Take Profit Trader",
  "Maven Trading",
] as const;

const isFundedStatus = (s: string) => s.toLowerCase().trim() === "funded";
const isChallengeStatus = (s: string) => s.toLowerCase().trim() === "challenge";
const isBreachedStatus = (s: string) => s.toLowerCase().trim() === "breached";

export function TradingInsightsSidebar({
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
                  color: isPos ? "var(--color-teal)" : "var(--color-loss)",
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
              <div className="h-1.5 rounded-full overflow-hidden rgba(var(--surface-rgb),0.08)">
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
              const sparkColor = isPos ? "var(--color-teal)" : "var(--color-loss)";
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
                  style={{ color: rate !== null && rate >= 50 ? "var(--color-warn)" : rate !== null ? "var(--color-loss)" : undefined }}>
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
                    color: rate >= 50 ? "var(--color-warn)" : "var(--color-loss)",
                    border: `1px solid ${rate >= 50 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.2)"}`,
                  }}>
                  {passes}/{total}
                </span>
              )}
            </div>

            {rate !== null && (
              <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${rate}%`, background: rate >= 50 ? "var(--color-warn)" : "var(--color-loss)" }} />
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
                        style={{ color: firmRate >= 50 ? "var(--color-warn)" : "var(--color-loss)" }}>
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

      {/* Payout Tax Estimator — hidden on mobile for compact view */}
      {withdrawals.length > 0 && (() => {
        const totalGross   = withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
        const estimatedTax = totalGross * (taxRate / 100);
        const netAfterTax  = totalGross - estimatedTax;
        return (
          <div className="hidden sm:block card p-4"
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

      {/* Payout stats — hidden on mobile for compact view */}
      {withdrawals.length > 0 && (
        <div className="hidden sm:block card p-4">
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

      {/* Challenge pass rate — hidden on mobile for compact view */}
      {passRate !== null && (
        <div className="hidden sm:block card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-tx-3 font-medium">Challenge Pass Rate</span>
            <span className="text-sm font-bold px-2.5 py-1 rounded-lg tabular-nums"
              style={{
                background: passRate >= 50 ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                color: passRate >= 50 ? "var(--color-teal)" : "var(--color-warn)",
                border: `1px solid ${passRate >= 50 ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
              }}>
              {passRate.toFixed(0)}%
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${passRate}%`, background: passRate >= 50 ? "var(--color-teal)" : "var(--color-warn)" }} />
          </div>
          <p className="text-[10px] text-tx-3 mt-1">{funded} funded · {breached} breached</p>
        </div>
      )}

      {/* Mobile compact stats strip — visible only on small screens */}
      {(withdrawals.length > 0 || passRate !== null) && (
        <div className="sm:hidden card p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {withdrawals.length > 0 && (
              <>
                <div>
                  <p className="text-[9px] text-tx-4 uppercase tracking-wider">Payouts</p>
                  <p className="text-xs font-bold text-tx-1">{withdrawals.length}</p>
                </div>
                <div>
                  <p className="text-[9px] text-tx-4 uppercase tracking-wider">Avg</p>
                  <p className="text-xs font-bold text-profit tabular-nums font-mono">{fmtGBP(avgPayout)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-tx-4 uppercase tracking-wider">Best</p>
                  <p className="text-xs font-bold text-profit tabular-nums font-mono">{fmtGBP(bestPayout)}</p>
                </div>
              </>
            )}
          </div>
          {passRate !== null && (
            <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid rgba(var(--border-rgb),0.08)" }}>
              <span className="text-[10px] text-tx-3">Pass Rate</span>
              <span className="text-[11px] font-bold tabular-nums"
                style={{ color: passRate >= 50 ? "var(--color-teal)" : "var(--color-warn)" }}>
                {passRate.toFixed(0)}%
              </span>
            </div>
          )}
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
