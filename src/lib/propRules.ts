import type { Account, PassedChallenge, TradeEntry, Withdrawal } from "@/types";
import { normalizeAccountStatus } from "@/lib/accountStatus";
import { generateId, toNum, todayLocalIsoDate } from "@/lib/utils";

export type PropPhase = "challenge" | "funded" | "breached";

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
  | "topstep-xfa-standard"
  | "topstep-xfa-consistency";

type BalanceMode = "nominal" | "pnl";

type DllRule =
  | { kind: "none" }
  | { kind: "fixed"; amount: number }
  | { kind: "threshold-fixed"; amount: number; thresholdBalance: number; scaledAmount: number }
  | { kind: "threshold-profit-percent"; amount: number | null; thresholdBalance: number; profitPercent: number };

interface ProgramPayoutRule {
  minBalance: number | null;
  minProfitGoal: number | null;
  winningDays: number | null;
  winningDayAmount: number | null;
  consistencyLimit: number | null;
  minPayoutRequest: number | null;
  payoutSharePct: number | null;
  payoutShareBase: "cycle-profit" | "total-profit" | null;
  cycleProfitMultiplier: number | null;
  payoutCap: number | null;
  resetsAfterPayout: boolean;
}

export interface PropProgramRule {
  key: PropProgramKey;
  firm: "Lucid Trading" | "Tradeify" | "Topstep";
  phase: PropPhase;
  label: string;
  size: number;
  balanceMode: BalanceMode;
  profitTarget: number | null;
  drawdown: number;
  lockFloor: number;
  lockBalance: number;
  lockOnFirstPayout: boolean;
  dll: DllRule;
  maxContracts: string;
  evalConsistency: string | null;
  fundedConsistency: string | null;
  payoutPolicy: string | null;
  split: string | null;
  weekendHolding: boolean | null;
  payout: ProgramPayoutRule | null;
  notes: string[];
}

export interface PropProgramOption {
  key: PropProgramKey;
  label: string;
  sizes: number[];
}

export interface PropAccountContext {
  tradeJournal?: TradeEntry[];
  withdrawals?: Withdrawal[];
}

export interface PropAccountLifecycleResult {
  accounts: Account[];
  passedChallenges: PassedChallenge[];
  changed: boolean;
}

export interface PropAccountSnapshot {
  phase: PropPhase;
  size: number;
  balance: number;
  initialBalance: number;
  peakBalance: number;
  profit: number;
  floorStart: number;
  mllFloor: number;
  lockBalance: number;
  lockFloor: number;
  locked: boolean;
  lockReason: "balance" | "payout" | null;
  lockProgressPct: number;
  distanceToMll: number;
  drawdownLimit: number;
  drawdownRemainingPct: number;
  bufferWarningThreshold: number;
  bufferHealth: "healthy" | "tight" | "critical";
  breached: boolean;
  profitTarget: number | null;
  amountToPass: number | null;
  progressPct: number | null;
  currentDll: number | null;
  linkedPayoutCount: number;
  latestPayoutDate: string | null;
  payoutCycleStartBalance: number | null;
  payoutCycleStartDate: string | null;
  payoutCycleProfit: number | null;
  payoutMinBalance: number | null;
  payoutBufferRemaining: number | null;
  payoutWinningDays: number | null;
  payoutWinningDayAmount: number | null;
  payoutMinimumRequest: number | null;
  payoutAvailableAmount: number | null;
  cycleWinningDays: number | null;
  cycleLargestWinningDay: number | null;
  cycleConsistencyPct: number | null;
  payoutConsistencyLimit: number | null;
  program: PropProgramRule;
}

type ProgramSizeDefinition = {
  drawdown: number;
  profitTarget: number | null;
  dll: DllRule;
  maxContracts: string;
  payout?: Partial<ProgramPayoutRule>;
};

type ProgramDefinition = {
  key: PropProgramKey;
  firm: PropProgramRule["firm"];
  phase: PropPhase;
  label: string;
  balanceMode: BalanceMode;
  lockFloorOffset: number;
  lockBalanceOffset: (drawdown: number) => number;
  lockOnFirstPayout?: boolean;
  evalConsistency: string | null;
  fundedConsistency: string | null;
  payoutPolicy: string | null;
  split: string | null;
  weekendHolding: boolean | null;
  notes: string[];
  sizes: Record<number, ProgramSizeDefinition>;
};

const FIXED_PLUS_100 = (drawdown: number) => drawdown + 100;
const FIXED_ONLY = (drawdown: number) => drawdown;

function normalizeIsoDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim().slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function nextIsoDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function normalizeMatchText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function createPayoutRule(rule?: Partial<ProgramPayoutRule>): ProgramPayoutRule | null {
  if (!rule) return null;
  return {
    minBalance: rule.minBalance ?? null,
    minProfitGoal: rule.minProfitGoal ?? null,
    winningDays: rule.winningDays ?? null,
    winningDayAmount: rule.winningDayAmount ?? null,
    consistencyLimit: rule.consistencyLimit ?? null,
    minPayoutRequest: rule.minPayoutRequest ?? null,
    payoutSharePct: rule.payoutSharePct ?? null,
    payoutShareBase: rule.payoutShareBase ?? null,
    cycleProfitMultiplier: rule.cycleProfitMultiplier ?? null,
    payoutCap: rule.payoutCap ?? null,
    resetsAfterPayout: rule.resetsAfterPayout ?? true,
  };
}

const PROGRAM_DEFINITIONS: Record<PropProgramKey, ProgramDefinition> = {
  "lucid-flex-challenge": {
    key: "lucid-flex-challenge",
    firm: "Lucid Trading",
    phase: "challenge",
    label: "LucidFlex",
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: "50% consistency",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: true,
    notes: ["EOD trailing drawdown", "Upgrade once the profit target and 50% consistency objective are met"],
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
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    lockOnFirstPayout: true,
    evalConsistency: null,
    fundedConsistency: null,
    payoutPolicy: "5 profitable days at the firm threshold, no consistency cap, no fixed cycle profit minimum",
    split: "90 / 10",
    weekendHolding: true,
    notes: ["EOD trailing drawdown", "The floor locks at the first payout request or once the account reaches the lock threshold"],
    sizes: {
      25000: {
        drawdown: 1000,
        profitTarget: null,
        dll: { kind: "none" },
        maxContracts: "2 mini / 20 micro",
        payout: { winningDays: 5, winningDayAmount: 50 },
      },
      50000: {
        drawdown: 2000,
        profitTarget: null,
        dll: { kind: "none" },
        maxContracts: "4 mini / 40 micro",
        payout: { winningDays: 5, winningDayAmount: 100 },
      },
      100000: {
        drawdown: 3000,
        profitTarget: null,
        dll: { kind: "none" },
        maxContracts: "6 mini / 60 micro",
        payout: { winningDays: 5, winningDayAmount: 200 },
      },
      150000: {
        drawdown: 4500,
        profitTarget: null,
        dll: { kind: "none" },
        maxContracts: "10 mini / 100 micro",
        payout: { winningDays: 5, winningDayAmount: 300 },
      },
    },
  },
  "lucid-pro-challenge": {
    key: "lucid-pro-challenge",
    firm: "Lucid Trading",
    phase: "challenge",
    label: "LucidPro",
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: "No evaluation consistency",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: true,
    notes: ["EOD trailing drawdown", "Soft DLL applies during evaluation"],
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
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: null,
    fundedConsistency: "Largest single day must stay within 40% of cycle profit",
    payoutPolicy: "Buffer, consistency, and the LucidPro minimum payout threshold must be met before every payout",
    split: "90 / 10",
    weekendHolding: true,
    notes: ["Fixed DLL until the trail reaches the buffer threshold", "After the threshold, DLL becomes 60% of peak EOD profit"],
    sizes: {
      25000: {
        drawdown: 1000,
        profitTarget: null,
        dll: { kind: "none" },
        maxContracts: "2 mini / 20 micro",
        payout: { minBalance: 26100, minProfitGoal: 500, consistencyLimit: 40, minPayoutRequest: 500 },
      },
      50000: {
        drawdown: 2000,
        profitTarget: null,
        dll: { kind: "threshold-profit-percent", amount: 1200, thresholdBalance: 52100, profitPercent: 0.6 },
        maxContracts: "4 mini / 40 micro",
        payout: { minBalance: 52100, minProfitGoal: 500, consistencyLimit: 40, minPayoutRequest: 500 },
      },
      100000: {
        drawdown: 3000,
        profitTarget: null,
        dll: { kind: "threshold-profit-percent", amount: 1800, thresholdBalance: 103100, profitPercent: 0.6 },
        maxContracts: "6 mini / 60 micro",
        payout: { minBalance: 103100, minProfitGoal: 500, consistencyLimit: 40, minPayoutRequest: 500 },
      },
      150000: {
        drawdown: 4500,
        profitTarget: null,
        dll: { kind: "threshold-profit-percent", amount: 2700, thresholdBalance: 154600, profitPercent: 0.6 },
        maxContracts: "10 mini / 100 micro",
        payout: { minBalance: 154600, minProfitGoal: 500, consistencyLimit: 40, minPayoutRequest: 500 },
      },
    },
  },
  "tradeify-growth-challenge": {
    key: "tradeify-growth-challenge",
    firm: "Tradeify",
    phase: "challenge",
    label: "Growth",
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: "No evaluation consistency requirement",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "Soft DLL applies during evaluation", "Growth can be passed in a single day if the target is reached"],
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
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: null,
    fundedConsistency: "Largest winning day must remain within 35% of cycle profit",
    payoutPolicy: "35% consistency, 5 winning days at the firm threshold, and the minimum balance buffer are required before every payout",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "DLL scales up once the account reaches the 6% profit threshold on the next session"],
    sizes: {
      50000: {
        drawdown: 2000,
        profitTarget: null,
        dll: { kind: "threshold-fixed", amount: 1250, thresholdBalance: 53000, scaledAmount: 2000 },
        maxContracts: "4 mini / 40 micro",
        payout: { minBalance: 53000, winningDays: 5, winningDayAmount: 150, consistencyLimit: 35 },
      },
      100000: {
        drawdown: 3500,
        profitTarget: null,
        dll: { kind: "threshold-fixed", amount: 2500, thresholdBalance: 106000, scaledAmount: 3500 },
        maxContracts: "8 mini / 80 micro",
        payout: { minBalance: 104500, winningDays: 5, winningDayAmount: 200, consistencyLimit: 35 },
      },
      150000: {
        drawdown: 5000,
        profitTarget: null,
        dll: { kind: "threshold-fixed", amount: 3750, thresholdBalance: 159000, scaledAmount: 5000 },
        maxContracts: "12 mini / 120 micro",
        payout: { minBalance: 156500, winningDays: 5, winningDayAmount: 250, consistencyLimit: 35 },
      },
    },
  },
  "tradeify-select-evaluation": {
    key: "tradeify-select-evaluation",
    firm: "Tradeify",
    phase: "challenge",
    label: "Select Evaluation",
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: "40% consistency",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "No DLL during evaluation", "Minimum 3 trading days"],
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
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    lockOnFirstPayout: true,
    evalConsistency: null,
    fundedConsistency: null,
    payoutPolicy: "5 profitable days, no DLL, request up to 50% of total profit within the plan cap",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "The floor locks at the first payout request or when the account reaches the lock threshold", "No DLL"],
    sizes: {
      50000: {
        drawdown: 2000,
        profitTarget: null,
        dll: { kind: "none" },
        maxContracts: "4 mini / 40 micro",
        payout: { winningDays: 5, winningDayAmount: 150, minProfitGoal: 0.01, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 1000 },
      },
      100000: {
        drawdown: 3000,
        profitTarget: null,
        dll: { kind: "none" },
        maxContracts: "8 mini / 80 micro",
        payout: { winningDays: 5, winningDayAmount: 200, minProfitGoal: 0.01, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 1500 },
      },
      150000: {
        drawdown: 4500,
        profitTarget: null,
        dll: { kind: "none" },
        maxContracts: "12 mini / 120 micro",
        payout: { winningDays: 5, winningDayAmount: 250, minProfitGoal: 0.01, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 2500 },
      },
    },
  },
  "tradeify-select-daily-funded": {
    key: "tradeify-select-daily-funded",
    firm: "Tradeify",
    phase: "funded",
    label: "Select Daily",
    balanceMode: "nominal",
    lockFloorOffset: 100,
    lockBalanceOffset: FIXED_PLUS_100,
    evalConsistency: null,
    fundedConsistency: null,
    payoutPolicy: "Daily payout path: stay above the payout buffer and request up to 2x cycle profit within the plan cap",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["EOD trailing drawdown", "DLL scales up once the account reaches the 6% profit threshold on the next session"],
    sizes: {
      50000: {
        drawdown: 2000,
        profitTarget: null,
        dll: { kind: "threshold-fixed", amount: 1000, thresholdBalance: 53000, scaledAmount: 2000 },
        maxContracts: "4 mini / 40 micro",
        payout: { minBalance: 52100, minProfitGoal: 0.01, minPayoutRequest: 250, cycleProfitMultiplier: 2, payoutCap: 1000 },
      },
      100000: {
        drawdown: 2500,
        profitTarget: null,
        dll: { kind: "threshold-fixed", amount: 1250, thresholdBalance: 106000, scaledAmount: 2500 },
        maxContracts: "8 mini / 80 micro",
        payout: { minBalance: 102600, minProfitGoal: 0.01, minPayoutRequest: 250, cycleProfitMultiplier: 2, payoutCap: 1500 },
      },
      150000: {
        drawdown: 3500,
        profitTarget: null,
        dll: { kind: "threshold-fixed", amount: 1750, thresholdBalance: 159000, scaledAmount: 3500 },
        maxContracts: "12 mini / 120 micro",
        payout: { minBalance: 153600, minProfitGoal: 0.01, minPayoutRequest: 250, cycleProfitMultiplier: 2, payoutCap: 2500 },
      },
    },
  },
  "topstep-combine": {
    key: "topstep-combine",
    firm: "Topstep",
    phase: "challenge",
    label: "Trading Combine",
    balanceMode: "nominal",
    lockFloorOffset: 0,
    lockBalanceOffset: FIXED_ONLY,
    evalConsistency: "50% consistency objective",
    fundedConsistency: null,
    payoutPolicy: null,
    split: null,
    weekendHolding: false,
    notes: ["Maximum Loss Limit trails until it locks at the starting balance", "No automatic DLL on TopstepX combines"],
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
    label: "Express Funded Standard",
    balanceMode: "pnl",
    lockFloorOffset: 0,
    lockBalanceOffset: FIXED_ONLY,
    lockOnFirstPayout: true,
    evalConsistency: null,
    fundedConsistency: null,
    payoutPolicy: "5 winning days of $150+, request up to 50% of account balance capped at $5,000",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["XFA accounts start at a $0 balance on platform", "The floor trails end-of-day profit until it locks at $0", "Daily Loss Limit still applies even though there is no profit target"],
    sizes: {
      50000: {
        drawdown: 2000,
        profitTarget: null,
        dll: { kind: "fixed", amount: 1000 },
        maxContracts: "5 mini / 50 micro",
        payout: { winningDays: 5, winningDayAmount: 150, minProfitGoal: 0.01, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 5000 },
      },
      100000: {
        drawdown: 3000,
        profitTarget: null,
        dll: { kind: "fixed", amount: 2000 },
        maxContracts: "10 mini / 100 micro",
        payout: { winningDays: 5, winningDayAmount: 150, minProfitGoal: 0.01, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 5000 },
      },
      150000: {
        drawdown: 4500,
        profitTarget: null,
        dll: { kind: "fixed", amount: 3000 },
        maxContracts: "15 mini / 150 micro",
        payout: { winningDays: 5, winningDayAmount: 150, minProfitGoal: 0.01, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 5000 },
      },
    },
  },
  "topstep-xfa-consistency": {
    key: "topstep-xfa-consistency",
    firm: "Topstep",
    phase: "funded",
    label: "Express Funded Consistency",
    balanceMode: "pnl",
    lockFloorOffset: 0,
    lockBalanceOffset: FIXED_ONLY,
    lockOnFirstPayout: true,
    evalConsistency: null,
    fundedConsistency: "Largest winning day must stay within 40% of cycle profit",
    payoutPolicy: "3 trading days with 40% consistency, request up to 50% of account balance capped at $6,000",
    split: "90 / 10",
    weekendHolding: false,
    notes: ["Available from February 5, 2026", "Consistency resets after every payout", "Daily Loss Limit still applies"],
    sizes: {
      50000: {
        drawdown: 2000,
        profitTarget: null,
        dll: { kind: "fixed", amount: 1000 },
        maxContracts: "5 mini / 50 micro",
        payout: { winningDays: 3, winningDayAmount: 0.01, minProfitGoal: 0.01, consistencyLimit: 40, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 6000 },
      },
      100000: {
        drawdown: 3000,
        profitTarget: null,
        dll: { kind: "fixed", amount: 2000 },
        maxContracts: "10 mini / 100 micro",
        payout: { winningDays: 3, winningDayAmount: 0.01, minProfitGoal: 0.01, consistencyLimit: 40, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 6000 },
      },
      150000: {
        drawdown: 4500,
        profitTarget: null,
        dll: { kind: "fixed", amount: 3000 },
        maxContracts: "15 mini / 150 micro",
        payout: { winningDays: 3, winningDayAmount: 0.01, minProfitGoal: 0.01, consistencyLimit: 40, payoutSharePct: 0.5, payoutShareBase: "total-profit", payoutCap: 6000 },
      },
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
    breached: [],
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
    breached: [],
  },
  Topstep: {
    challenge: [
      { key: "topstep-combine", label: "Trading Combine", sizes: [50000, 100000, 150000] },
    ],
    funded: [
      { key: "topstep-xfa-standard", label: "Express Funded Standard", sizes: [50000, 100000, 150000] },
      { key: "topstep-xfa-consistency", label: "Express Funded Consistency", sizes: [50000, 100000, 150000] },
    ],
    breached: [],
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

function getProgramBaseBalance(definition: ProgramDefinition, size: number): number {
  return definition.balanceMode === "pnl" ? 0 : size;
}

export function getAccountPhase(account: Pick<Account, "status" | "phaseHint">): PropPhase | null {
  const normalized = normalizeAccountStatus(account.status);
  if (normalized === "challenge" || normalized === "funded") return normalized;
  if (normalized === "breached") return "breached";
  return account.phaseHint ?? null;
}

function buildRule(definition: ProgramDefinition, size: number): PropProgramRule | null {
  const sizeRule = definition.sizes[size];
  if (!sizeRule) return null;

  const baseBalance = getProgramBaseBalance(definition, size);

  return {
    key: definition.key,
    firm: definition.firm,
    phase: definition.phase,
    label: definition.label,
    size,
    balanceMode: definition.balanceMode,
    profitTarget: sizeRule.profitTarget,
    drawdown: sizeRule.drawdown,
    lockFloor: baseBalance + definition.lockFloorOffset,
    lockBalance: baseBalance + definition.lockBalanceOffset(sizeRule.drawdown),
    lockOnFirstPayout: Boolean(definition.lockOnFirstPayout),
    dll: sizeRule.dll,
    maxContracts: sizeRule.maxContracts,
    evalConsistency: definition.evalConsistency,
    fundedConsistency: definition.fundedConsistency,
    payoutPolicy: definition.payoutPolicy,
    split: definition.split,
    weekendHolding: definition.weekendHolding,
    payout: createPayoutRule(sizeRule.payout),
    notes: definition.notes,
  };
}

export function getProgramOptions(firm: string, phase: PropPhase): PropProgramOption[] {
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

export function inferProgramKey(account: Pick<Account, "firm" | "type" | "status" | "phaseHint">): PropProgramKey | null {
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
      return type.includes("consistency") ? "topstep-xfa-consistency" : "topstep-xfa-standard";
    }
    return "topstep-combine";
  }

  return null;
}

export function getProgramRule(account: Pick<Account, "firm" | "type" | "status" | "phaseHint">): PropProgramRule | null {
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

function getProgramStartBalance(program: PropProgramRule): number {
  return program.balanceMode === "pnl" ? 0 : program.size;
}

function getLinkedWithdrawals(accountId: string | undefined, withdrawals: Withdrawal[] | undefined): Withdrawal[] {
  if (!accountId || !withdrawals?.length) return [];
  return withdrawals
    .filter((withdrawal) => withdrawal.accountId === accountId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function getPayoutAvailableAmount(
  program: PropProgramRule,
  balance: number,
  initialBalance: number,
  payoutCycleProfit: number | null
): number | null {
  const payout = program.payout;
  if (!payout) return null;

  const caps: number[] = [];

  if (payout.minBalance !== null) {
    caps.push(Math.max(0, balance - payout.minBalance));
  }

  if (payout.payoutSharePct !== null) {
    const profitBase = payout.payoutShareBase === "total-profit"
      ? Math.max(0, balance - initialBalance)
      : Math.max(0, payoutCycleProfit ?? 0);
    caps.push(profitBase * payout.payoutSharePct);
  }

  if (payout.cycleProfitMultiplier !== null) {
    caps.push(Math.max(0, payoutCycleProfit ?? 0) * payout.cycleProfitMultiplier);
  }

  if (payout.payoutCap !== null) {
    caps.push(payout.payoutCap);
  }

  if (caps.length === 0) return null;

  return Math.max(0, Math.min(...caps));
}

function summarizeTradeCycle(
  accountId: string | undefined,
  trades: TradeEntry[] | undefined,
  sinceDate: string | null,
  winningDayAmount: number | null,
  phase: PropPhase,
  includeStartDate: boolean
) {
  if (!accountId || !trades?.length) {
    return {
      winningDays: null,
      largestWinningDay: null,
      consistencyPct: null,
    };
  }

  const dailyPnls = new Map<string, number>();
  for (const trade of trades) {
    if (trade.accountId !== accountId) continue;
    if (trade.accountPhase && trade.accountPhase !== phase) continue;
    if (sinceDate) {
      if (includeStartDate ? trade.date < sinceDate : trade.date <= sinceDate) continue;
    }
    dailyPnls.set(trade.date, (dailyPnls.get(trade.date) ?? 0) + toNum(trade.pnl));
  }

  if (dailyPnls.size === 0) {
    return {
      winningDays: 0,
      largestWinningDay: 0,
      consistencyPct: null,
    };
  }

  const threshold = winningDayAmount ?? 0.01;
  let winningDays = 0;
  let largestWinningDay = 0;
  let totalProfit = 0;

  for (const dayProfit of dailyPnls.values()) {
    if (dayProfit > 0) {
      totalProfit += dayProfit;
      largestWinningDay = Math.max(largestWinningDay, dayProfit);
    }
    if (dayProfit >= threshold) {
      winningDays += 1;
    }
  }

  return {
    winningDays,
    largestWinningDay,
    consistencyPct: totalProfit > 0 ? (largestWinningDay / totalProfit) * 100 : null,
  };
}

function resetAccountForPromotedFunding(account: Account, program: PropProgramRule, fundedAt: string): Account {
  const startBalance = getProgramStartBalance(program);
  // Preserve the challenge peak as the funded account's starting peak
  // so trailing drawdown starts from the highest point achieved in challenge
  const challengePeak = toNum(account.peakBalance ?? account.balance);
  const fundedPeak = Math.max(startBalance, challengePeak);
  return {
    ...account,
    status: "funded",
    phaseHint: "funded",
    fundedAt,
    balance: startBalance,
    initialBalance: startBalance,
    peakBalance: fundedPeak,
    sodBalance: startBalance,
    payoutCycleStartBalance: program.payout ? startBalance : undefined,
    breachedDate: undefined,
    mll: undefined,
  };
}

function findMatchingPassRecord(
  account: Pick<Account, "id" | "firm" | "name" | "type">,
  passedChallenges: PassedChallenge[]
): { index: number; pass: PassedChallenge } | null {
  const byAccountId = passedChallenges.findIndex((pass) => pass.accountId === account.id);
  if (byAccountId >= 0) {
    return { index: byAccountId, pass: passedChallenges[byAccountId] };
  }

  const targetFirm = normalizeMatchText(account.firm);
  const targetType = normalizeMatchText(account.type);
  const targetName = normalizeMatchText(account.name);
  const targetSize = parseAccountSize(account.type);

  const fallbackIndex = passedChallenges.findIndex((pass) => {
    if (pass.accountId) return false;
    if (normalizeMatchText(pass.firm) !== targetFirm) return false;
    const passType = normalizeMatchText(pass.type);
    const passSize = parseAccountSize(pass.type);
    const sameType = passType === targetType;
    const sameSize = targetSize !== null && passSize !== null && targetSize === passSize;
    if (!sameType && !sameSize) return false;
    const passName = normalizeMatchText(pass.name);
    if (targetName && passName && targetName !== passName) return false;
    return true;
  });

  if (fallbackIndex >= 0) {
    return { index: fallbackIndex, pass: passedChallenges[fallbackIndex] };
  }

  return null;
}

function createPassedChallengeRecord(
  account: Pick<Account, "id" | "firm" | "type" | "name" | "balance" | "initialBalance">,
  snapshot: Pick<PropAccountSnapshot, "profitTarget">,
  passedDate: string
): PassedChallenge {
  return {
    id: generateId(),
    accountId: account.id,
    firm: account.firm,
    type: account.type,
    name: account.name,
    passedDate,
    finalBalance: toNum(account.balance),
    initialBalance: toNum(account.initialBalance ?? account.balance),
    profitTarget: snapshot.profitTarget ?? 0,
  };
}

function hasOnlyPreFundingTrades(
  accountId: string | undefined,
  fundedAt: string | undefined,
  trades: TradeEntry[] | undefined
): boolean {
  if (!accountId || !fundedAt || !trades?.length) return false;
  const linkedTrades = trades.filter((trade) => trade.accountId === accountId);
  if (linkedTrades.length === 0) return false;
  return linkedTrades.every((trade) => trade.date < fundedAt);
}

function shouldResetStaleFundingCarryover(
  account: Account,
  snapshot: PropAccountSnapshot,
  context?: PropAccountContext
): boolean {
  if (snapshot.phase !== "funded") return false;
  if (!account.fundedAt) return false;
  if (!hasOnlyPreFundingTrades(account.id, account.fundedAt, context?.tradeJournal)) return false;
  if (snapshot.linkedPayoutCount > 0) return false;
  if ((account.pnlEntries?.length ?? 0) > 0) return false;
  return toNum(account.peakBalance ?? 0) > Math.max(snapshot.initialBalance, snapshot.balance);
}

export function getPropAccountSnapshot(
  account: Pick<Account, "id" | "firm" | "type" | "status" | "phaseHint" | "balance" | "initialBalance" | "peakBalance" | "payoutCycleStartBalance" | "fundedAt">,
  context?: PropAccountContext
): PropAccountSnapshot | null {
  const program = getProgramRule(account);
  if (!program) return null;

  const balance = toNum(account.balance);
  const initialBalance = program.balanceMode === "pnl" ? 0 : program.size;
  const peakBalance = Math.max(initialBalance, toNum(account.peakBalance ?? initialBalance), balance);
  const linkedWithdrawals = getLinkedWithdrawals(account.id, context?.withdrawals);
  const latestPayout = linkedWithdrawals.length > 0 ? linkedWithdrawals[linkedWithdrawals.length - 1] : null;
  const payoutLocked = program.lockOnFirstPayout && linkedWithdrawals.length > 0;
  const balanceLocked = peakBalance >= program.lockBalance;
  const locked = balanceLocked || payoutLocked;
  const trailingFloor = peakBalance - program.drawdown;
  const floorStart = initialBalance - program.drawdown;
  const mllFloor = locked ? Math.max(trailingFloor, program.lockFloor) : trailingFloor;
  const distanceToMll = balance - mllFloor;
  const profit = balance - initialBalance;
  const amountToPass = program.profitTarget !== null
    ? Math.max(0, program.profitTarget - profit)
    : null;
  const progressPct = program.profitTarget !== null
    ? clamp((profit / program.profitTarget) * 100, 0, 100)
    : null;
  const lockProgressPct = program.lockBalance > initialBalance
    ? clamp(((peakBalance - initialBalance) / (program.lockBalance - initialBalance)) * 100, 0, 100)
    : 100;

  const bufferWarningThreshold = Math.max(250, Math.min(program.drawdown * 0.25, 1000));
  const bufferHealth = distanceToMll <= 250
    ? "critical"
    : distanceToMll <= bufferWarningThreshold
      ? "tight"
      : "healthy";

  const payoutCycleStartBalance = latestPayout?.postBalance ?? account.payoutCycleStartBalance ?? initialBalance;
  const payoutCycleStartDate = latestPayout?.date ?? account.fundedAt ?? null;
  const payoutCycleProfit = program.payout ? balance - payoutCycleStartBalance : null;
  const tradeSummary = summarizeTradeCycle(
    account.id,
    context?.tradeJournal,
    payoutCycleStartDate,
    program.payout?.winningDayAmount ?? null,
    program.phase,
    !latestPayout
  );
  const payoutAvailableAmount = getPayoutAvailableAmount(program, balance, initialBalance, payoutCycleProfit);

  return {
    phase: program.phase,
    size: program.size,
    balance,
    initialBalance,
    peakBalance,
    profit,
    floorStart,
    mllFloor,
    lockBalance: program.lockBalance,
    lockFloor: program.lockFloor,
    locked,
    lockReason: balanceLocked ? "balance" : payoutLocked ? "payout" : null,
    lockProgressPct,
    distanceToMll,
    drawdownLimit: program.drawdown,
    drawdownRemainingPct: clamp((distanceToMll / Math.max(program.drawdown, 1)) * 100, 0, 100),
    bufferWarningThreshold,
    bufferHealth,
    breached: balance <= mllFloor,
    profitTarget: program.profitTarget,
    amountToPass,
    progressPct,
    currentDll: getCurrentDll(program, peakBalance, initialBalance),
    linkedPayoutCount: linkedWithdrawals.length,
    latestPayoutDate: latestPayout?.date ?? null,
    payoutCycleStartBalance: program.payout ? payoutCycleStartBalance : null,
    payoutCycleStartDate,
    payoutCycleProfit,
    payoutMinBalance: program.payout?.minBalance ?? null,
    payoutBufferRemaining: program.payout?.minBalance != null ? balance - program.payout.minBalance : null,
    payoutWinningDays: program.payout?.winningDays ?? null,
    payoutWinningDayAmount: program.payout?.winningDayAmount ?? null,
    payoutMinimumRequest: program.payout?.minPayoutRequest ?? null,
    payoutAvailableAmount,
    cycleWinningDays: tradeSummary.winningDays,
    cycleLargestWinningDay: tradeSummary.largestWinningDay,
    cycleConsistencyPct: tradeSummary.consistencyPct,
    payoutConsistencyLimit: program.payout?.consistencyLimit ?? null,
    program,
  };
}

function normalizeAccountLifecycle(
  account: Account,
  passedChallenges: PassedChallenge[] = [],
  context?: PropAccountContext
): { account: Account; passRecord: PassedChallenge | null; passRecordIndex: number | null } {
  const existingStatus = normalizeAccountStatus(account.status);
  const phase = getAccountPhase(account);
  let workingAccount = account;
  let passRecord: PassedChallenge | null = null;
  let passRecordIndex: number | null = null;

  const passMatch = findMatchingPassRecord(workingAccount, passedChallenges);
  if (passMatch && !normalizeIsoDate(workingAccount.fundedAt) && normalizeAccountStatus(workingAccount.status) === "funded") {
    workingAccount = {
      ...workingAccount,
      fundedAt: nextIsoDate(normalizeIsoDate(passMatch.pass.passedDate) ?? todayLocalIsoDate()),
    };
  }

  let snapshot = getPropAccountSnapshot(workingAccount, context);
  let repairedStaleCarryover = false;

  if (!snapshot) {
    if (phase && existingStatus !== "breached") {
      const safePhase = phase === "breached" ? undefined : phase;
      return { account: { ...account, phaseHint: safePhase }, passRecord: null, passRecordIndex: null };
    }
    return { account, passRecord: null, passRecordIndex: null };
  }

  if (
    existingStatus !== "breached" &&
    snapshot.phase === "challenge" &&
    snapshot.amountToPass !== null &&
    snapshot.amountToPass <= 0
  ) {
    const currentKey = inferProgramKey(workingAccount);
    const promotedKey = currentKey ? getPromotedProgramKey(currentKey) : null;
    const challengeType = workingAccount.type;
    const promotedType = promotedKey ? buildProgramTypeLabel(promotedKey, snapshot.size) : workingAccount.type;
    const matchedPassDate = normalizeIsoDate(passMatch?.pass.passedDate);
    const passedDate = matchedPassDate ?? todayLocalIsoDate();
    const fundedAt = normalizeIsoDate(workingAccount.fundedAt) ?? nextIsoDate(passedDate);
    passRecord = passMatch?.pass
      ? {
          ...passMatch.pass,
          accountId: passMatch.pass.accountId ?? workingAccount.id,
          firm: workingAccount.firm,
          type: challengeType,
          name: workingAccount.name ?? passMatch.pass.name,
          passedDate,
          finalBalance: toNum(workingAccount.balance),
          initialBalance: toNum(workingAccount.initialBalance ?? workingAccount.balance),
          profitTarget: snapshot.profitTarget ?? passMatch.pass.profitTarget,
        }
      : createPassedChallengeRecord(
          {
            id: workingAccount.id,
            firm: workingAccount.firm,
            type: challengeType,
            name: workingAccount.name,
            balance: workingAccount.balance,
            initialBalance: workingAccount.initialBalance,
          },
          snapshot,
          passedDate
        );
    passRecordIndex = passMatch?.index ?? null;
    const promotedAccount: Account = {
      ...workingAccount,
      status: "funded",
      phaseHint: "funded",
      fundedAt,
      type: promotedType,
      breachedDate: undefined,
    };
    const promotedSnapshot = getPropAccountSnapshot(promotedAccount, context);
    if (!promotedSnapshot) {
      return { account: promotedAccount, passRecord, passRecordIndex };
    }
    workingAccount = resetAccountForPromotedFunding(promotedAccount, promotedSnapshot.program, fundedAt);
    snapshot = getPropAccountSnapshot(workingAccount, context);
    if (!snapshot) {
      return { account: workingAccount, passRecord, passRecordIndex };
    }
  }

  if (shouldResetStaleFundingCarryover(workingAccount, snapshot, context)) {
    const resetPeak = Math.max(snapshot.initialBalance, snapshot.balance);
    const fundedAt = workingAccount.fundedAt && workingAccount.fundedAt <= todayLocalIsoDate()
      ? workingAccount.fundedAt
      : todayLocalIsoDate();
    workingAccount = {
      ...workingAccount,
      status: "funded",
      phaseHint: "funded",
      fundedAt,
      peakBalance: resetPeak,
      sodBalance: workingAccount.sodBalance ?? snapshot.initialBalance,
      payoutCycleStartBalance: snapshot.program.payout ? snapshot.initialBalance : undefined,
      mll: undefined,
    };
    repairedStaleCarryover = true;
    snapshot = getPropAccountSnapshot(workingAccount, context);
    if (!snapshot) {
      return { account: workingAccount, passRecord, passRecordIndex };
    }
  }

  const nextPeak = Math.max(toNum(workingAccount.peakBalance ?? 0), snapshot.peakBalance);
  const nextStatus:
    | "funded"
    | "challenge"
    | "breached" =
    (existingStatus === "breached" && !repairedStaleCarryover) || snapshot.breached
      ? "breached"
      : snapshot.phase === "funded"
        ? "funded"
        : "challenge";

  return {
    account: {
    ...workingAccount,
    status: nextStatus,
    phaseHint: snapshot.phase === "breached" ? undefined : snapshot.phase,
    fundedAt: snapshot.phase === "funded" ? normalizeIsoDate(workingAccount.fundedAt) ?? workingAccount.fundedAt : undefined,
    breachedDate: nextStatus === "breached" ? workingAccount.breachedDate ?? todayLocalIsoDate() : undefined,
    initialBalance: snapshot.initialBalance,
    peakBalance: nextPeak,
    mll: snapshot.mllFloor,
    payoutCycleStartBalance: snapshot.payoutCycleStartBalance ?? workingAccount.payoutCycleStartBalance,
    },
    passRecord,
    passRecordIndex,
  };
}

export function applyPropAccountLifecycle(
  accounts: Account[],
  passedChallenges: PassedChallenge[] = [],
  context?: PropAccountContext
): PropAccountLifecycleResult {
  let changed = false;
  const nextPassedChallenges = [...passedChallenges];

  const nextAccounts = accounts.map((account) => {
    const result = normalizeAccountLifecycle(account, nextPassedChallenges, context);

    if (result.passRecord) {
      if (result.passRecordIndex !== null && result.passRecordIndex >= 0) {
        const current = nextPassedChallenges[result.passRecordIndex];
        const passRecord = result.passRecord;
        const hasChanged = current === passRecord ? false :
          (Object.keys(passRecord) as Array<keyof PassedChallenge>).some(key => current[key] !== passRecord[key]);
        if (hasChanged) {
          nextPassedChallenges[result.passRecordIndex] = result.passRecord;
          changed = true;
        }
      } else {
        nextPassedChallenges.push(result.passRecord);
        changed = true;
      }
    }

    const accountChanged = result.account === account ? false :
      (Object.keys(result.account) as Array<keyof Account>).some(key => result.account[key] !== account[key]);
    if (accountChanged) {
      changed = true;
    }

    return result.account;
  });

  if (nextPassedChallenges.length !== passedChallenges.length) {
    changed = true;
  }

  return {
    accounts: nextAccounts,
    passedChallenges: nextPassedChallenges,
    changed,
  };
}

export function normalizeAccountWithPropRules(account: Account, context?: PropAccountContext): Account {
  return normalizeAccountLifecycle(account, [], context).account;
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
