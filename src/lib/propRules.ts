import type { Account } from "@/types";
import { normalizeAccountStatus } from "@/lib/accountStatus";
import { toNum } from "@/lib/utils";

export type PropPhase = "challenge" | "funded";

export type PropProgramKey =
  | "lucid-flex-challenge"
  | "lucid-flex-funded"
  | "lucid-pro-challenge"
  | "lucid-pro-funded"
  | "tradeify-growth-challenge"
  | "tradeify-growth-funded"
  | "tradeify-select-evaluation"
  | "tradeify-select-flex-funded"
  | "tradeify-select-daily-funded"
  | "topstep-combine"
  | "topstep-xfa-standard";

type DllRule =
  | { kind: "none" }
  | { kind: "fixed"; amount: number }
  | { kind: "threshold-fixed"; amount: number; thresholdBalance: number; scaledAmount: number }
  | { kind: "threshold-profit-percent"; amount: number | null; thresholdBalance: number; profitPercent: number };

export interface PropProgramRule {
  key: PropProgramKey;
  firm: "Lucid Trading" | "Tradeify" | "Topstep";
  phase: PropPhase;
  label: string;
  size: number;
  profitTarget: number | null;
  drawdown: number;
  lockFloor: number;
  lockBalance: number;
  dll: DllRule;
  maxContracts: string;
  evalConsistency: string | null;
  fundedConsistency: string | null;
  payoutPolicy: string | null;
  split: string | null;
  weekendHolding: boolean | null;
  notes: string[];
}

export interface PropProgramOption {
  key: PropProgramKey;
  label: string;
  sizes: number[];
}

export interface PropAccountSnapshot {
  phase: PropPhase;
  size: number;
  balance: number;
  initialBalance: number;
  peakBalance: number;
  profit: number;
  mllFloor: number;
  lockBalance: number;
  lockFloor: number;
  distanceToMll: number;
  breached: boolean;
  profitTarget: number | null;
  amountToPass: number | null;
  progressPct: number | null;
  currentDll: number | null;
  program: PropProgramRule;
}

type ProgramDefinition = Omit<PropProgramRule, "size" | "drawdown" | "lockFloor" | "lockBalance" | "profitTarget" | "dll" | "maxContracts"> & {
  sizes: Record<number, {
    drawdown: number;
    profitTarget: number | null;
    dll: DllRule;
    maxContracts: string;
  }>;
  lockFloorOffset: number;
  lockBalanceOffset: (drawdown: number) => number;
};

const FIXED_PLUS_100 = (drawdown: number) => drawdown + 100;
const FIXED_ONLY = (drawdown: number) => drawdown;

