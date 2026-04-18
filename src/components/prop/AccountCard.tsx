import { useState, useMemo } from "react";
import {
  Columns2,
  Edit2,
  Trash2,
  PoundSterling,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { fmtUSD, fmtDate, toNum, pct, cn, getStatusBg } from "@/lib/utils";
import { useBWMode, bwColor } from "@/lib/useBWMode";
import Modal from "@/components/Modal";
import { IconButton } from "@/components/ui/icon-button";
import type { Account, Withdrawal, TradeEntry } from "@/types";
import {
  getAccountPhase,
  getPropAccountSnapshot,
  type PropAccountSnapshot,
} from "@/lib/propRules";

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
  "Lucid Trading":      "#5b8bbf",
  "Tradeify":           "#9b8ec2",
  "Topstep":            "#c49060",
  "FundingTicks":       "#5aadaa",
  "MyFundedFX":         "#fbbf24",
  "Take Profit Trader": "#c070a0",
  "Maven Trading":      "#4a9a7a",
};
const getFirmColor = (firm: string) => FIRM_COLOR[firm] ?? "#6b7280";

const isBreachedStatus = (s: string) => s.toLowerCase().trim() === "breached";

export function getPayoutStatus(
  snapshot: PropAccountSnapshot | null,
  funded: boolean,
  breached: boolean,
  accountWinningDays: number | undefined,
  cycleWinningDays: number | null
) {
  if (!snapshot || !funded || breached || !snapshot.program.payout) {
    return null;
  }

  // Use manual account winning days if set; fall back to trade journal cycle winning days
  const effectiveWinningDays = accountWinningDays ?? cycleWinningDays ?? 0;

  const blockers: string[] = [];

  if (snapshot.payoutBufferRemaining !== null && snapshot.payoutBufferRemaining < 0) {
    blockers.push(`${fmtUSD(Math.abs(snapshot.payoutBufferRemaining))} buffer needed`);
  }

  const minCycleProfit = snapshot.program.payout.minProfitGoal ?? null;
  if (minCycleProfit !== null && (snapshot.payoutCycleProfit ?? 0) < minCycleProfit) {
    blockers.push(`${fmtUSD(minCycleProfit - (snapshot.payoutCycleProfit ?? 0))} cycle profit left`);
  }

  if (snapshot.payoutWinningDays !== null && effectiveWinningDays < snapshot.payoutWinningDays) {
    blockers.push(`${snapshot.payoutWinningDays - effectiveWinningDays} winning day${snapshot.payoutWinningDays - effectiveWinningDays === 1 ? "" : "s"} left`);
  }

  if (
    snapshot.payoutConsistencyLimit !== null &&
    snapshot.cycleConsistencyPct !== null &&
    snapshot.cycleConsistencyPct > snapshot.payoutConsistencyLimit
  ) {
    blockers.push(`${snapshot.cycleConsistencyPct.toFixed(0)}% / ${snapshot.payoutConsistencyLimit}% consistency`);
  }

  if (
    snapshot.payoutMinimumRequest !== null &&
    snapshot.payoutAvailableAmount !== null &&
    snapshot.payoutAvailableAmount < snapshot.payoutMinimumRequest
  ) {
    blockers.push(`${fmtUSD(snapshot.payoutMinimumRequest - snapshot.payoutAvailableAmount)} more withdrawable headroom needed`);
  }

  const ready = blockers.length === 0;
  const winningDayRule = snapshot.payoutWinningDayAmount !== null
    ? `${snapshot.payoutWinningDays ?? 0} x ${fmtUSD(snapshot.payoutWinningDayAmount)}+ day${snapshot.payoutWinningDays === 1 ? "" : "s"}`
    : snapshot.payoutWinningDays !== null
      ? `${snapshot.payoutWinningDays} trading day${snapshot.payoutWinningDays === 1 ? "" : "s"}`
      : null;

  return {
    ready,
    badgeText: ready ? "Payout ready" : "Payout blocked",
    badgeTone: ready ? "text-profit" : "text-warn",
    summary: ready
      ? snapshot.payoutAvailableAmount !== null && snapshot.payoutAvailableAmount > 0
        ? `${fmtUSD(snapshot.payoutAvailableAmount)} is currently available inside the live rules`
        : snapshot.latestPayoutDate
          ? `Cycle reset from ${fmtDate(snapshot.latestPayoutDate)}`
          : "Current cycle meets the payout rules"
      : blockers[0],
    detail: {
      cycleProfit: snapshot.payoutCycleProfit,
      winningDays: effectiveWinningDays,
      requiredWinningDays: snapshot.payoutWinningDays,
      winningDayRule,
      consistencyPct: snapshot.cycleConsistencyPct,
      consistencyLimit: snapshot.payoutConsistencyLimit,
      bufferRemaining: snapshot.payoutBufferRemaining,
      availableAmount: snapshot.payoutAvailableAmount,
      minimumRequest: snapshot.payoutMinimumRequest,
      cycleStartDate: snapshot.payoutCycleStartDate,
    },
  };
}

