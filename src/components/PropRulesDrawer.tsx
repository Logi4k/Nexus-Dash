import { useState } from "react";
import { Scale, X } from "lucide-react";
import Modal from "@/components/Modal";
import {
  getProgramOptions,
  getProgramRuleByKeySize,
  type PropPhase,
} from "@/lib/propRules";
import { fmtUSD } from "@/lib/utils";
import { cn } from "@/lib/utils";

const FIRMS = ["Lucid Trading", "Tradeify", "Topstep"] as const;
type Firm = typeof FIRMS[number];

const SIZE_LABELS: Record<number, string> = {
  25000: "25K",
  50000: "50K",
  100000: "100K",
  150000: "150K",
};

function formatDll(rule: ReturnType<typeof getProgramRuleByKeySize>): string {
  if (!rule) return "N/A";
  switch (rule.dll.kind) {
    case "none":
      return "None";
    case "fixed":
      return `$${rule.dll.amount.toLocaleString()}`;
    case "threshold-fixed":
      return `$${rule.dll.amount.toLocaleString()} -> $${rule.dll.scaledAmount.toLocaleString()} @ ${fmtUSD(rule.dll.thresholdBalance, 0)}`;
    case "threshold-profit-percent":
      return rule.dll.amount
        ? `$${rule.dll.amount.toLocaleString()} -> 60% @ ${fmtUSD(rule.dll.thresholdBalance, 0)}`
        : `60% of peak profit @ ${fmtUSD(rule.dll.thresholdBalance, 0)}`;
    default:
      return "None";
  }
}

function PropRulesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [phaseTab, setPhaseTab] = useState<PropPhase>("challenge");

  const renderFirmColumn = (firm: Firm) => {
    const plans = getProgramOptions(firm, phaseTab);
    const sizes = plans[0]?.sizes ?? [];

    return (
      <div key={firm} className="flex-1 min-w-0">
        <div className="text-center text-xs font-bold text-tx-1 pb-3 border-b border-border-subtle mb-3">
          {firm}
        </div>
        <div className="space-y-3">
          {plans.map((plan) => {
            const planSizes = plan.sizes;
            return (
              <div key={plan.key}>
                {/* Plan label */}
                <div className="text-[10px] font-semibold text-accent uppercase tracking-wide mb-2">
                  {plan.label}
                </div>
                {/* Sizes grid */}
                <div className={cn(
                  "grid gap-2",
                  planSizes.length === 4 ? "grid-cols-2" : "grid-cols-1"
                )}>
                  {planSizes.map((size) => {
                    const rule = getProgramRuleByKeySize(plan.key, size);
                    if (!rule) return null;
                    return (
                      <div
                        key={size}
                        className="rounded-lg p-2.5 text-[10px]"
                        style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
                      >
                        <div className="font-bold text-tx-1 mb-1.5">
                          {SIZE_LABELS[size] ?? `${size / 1000}K`}
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-tx-4">EOD DD</span>
                            <span className="text-tx-2 font-medium">{fmtUSD(rule.drawdown)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-tx-4">DLL</span>
                            <span className={cn(
                              "font-medium",
                              rule.dll.kind === "none" ? "text-profit" : "text-tx-2"
                            )}>
                              {formatDll(rule).split(" @")[0]}
                            </span>
                          </div>
                          {rule.profitTarget !== null && (
                            <div className="flex justify-between">
                              <span className="text-tx-4">Target</span>
                              <span className="text-tx-2 font-medium">{fmtUSD(rule.profitTarget)}</span>
                            </div>
                          )}
                          {rule.split && (
                            <div className="flex justify-between">
                              <span className="text-tx-4">Split</span>
                              <span className="text-tx-2 font-medium">{rule.split}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-tx-4">MLL Lock</span>
                            <span className="text-tx-2 font-medium">{fmtUSD(rule.lockFloor)}</span>
                          </div>
                          {rule.weekendHolding !== null && (
                            <div className="flex justify-between">
                              <span className="text-tx-4">Weekend</span>
                              <span className={cn("font-medium", rule.weekendHolding ? "text-profit" : "text-loss")}>
                                {rule.weekendHolding ? "Allowed" : "No"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Prop Trading Rules" size="lg">
      <div className="space-y-4">
        {/* Phase tabs */}
        <div className="flex gap-2">
          {([
            { key: "challenge" as const, label: "Challenge" },
            { key: "funded" as const, label: "Funded" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPhaseTab(key)}
              className={cn("px-4 py-2 rounded-lg text-xs font-medium transition-all", phaseTab === key
                ? "bg-accent/10 text-accent border border-accent/30"
                : "text-tx-3 hover:text-tx-1 hover:bg-bg-hover border border-transparent"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Condensed rules matrix */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {FIRMS.map(renderFirmColumn)}
        </div>

        {/* Footer note */}
        <div className="text-[10px] text-tx-4 border-t border-border-subtle pt-3 space-y-1">
          <p>All amounts in USD. MLL = Maximum Loss Limit (floor). DLL = Daily Loss Limit. EOD DD = End of Day Drawdown.</p>
          <p>Lucid and Tradeify funded floors may lock early on payout. Topstep Express Funded uses zero-based XFA model.</p>
        </div>
      </div>
    </Modal>
  );
}

export default PropRulesDrawer;