const PROGRAM_DEFINITIONS: Record<PropProgramKey, ProgramDefinition> = {
  "lucid-flex-challenge": {
    key: "lucid-flex-challenge",
    firm: "Lucid Trading",
    phase: "challenge",
    label: "LucidFlex",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: "50% consistency",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: true,
    notes: ["EOD trailing drawdown", "Upgrade once profit target and consistency are met"],
    sizes: {
      25000: { drawdown: 1000, profitTarget: 1250, dll: { kind: "none" }, maxContracts: "2 mini / 20 micro" },
      50000: { drawdown: 2000, profitTarget: 3000, dll: { kind: "none" }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 3000, profitTarget: 6000, dll: { kind: "none" }, maxContracts: "6 mini / 60 micro" },
      150000: { drawdown: 4500, profitTarget: 9000, dll: { kind: "none" }, maxContracts: "10 mini / 100 micro" },
    },
  },
  "lucid-flex-funded": {
    key: "lucid-flex-funded",
    firm: "Lucid Trading",
    phase: "funded",
    label: "LucidFlex",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: null,
    fundedConsistency: "No funded consistency",
    payoutPolicy: "5 profitable days",
    split: "90 / 10",
    weekendHolding: true,
    notes: ["EOD trailing drawdown", "LucidFlex payouts do not reduce the MLL"],
    sizes: {
      25000: { drawdown: 1000, profitTarget: null, dll: { kind: "none" }, maxContracts: "2 mini / 20 micro" },
      50000: { drawdown: 2000, profitTarget: null, dll: { kind: "none" }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 3000, profitTarget: null, dll: { kind: "none" }, maxContracts: "6 mini / 60 micro" },
      150000: { drawdown: 4500, profitTarget: null, dll: { kind: "none" }, maxContracts: "10 mini / 100 micro" },
    },
  },
  "lucid-pro-challenge": {
    key: "lucid-pro-challenge",
    firm: "Lucid Trading",
    phase: "challenge",
    label: "LucidPro",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: "No eval consistency",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: true,
    notes: ["EOD trailing drawdown", "Fixed soft DLL applies during evaluation"],
    sizes: {
      25000: { drawdown: 1000, profitTarget: 1250, dll: { kind: "none" }, maxContracts: "2 mini / 20 micro" },
      50000: { drawdown: 2000, profitTarget: 3000, dll: { kind: "fixed", amount: 1200 }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 3000, profitTarget: 6000, dll: { kind: "fixed", amount: 1800 }, maxContracts: "6 mini / 60 micro" },
      150000: { drawdown: 4500, profitTarget: 9000, dll: { kind: "fixed", amount: 2700 }, maxContracts: "10 mini / 100 micro" },
    },
  },
  "lucid-pro-funded": {
    key: "lucid-pro-funded",
    firm: "Lucid Trading",
    phase: "funded",
    label: "LucidPro",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: null,
    fundedConsistency: "40% consistency for payout eligibility",
    payoutPolicy: "5 profitable days",
    split: "90 / 10",
    weekendHolding: true,
    notes: ["Fixed DLL until the initial trail balance is cleared", "After that, DLL becomes 60% of peak EOD profit"],
    sizes: {
      25000: { drawdown: 1000, profitTarget: null, dll: { kind: "none" }, maxContracts: "2 mini / 20 micro" },
      50000: { drawdown: 2000, profitTarget: null, dll: { kind: "threshold-profit-percent", amount: 1200, thresholdBalance: 52100, profitPercent: 0.6 }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 3000, profitTarget: null, dll: { kind: "threshold-profit-percent", amount: 1800, thresholdBalance: 103100, profitPercent: 0.6 }, maxContracts: "6 mini / 60 micro" },
      150000: { drawdown: 4500, profitTarget: null, dll: { kind: "threshold-profit-percent", amount: 2700, thresholdBalance: 154600, profitPercent: 0.6 }, maxContracts: "10 mini / 100 micro" },
    },
  },
  "tradeify-growth-challenge": {
    key: "tradeify-growth-challenge",
    firm: "Tradeify",
    phase: "challenge",
    label: "Growth",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: "35% consistency",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "Soft daily loss limit applies during evaluation"],
    sizes: {
      50000: { drawdown: 2000, profitTarget: 3000, dll: { kind: "fixed", amount: 1250 }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 3500, profitTarget: 6000, dll: { kind: "fixed", amount: 2500 }, maxContracts: "8 mini / 80 micro" },
      150000: { drawdown: 5000, profitTarget: 9000, dll: { kind: "fixed", amount: 3750 }, maxContracts: "12 mini / 120 micro" },
    },
  },
  "tradeify-growth-funded": {
    key: "tradeify-growth-funded",
    firm: "Tradeify",
    phase: "funded",
    label: "Growth",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: null,
    fundedConsistency: "35% max day for payout eligibility",
    payoutPolicy: "5 qualifying days and balance threshold",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "DLL scales up to the full drawdown once the account reaches 6% profit"],
    sizes: {
      50000: { drawdown: 2000, profitTarget: null, dll: { kind: "threshold-fixed", amount: 1250, thresholdBalance: 53000, scaledAmount: 2000 }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 3500, profitTarget: null, dll: { kind: "threshold-fixed", amount: 2500, thresholdBalance: 106000, scaledAmount: 3500 }, maxContracts: "8 mini / 80 micro" },
      150000: { drawdown: 5000, profitTarget: null, dll: { kind: "threshold-fixed", amount: 3750, thresholdBalance: 159000, scaledAmount: 5000 }, maxContracts: "12 mini / 120 micro" },
    },
  },
  "tradeify-select-evaluation": {
    key: "tradeify-select-evaluation",
    firm: "Tradeify",
    phase: "challenge",
    label: "Select Evaluation",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: "40% consistency",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "No daily loss limit during evaluation", "Minimum 3 trading days"],
    sizes: {
      50000: { drawdown: 2000, profitTarget: 2500, dll: { kind: "none" }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 3000, profitTarget: 5000, dll: { kind: "none" }, maxContracts: "8 mini / 80 micro" },
      150000: { drawdown: 4500, profitTarget: 7500, dll: { kind: "none" }, maxContracts: "12 mini / 120 micro" },
    },
  },
  "tradeify-select-flex-funded": {
    key: "tradeify-select-flex-funded",
    firm: "Tradeify",
    phase: "funded",
    label: "Select Flex",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: null,
    fundedConsistency: "No funded consistency",
    payoutPolicy: "5 winning days and new profit above last payout",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "No daily loss limit"],
    sizes: {
      50000: { drawdown: 2000, profitTarget: null, dll: { kind: "none" }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 3000, profitTarget: null, dll: { kind: "none" }, maxContracts: "8 mini / 80 micro" },
      150000: { drawdown: 4500, profitTarget: null, dll: { kind: "none" }, maxContracts: "12 mini / 120 micro" },
    },
  },
  "tradeify-select-daily-funded": {
    key: "tradeify-select-daily-funded",
    firm: "Tradeify",
    phase: "funded",
    label: "Select Daily",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: null,
    fundedConsistency: "No funded consistency",
    payoutPolicy: "Daily payouts with per-request buffer requirements",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "DLL scales up to the full drawdown once the account reaches 6% profit"],
    sizes: {
      50000: { drawdown: 2000, profitTarget: null, dll: { kind: "threshold-fixed", amount: 1000, thresholdBalance: 53000, scaledAmount: 2000 }, maxContracts: "4 mini / 40 micro" },
      100000: { drawdown: 2500, profitTarget: null, dll: { kind: "threshold-fixed", amount: 1250, thresholdBalance: 106000, scaledAmount: 2500 }, maxContracts: "8 mini / 80 micro" },
      150000: { drawdown: 3500, profitTarget: null, dll: { kind: "threshold-fixed", amount: 1750, thresholdBalance: 159000, scaledAmount: 3500 }, maxContracts: "12 mini / 120 micro" },
    },
  },
  "topstep-combine": {
    key: "topstep-combine",
    firm: "Topstep",
    phase: "challenge",
    label: "Trading Combine",
    lockFloorOffset: 0,
    lockBalanceOffset: FIXED_ONLY,
    evalConsistency: "Best day <= 50% of total profit",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: false,
    notes: ["Maximum loss limit locks at starting balance", "Current TopstepX combines do not enforce an automatic DLL"],
    sizes: {
      50000: { drawdown: 2000, profitTarget: 3000, dll: { kind: "none" }, maxContracts: "5 mini / 50 micro" },
      100000: { drawdown: 3000, profitTarget: 6000, dll: { kind: "none" }, maxContracts: "10 mini / 100 micro" },
      150000: { drawdown: 4500, profitTarget: 9000, dll: { kind: "none" }, maxContracts: "15 mini / 150 micro" },
    },
  },
  "topstep-xfa-standard": {
    key: "topstep-xfa-standard",
    firm: "Topstep",
    phase: "funded",
    label: "Express Funded",
    lockFloorOffset: 0,
    lockBalanceOffset: FIXED_ONLY,
    evalConsistency: null,
    fundedConsistency: "Standard path: 5 winning days of $150+",
    payoutPolicy: "90 / 10 standard XFA payout path",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["Modeled as Express Funded Standard", "Current TopstepX funded accounts do not enforce an automatic DLL by default"],
    sizes: {
      50000: { drawdown: 2000, profitTarget: null, dll: { kind: "none" }, maxContracts: "5 mini / 50 micro" },
      100000: { drawdown: 3000, profitTarget: null, dll: { kind: "none" }, maxContracts: "10 mini / 100 micro" },
      150000: { drawdown: 4500, profitTarget: null, dll: { kind: "none" }, maxContracts: "15 mini / 150 micro" },
    },
  },
};