export function AccountCard({
  account,
  snapshotContext,
  onEdit,
  onDelete,
  onPayout,
  onUnbreach,
  onToggleCompare,
  compareSelected = false,
  compareDisabled = false,
}: {
  account: Account;
  snapshotContext: {
    withdrawals: Withdrawal[];
    tradeJournal?: TradeEntry[];
  };
  onEdit: () => void;
  onDelete: () => void;
  onPayout: () => void;
  onUnbreach: (phase: "challenge" | "funded") => void;
  onToggleCompare?: () => void;
  compareSelected?: boolean;
  compareDisabled?: boolean;
}) {
  const bw = useBWMode();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [unbreachPhase, setUnbreachPhase] = useState<"challenge" | "funded" | null>(null);
  const snapshot = useMemo(
    () => getPropAccountSnapshot(account, snapshotContext),
    [account, snapshotContext]
  );
  const derivedPhase = snapshot?.phase ?? getAccountPhase(account) ?? "challenge";
  const funded = derivedPhase === "funded";
  const challenge = derivedPhase === "challenge";
  // Use live snapshot breach status to ensure color reflects current floor state,
  // not the potentially stale stored account.status
  const breached  = snapshot?.breached ?? isBreachedStatus(account.status);
  const displayName = account.name || account.type || "—";
  const statusColor = breached ? "var(--color-loss)" : funded ? "var(--color-teal)" : "var(--color-warn)";
  const firmColor   = bwColor(getFirmColor(account.firm), bw);
  const initialBalance = snapshot?.initialBalance ?? toNum(account.initialBalance ?? account.balance);
  const balance = toNum(account.balance);
  const pnl = balance - initialBalance;
  const pnlPercent = initialBalance > 0 ? pct(pnl, initialBalance) : 0;
  const phaseLabel = funded ? "Funded" : "Challenge";
  const bufferRatio = snapshot?.drawdownRemainingPct ?? 0;
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
      : snapshot.bufferHealth === "critical"
        ? "Critical buffer"
        : snapshot.bufferHealth === "tight"
          ? "Tight buffer"
          : "Healthy buffer"
    : "No preset matched";
  const progressMeta = snapshot
    ? challenge
      ? `Start ${fmtUSD(snapshot.initialBalance)}`
      : `${snapshot.locked ? "Locked" : "Trail"} ${fmtUSD(snapshot.lockFloor)} · peak ${fmtUSD(snapshot.peakBalance)}`
    : "";
  const progressWidth = challenge ? snapshot?.progressPct ?? 0 : bufferRatio;
  const payoutStatus = getPayoutStatus(snapshot, funded, breached, account.winningDays, snapshot?.cycleWinningDays ?? null);
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
      {onToggleCompare && (
        <IconButton
          onClick={onToggleCompare}
          label={compareSelected ? "Remove from compare" : "Add to compare"}
          tone={compareSelected ? "accent" : "default"}
          disabled={compareDisabled && !compareSelected}
          className="!p-1 sm:!p-1.5"
        >
          <Columns2 size={12} />
        </IconButton>
      )}
      {funded && !breached && (
        <IconButton onClick={handlePayout} label="Record payout" tone="profit" className="!p-1 sm:!p-1.5">
          <PoundSterling size={12} />
        </IconButton>
      )}
      <IconButton onClick={handleEdit} label="Edit account" className="!p-1 sm:!p-1.5">
        <Edit2 size={12} />
      </IconButton>
      {!confirmDelete ? (
        <IconButton onClick={() => setConfirmDelete(true)} label="Delete account" tone="loss" className="!p-1 sm:!p-1.5">
          <Trash2 size={12} />
        </IconButton>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={handleConfirmDelete}
            className="rounded px-2 py-1 text-[10px] font-semibold transition-colors"
            style={{ background: "rgba(239,68,68,0.15)", color: "var(--color-loss)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded px-2 py-1 text-[10px] font-semibold transition-colors"
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
        "relative overflow-hidden rounded-xl sm:rounded-2xl",
        breached && "opacity-75"
      )}
      style={{
        background: `color-mix(in srgb, ${statusColor} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${statusColor} 20%, transparent)`,
      }}
    >
      <div className="sm:hidden px-2 py-2">
        <div className="flex items-start gap-1.5">
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="mb-0.5 flex flex-wrap items-center gap-1">
              <span className={cn("badge text-[9px]", getStatusBg(account.status))}>{account.status}</span>
              <span
                className="rounded px-1 py-0.5 text-[9px] font-bold"
                style={{ background: `${firmColor}15`, color: firmColor }}
              >
                {FIRM_SHORT[account.firm] ?? account.firm.split(" ")[0]}
              </span>
              {snapshot?.program && (
                <span className="rounded px-1 py-0.5 text-[9px] font-medium text-tx-3">
                  {snapshot.program.label}
                </span>
              )}
              {payoutStatus && (
                <span className={cn("rounded px-1 py-0.5 text-[9px] font-medium", payoutStatus.badgeTone)}>
                  {payoutStatus.badgeText}
                </span>
              )}
            </div>
            <div className="truncate text-xs font-bold leading-tight text-tx-1">{displayName}</div>
            {!breached && funded && account.fundedAt && (
              <div className="mt-0.5 text-[9px] text-tx-4">Funded {fmtDate(account.fundedAt)}</div>
            )}
            <div className="mt-1.5 flex gap-1.5">
              <div className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-hover px-2 py-1">
                <p className="text-[8px] font-semibold uppercase tracking-wider text-tx-4">Bal</p>
                <p className={cn("mt-0.5 text-xs font-bold tabular-nums leading-none", breached ? "text-tx-3" : "text-tx-1")}>{fmtUSD(balance)}</p>
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-border-subtle bg-bg-hover px-2 py-1">
                <p className="text-[8px] font-semibold uppercase tracking-wider text-tx-4">{challenge ? "Need" : "Buf"}</p>
                <p className="mt-0.5 truncate text-xs font-bold tabular-nums leading-none text-tx-1">{challenge ? targetValue : fmtUSD(snapshot?.distanceToMll ?? 0)}</p>
              </div>
            </div>
            {payoutStatus && (
              <p className="mt-1 line-clamp-2 text-[9px] leading-snug text-tx-4">
                <span className={cn("font-semibold", payoutStatus.badgeTone)}>{payoutStatus.badgeText}:</span>{" "}
                {payoutStatus.summary}
                {payoutStatus.detail.cycleProfit !== null && (
                  <span className="ml-1 font-mono tabular-nums text-tx-3">{fmtUSD(payoutStatus.detail.cycleProfit)}</span>
                )}
              </p>
            )}
          </button>
          <div className="flex shrink-0 items-start gap-0.5">
            {actionControls}
          </div>
        </div>

        <div className="mt-1.5 rounded-lg border border-border-subtle bg-bg-subtle px-2 py-1.5">
          <div className="flex items-center justify-between gap-2 text-[9px]">
            <span className="min-w-0 flex-1 truncate text-tx-3">{progressLabel}</span>
            <button
              type="button"
              onClick={() => setDetailOpen(true)}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border-subtle bg-bg-hover px-1.5 py-0.5 text-[9px] font-semibold text-tx-2"
            >
              <BookOpen size={9} />
              More
            </button>
          </div>
          <div className="mt-1 h-1 rounded-full overflow-hidden bg-[rgba(var(--surface-rgb),0.08)]">
            <div
              className="h-full transition-[width,background] duration-500"
              style={{
                width: `${progressWidth}%`,
                background: challenge
                  ? "linear-gradient(90deg,var(--color-warn),var(--color-warn))"
                  : bufferRatio > 40
                    ? "linear-gradient(90deg,var(--color-profit),var(--color-teal))"
                    : bufferRatio > 15
                      ? "linear-gradient(90deg,var(--color-warn),var(--color-warn))"
                      : "linear-gradient(90deg,var(--color-loss),var(--color-loss))",
              }}
            />
          </div>
        </div>
      </div>

      <div className="hidden sm:grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-1 mb-1.5 flex-wrap">
            <span className={cn("badge text-[10px]", getStatusBg(account.status))}>{account.status}</span>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: `${firmColor}15`, color: firmColor }}
            >
              {FIRM_SHORT[account.firm] ?? account.firm.split(" ")[0]}
            </span>
            {snapshot?.program && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-tx-3">
                {snapshot.program.label}
              </span>
            )}
            {payoutStatus && (
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", payoutStatus.badgeTone)}>
                {payoutStatus.badgeText}
              </span>
            )}
            {breached && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-tx-3">
                Was {phaseLabel}
              </span>
            )}
          </div>
          <div className="text-tx-1 text-sm font-bold leading-tight truncate">{displayName}</div>
          {!breached && funded && account.fundedAt && (
            <div className="text-[10px] text-tx-4 mt-0.5">Funded from {fmtDate(account.fundedAt)}</div>
          )}
          <div className="text-tx-4 text-[11px] mt-0.5 truncate">{account.firm}</div>
          {account.notes && (
            <p className="text-[10px] text-tx-4 mt-1 leading-relaxed">{account.notes}</p>
          )}
          {payoutStatus && (
            <p className="text-[10px] text-tx-3 mt-1 leading-relaxed">
              {payoutStatus.summary}
            </p>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4 mb-0.5">Balance</p>
          <p className={cn("text-base font-black tabular-nums leading-tight", breached ? "text-tx-3" : "text-tx-1")}>{fmtUSD(balance)}</p>
          <p className={cn("text-[11px] font-semibold tabular-nums mt-0.5", pnl >= 0 ? "text-profit" : "text-loss")}>
            {performanceLabel}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4 mb-0.5">{challenge ? "Pass Target" : "MLL Floor"}</p>
          {snapshot ? (
            <>
              <p className="text-sm font-bold tabular-nums text-tx-1 leading-tight">
                {challenge && snapshot.profitTarget !== null ? fmtUSD(snapshot.profitTarget) : fmtUSD(snapshot.mllFloor)}
              </p>
              <p className="text-[11px] text-tx-3 mt-0.5">
                {challenge && snapshot.amountToPass !== null
                  ? `${fmtUSD(snapshot.amountToPass)} left`
                  : `${fmtUSD(snapshot.distanceToMll)} buffer`}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold tabular-nums text-tx-1 leading-tight">Manual</p>
          )}
        </div>

        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4 mb-0.5">{challenge ? "Progress" : "Risk"}</p>
          {snapshot ? (
            <>
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-tx-3">
                  {challenge
                    ? `${snapshot.progressPct?.toFixed(0) ?? "0"}% to target`
                    : snapshot.bufferHealth === "critical"
                      ? "Critical"
                      : snapshot.bufferHealth === "tight"
                        ? "Tight"
                        : "Healthy"}
                </span>
                {snapshot.currentDll !== null && (
                  <span className="font-medium text-tx-2">DLL {fmtUSD(snapshot.currentDll)}</span>
                )}
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                <div
                  className="h-full transition-[width,background] duration-500"
                  style={{
                    width: `${challenge ? snapshot.progressPct ?? 0 : bufferRatio}%`,
                    background: challenge
                      ? "linear-gradient(90deg,var(--color-warn),var(--color-warn))"
                      : bufferRatio > 40
                        ? "linear-gradient(90deg,var(--color-profit),var(--color-teal))"
                        : bufferRatio > 15
                          ? "linear-gradient(90deg,var(--color-warn),var(--color-warn))"
                          : "linear-gradient(90deg,var(--color-loss),var(--color-loss))",
                  }}
                />
              </div>
              <p className="text-[10px] text-tx-4 mt-0.5 leading-tight">
                {challenge
                  ? `Start ${fmtUSD(snapshot.initialBalance)}`
                  : `${snapshot.locked ? "Locked" : "Trail"} ${fmtUSD(snapshot.lockFloor)} · peak ${fmtUSD(snapshot.peakBalance)}`}
              </p>
            </>
          ) : (
            <p className="text-[11px] text-tx-3 leading-tight">No preset</p>
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
              style={{ background: `${firmColor}15`, color: firmColor }}
            >
              {account.firm}
            </span>
            {snapshot?.program && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-tx-3">
                {snapshot.program.label}
              </span>
            )}
            {payoutStatus && (
              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-md", payoutStatus.badgeTone)}>
                {payoutStatus.badgeText}
              </span>
            )}
            {breached && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-tx-3">
                Was {phaseLabel}
              </span>
            )}
          </div>

          {account.notes && (
            <p className="text-sm leading-relaxed text-tx-3">{account.notes}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[rgba(var(--border-rgb),0.03)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-tx-4">Balance</p>
              <p className={cn("mt-1 text-base font-black tabular-nums", breached ? "text-tx-3" : "text-tx-1")}>{fmtUSD(balance)}</p>
              <p className={cn("mt-1 text-[11px] font-semibold tabular-nums", pnl >= 0 ? "text-profit" : "text-loss")}>
                {performanceLabel}
              </p>
            </div>
            <div className="rounded-2xl bg-[rgba(var(--border-rgb),0.03)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-tx-4">{challenge ? "Need to pass" : "MLL floor"}</p>
              <p className="mt-1 text-base font-black tabular-nums text-tx-1">{targetValue}</p>
              <p className="mt-1 text-[11px] text-tx-3">{targetMeta}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-[rgba(var(--border-rgb),0.03)] px-3 py-3">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-tx-2">{progressLabel}</span>
              {snapshot && snapshot.currentDll !== null && (
                <span className="text-tx-3">DLL {fmtUSD(snapshot.currentDll)}</span>
              )}
            </div>
            <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
              <div
                className="h-full transition-[width,background] duration-500"
                style={{
                  width: `${progressWidth}%`,
                  background: challenge
                    ? "linear-gradient(90deg,var(--color-warn),var(--color-warn))"
                    : bufferRatio > 40
                      ? "linear-gradient(90deg,var(--color-profit),var(--color-teal))"
                      : bufferRatio > 15
                        ? "linear-gradient(90deg,var(--color-warn),var(--color-warn))"
                        : "linear-gradient(90deg,var(--color-loss),var(--color-loss))",
                }}
              />
            </div>
            {progressMeta && (
              <p className="mt-2 text-[11px] text-tx-3">{progressMeta}</p>
            )}
          </div>

          {payoutStatus && (
            <div className="rounded-2xl bg-[rgba(var(--border-rgb),0.03)] px-3 py-3">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className={cn("font-semibold", payoutStatus.badgeTone)}>{payoutStatus.badgeText}</span>
                {payoutStatus.detail.cycleProfit !== null && (
                  <span className="tabular-nums text-tx-2">{fmtUSD(payoutStatus.detail.cycleProfit)}</span>
                )}
              </div>
              <p className="mt-2 text-[11px] text-tx-3">{payoutStatus.summary}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                {payoutStatus.detail.winningDays !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4">Winning Days</p>
                    <p className="mt-1 font-semibold text-tx-1">
                      {payoutStatus.detail.winningDays}
                      {payoutStatus.detail.requiredWinningDays !== null ? ` / ${payoutStatus.detail.requiredWinningDays}` : ""}
                    </p>
                  </div>
                )}
                {payoutStatus.detail.winningDayRule && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4">Day Rule</p>
                    <p className="mt-1 font-semibold text-tx-1">{payoutStatus.detail.winningDayRule}</p>
                  </div>
                )}
                {payoutStatus.detail.bufferRemaining !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4">Payout Buffer</p>
                    <p className={cn("mt-1 font-semibold", payoutStatus.detail.bufferRemaining >= 0 ? "text-profit" : "text-warn")}>
                      {fmtUSD(payoutStatus.detail.bufferRemaining)}
                    </p>
                  </div>
                )}
                {payoutStatus.detail.availableAmount !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4">Available Now</p>
                    <p className={cn("mt-1 font-semibold", payoutStatus.detail.availableAmount > 0 ? "text-profit" : "text-tx-3")}>
                      {fmtUSD(payoutStatus.detail.availableAmount)}
                    </p>
                  </div>
                )}
                {payoutStatus.detail.minimumRequest !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4">Minimum Request</p>
                    <p className="mt-1 font-semibold text-tx-1">{fmtUSD(payoutStatus.detail.minimumRequest)}</p>
                  </div>
                )}
                {payoutStatus.detail.cycleStartDate && (
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4">Cycle Start</p>
                    <p className="mt-1 font-semibold text-tx-1">{fmtDate(payoutStatus.detail.cycleStartDate)}</p>
                  </div>
                )}
                {payoutStatus.detail.consistencyPct !== null && (
                  <div className="col-span-2">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4">Consistency</p>
                    <p className="mt-1 font-semibold text-tx-1">
                      {payoutStatus.detail.consistencyPct.toFixed(0)}%
                      {payoutStatus.detail.consistencyLimit !== null ? ` / ${payoutStatus.detail.consistencyLimit}% max` : ""}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manually tracked winning days */}
          {(account.winningDays !== undefined || (account.balanceSnapshots?.length ?? 0) > 1) && (
            <div className="rounded-2xl bg-[rgba(var(--border-rgb),0.03)] px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-tx-4 mb-2">Winning Days</p>
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                {account.winningDays !== undefined && (
                  <div>
                    <p className="text-[10px] text-tx-3">Manual</p>
                    <p className="mt-0.5 font-bold text-tx-1">{account.winningDays}</p>
                  </div>
                )}
                {(() => {
                  const snaps = account.balanceSnapshots ?? [];
                  const wdBal = snaps.reduce((count: number, snap: { date: string; balance: number }, i: number) => {
                    if (i === 0) return count;
                    if (snap.balance > snaps[i - 1].balance) return count + 1;
                    return count;
                  }, 0);
                  return (
                    <div>
                      <p className="text-[10px] text-tx-3">From Balance</p>
                      <p className="mt-0.5 font-bold text-tx-1">{wdBal} <span className="text-tx-4 font-normal">/ {snaps.length - 1}</span></p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Unbreach action — shown when breached */}
          {breached && !unbreachPhase && (
            <div className="rounded-xl border border-warn/20 bg-warn/5 px-3 py-3">
              <p className="text-[11px] text-tx-3 mb-2.5">This account was breached. Move it back to active status:</p>
              <div className="flex gap-2">
                <button
                  className="btn-primary btn flex-1"
                  onClick={() => setUnbreachPhase("challenge")}
                >
                  Move to Challenge
                </button>
                <button
                  className="btn-success btn flex-1"
                  onClick={() => setUnbreachPhase("funded")}
                >
                  Move to Funded
                </button>
              </div>
            </div>
          )}

          {/* Unbreach confirm */}
          {breached && unbreachPhase && (
            <div className="rounded-xl border border-teal/20 bg-teal/5 px-3 py-3">
              <p className="text-[11px] text-tx-3 mb-2.5">
                Move this account back to <strong className="text-tx-1">{unbreachPhase}</strong>?
                Dates will be restored accordingly.
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-success btn flex-1"
                  onClick={() => {
                    onUnbreach(unbreachPhase);
                    setDetailOpen(false);
                    setUnbreachPhase(null);
                  }}
                >
                  <CheckCircle2 size={14} />
                  Confirm
                </button>
                <button
                  className="btn-ghost btn flex-1"
                  onClick={() => setUnbreachPhase(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
