import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { fmtUSD, cn } from "@/lib/utils";
import {
  getDefaultProgramKey,
  getProgramOptions,
  getProgramRuleByKeySize,
  type PropPhase,
  type PropProgramKey,
} from "@/lib/propRules";

export function RulesReferencePanel() {
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
    <div className="flex items-center justify-between py-2.5 border-b rgba(var(--border-rgb),0.09) last:border-0">
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
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[rgba(var(--surface-rgb),0.02)] transition-colors"
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
        <div className="border-t rgba(var(--border-rgb),0.12)">
          <div className="flex px-5 pt-4 gap-1 border-b rgba(var(--border-rgb),0.12) pb-0">
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
            <p>All amounts are shown in USD. The app calculates the live floor from the plan rules, the current balance, the highest recorded balance, and any linked payouts for that account.</p>
            <p>Lucid and Tradeify funded floors can lock early on payout for products that allow it, and Topstep Express Funded accounts are modeled on the current zero-based XFA paths.</p>
          </div>
        </div>
      )}
    </div>
  );
}