const PROGRAM_OPTIONS: Record<PropProgramRule["firm"], Record<PropPhase, PropProgramOption[]>> = {
  "Lucid Trading": {
    challenge: [
      { key: "lucid-flex-challenge", label: "LucidFlex", sizes: [25000, 50000, 100000, 150000] },
      { key: "lucid-pro-challenge", label: "LucidPro", sizes: [25000, 50000, 100000, 150000] },
    ],
    funded: [
      { key: "lucid-flex-funded", label: "LucidFlex", sizes: [25000, 50000, 100000, 150000] },
      { key: "lucid-pro-funded", label: "LucidPro", sizes: [25000, 50000, 100000, 150000] },
    ],
  },
  Tradeify: {
    challenge: [
      { key: "tradeify-growth-challenge", label: "Growth", sizes: [50000, 100000, 150000] },
      { key: "tradeify-select-evaluation", label: "Select Evaluation", sizes: [50000, 100000, 150000] },
    ],
    funded: [
      { key: "tradeify-growth-funded", label: "Growth", sizes: [50000, 100000, 150000] },
      { key: "tradeify-select-flex-funded", label: "Select Flex", sizes: [50000, 100000, 150000] },
      { key: "tradeify-select-daily-funded", label: "Select Daily", sizes: [50000, 100000, 150000] },
    ],
  },
  Topstep: {
    challenge: [
      { key: "topstep-combine", label: "Trading Combine", sizes: [50000, 100000, 150000] },
    ],
    funded: [
      { key: "topstep-xfa-standard", label: "Express Funded", sizes: [50000, 100000, 150000] },
    ],
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function parseAccountSize(type: string): number | null {
  if (!type) return null;
  const match = type.match(/(25|50|100|150)\s*k?/i);
  if (!match) return null;
  return Number(match[1]) * 1000;
}

function normalizeType(type: string): string {
  return (type ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function getAccountPhase(account: Pick<Account, "status" | "phaseHint">): PropPhase | null {
  const normalized = normalizeAccountStatus(account.status);
  if (normalized === "challenge" || normalized === "funded") return normalized;
  return account.phaseHint ?? null;
}

function buildRule(definition: ProgramDefinition, size: number): PropProgramRule | null {
  const sizeRule = definition.sizes[size];
  if (!sizeRule) return null;

  return {
    key: definition.key,
    firm: definition.firm,
    phase: definition.phase,
    label: definition.label,
    size,
    profitTarget: sizeRule.profitTarget,
    drawdown: sizeRule.drawdown,
    lockFloor: size + definition.lockFloorOffset,
    lockBalance: size + definition.lockBalanceOffset(sizeRule.drawdown),
    dll: sizeRule.dll,
    maxContracts: sizeRule.maxContracts,
    evalConsistency: definition.evalConsistency,
    fundedConsistency: definition.fundedConsistency,
    payoutPolicy: definition.payoutPolicy,
    split: definition.split,
    weekendHolding: definition.weekendHolding,
    notes: definition.notes,
  };
}

export function getProgramOptions(
  firm: string,
  phase: PropPhase,
): PropProgramOption[] {
  if (!Object.prototype.hasOwnProperty.call(PROGRAM_OPTIONS, firm)) return [];
  return PROGRAM_OPTIONS[firm as keyof typeof PROGRAM_OPTIONS][phase];
}

export function getProgramRuleByKeySize(key: PropProgramKey, size: number): PropProgramRule | null {
  return buildRule(PROGRAM_DEFINITIONS[key], size);
}

export function buildProgramTypeLabel(key: PropProgramKey, size: number): string {
  const definition = PROGRAM_DEFINITIONS[key];
  return `${definition.label} ${size / 1000}K`;
}

export function inferProgramKey(
  account: Pick<Account, "firm" | "type" | "status" | "phaseHint">,
): PropProgramKey | null {
  const type = normalizeType(account.type);
  const inferredPhase =
    getAccountPhase(account) ??
    (() => {
      if (type.includes("funded") || type.includes("express") || type.includes("xfa") || type.includes("daily") || type.includes("selectflex")) {
        return "funded" as const;
      }
      return "challenge" as const;
    })();

  if (account.firm === "Lucid Trading") {
    if (type.includes("pro") && !type.includes("flex")) {
      return inferredPhase === "funded" ? "lucid-pro-funded" : "lucid-pro-challenge";
    }
    if (type.includes("flex")) {
      return inferredPhase === "funded" ? "lucid-flex-funded" : "lucid-flex-challenge";
    }
    return null;
  }

  if (account.firm === "Tradeify") {
    if (type.includes("growth")) {
      return inferredPhase === "funded" ? "tradeify-growth-funded" : "tradeify-growth-challenge";
    }
    if (type.includes("select")) {
      if (inferredPhase === "challenge") return "tradeify-select-evaluation";
      if (type.includes("daily")) return "tradeify-select-daily-funded";
      return "tradeify-select-flex-funded";
    }
    return null;
  }

  if (account.firm === "Topstep") {
    if (inferredPhase === "funded" || type.includes("express") || type.includes("xfa") || type.includes("funded")) {
      return "topstep-xfa-standard";
    }
    return "topstep-combine";
  }

  return null;
}

export function getProgramRule(
  account: Pick<Account, "firm" | "type" | "status" | "phaseHint">,
): PropProgramRule | null {
  const size = parseAccountSize(account.type);
  if (!size) return null;
  const key = inferProgramKey(account);
  if (!key) return null;
  return buildRule(PROGRAM_DEFINITIONS[key], size);
}

function getCurrentDll(rule: PropProgramRule, peakBalance: number, initialBalance: number): number | null {
  switch (rule.dll.kind) {
    case "none":
      return null;
    case "fixed":
      return rule.dll.amount > 0 ? rule.dll.amount : null;
    case "threshold-fixed":
      return peakBalance >= rule.dll.thresholdBalance ? rule.dll.scaledAmount : rule.dll.amount;
    case "threshold-profit-percent": {
      const fixedAmount = rule.dll.amount;
      if (peakBalance < rule.dll.thresholdBalance) return fixedAmount;
      const scaled = Math.max(0, (peakBalance - initialBalance) * rule.dll.profitPercent);
      return scaled > 0 ? scaled : fixedAmount;
    }
    default:
      return null;
  }
}

export function getPropAccountSnapshot(account: Pick<Account, "firm" | "type" | "status" | "phaseHint" | "balance" | "initialBalance" | "peakBalance">): PropAccountSnapshot | null {
  const program = getProgramRule(account);
  if (!program) return null;

  const balance = toNum(account.balance);
  const initialBalance = program.size;
  const peakBalance = Math.max(initialBalance, toNum(account.peakBalance ?? initialBalance), balance);
  const rawFloor = Math.max(initialBalance - program.drawdown, peakBalance - program.drawdown);
  const mllFloor = peakBalance >= program.lockBalance
    ? Math.max(rawFloor, program.lockFloor)
    : rawFloor;
  const profit = balance - initialBalance;
  const amountToPass = program.profitTarget !== null
    ? Math.max(0, program.profitTarget - profit)
    : null;
  const progressPct = program.profitTarget !== null
    ? clamp((profit / program.profitTarget) * 100, 0, 100)
    : null;

  return {
    phase: program.phase,
    size: program.size,
    balance,
    initialBalance,
    peakBalance,
    profit,
    mllFloor,
    lockBalance: program.lockBalance,
    lockFloor: program.lockFloor,
    distanceToMll: balance - mllFloor,
    breached: balance <= mllFloor,
    profitTarget: program.profitTarget,
    amountToPass,
    progressPct,
    currentDll: getCurrentDll(program, peakBalance, initialBalance),
    program,
  };
}

export function normalizeAccountWithPropRules(account: Account): Account {
  const existingStatus = normalizeAccountStatus(account.status);
  const phase = getAccountPhase(account);
  const snapshot = getPropAccountSnapshot(account);

  if (!snapshot) {
    if (phase && existingStatus !== "breached") {
      return { ...account, phaseHint: phase };
    }
    return account;
  }

  const nextPeak = Math.max(toNum(account.peakBalance ?? 0), snapshot.peakBalance);
  const nextStatus =
    existingStatus === "breached" || snapshot.breached
      ? "Breached"
      : snapshot.phase === "funded"
        ? "Funded"
        : "Challenge";

  return {
    ...account,
    status: nextStatus,
    phaseHint: snapshot.phase,
    initialBalance: snapshot.initialBalance,
    peakBalance: nextPeak,
    mll: snapshot.mllFloor,
  };
}

export function getDefaultProgramKey(firm: string, phase: PropPhase): PropProgramKey | null {
  const options = getProgramOptions(firm, phase);
  return options[0]?.key ?? null;
}

export function getDefaultProgramSize(key: PropProgramKey): number | null {
  const definition = PROGRAM_DEFINITIONS[key];
  const sizes = Object.keys(definition.sizes).map(Number).sort((a, b) => a - b);
  return sizes[0] ?? null;
}

export function getPromotedProgramKey(key: PropProgramKey): PropProgramKey | null {
  switch (key) {
    case "lucid-flex-challenge":
      return "lucid-flex-funded";
    case "lucid-pro-challenge":
      return "lucid-pro-funded";
    case "tradeify-growth-challenge":
      return "tradeify-growth-funded";
    case "tradeify-select-evaluation":
      return "tradeify-select-flex-funded";
    case "topstep-combine":
      return "topstep-xfa-standard";
    default:
      return null;
  }
}
