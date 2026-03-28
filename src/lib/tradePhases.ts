import type { Account, AppData, PassedChallenge, TradeEntry } from "@/types";
import { normalizeAccountStatus } from "@/lib/accountStatus";
import { getAccountPhase, parseAccountSize } from "@/lib/propRules";

export type TradeAccountPhase = "challenge" | "funded";

function normalizeIsoDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim().slice(0, 10) ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeName(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed || null;
}

export function normalizeTradeAccountPhase(
  value: string | null | undefined,
): TradeAccountPhase | null {
  if (value === "challenge" || value === "funded") return value;
  return null;
}

export function getCurrentAccountTradePhase(
  account: Pick<Account, "status" | "phaseHint"> | null | undefined,
): TradeAccountPhase | null {
  if (!account) return null;

  const phase = getAccountPhase(account);
  if (phase) return phase;

  const normalizedStatus = normalizeAccountStatus(account.status);
  if (normalizedStatus === "challenge" || normalizedStatus === "funded") {
    return normalizedStatus;
  }

  return null;
}

function scorePassMatch(
  account: Pick<Account, "id" | "firm" | "name" | "type">,
  pass: PassedChallenge,
): number {
  if (pass.accountId && pass.accountId === account.id) return 100;
  if (pass.firm !== account.firm) return -1;

  const accountName = normalizeName(account.name);
  const passName = normalizeName(pass.name);
  if (accountName && passName && accountName !== passName) return -1;

  const accountSize = parseAccountSize(account.type);
  const passSize = parseAccountSize(pass.type);
  if (accountSize && passSize && accountSize !== passSize) return -1;

  let score = 10;
  if (accountName && passName) score += 10;
  if (accountSize && passSize) score += 5;

  const accountType = account.type.toLowerCase();
  const passType = pass.type.toLowerCase();
  if (accountType && passType && accountType.includes("topstep") === passType.includes("topstep")) {
    score += 1;
  }

  return score;
}

function findFundingDateFromPassHistory(
  account: Pick<Account, "id" | "firm" | "name" | "type">,
  passedChallenges: PassedChallenge[],
): string | null {
  const matches = passedChallenges
    .map((pass) => ({
      pass,
      score: scorePassMatch(account, pass),
      date: normalizeIsoDate(pass.passedDate),
    }))
    .filter(
      (candidate): candidate is { pass: PassedChallenge; score: number; date: string } =>
        candidate.score >= 0 && !!candidate.date,
    )
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));

  return matches[0]?.date ?? null;
}

export function getAccountFundingDate(
  account: Pick<Account, "id" | "firm" | "name" | "type" | "status" | "phaseHint" | "fundedAt">,
  passedChallenges: PassedChallenge[] = [],
): string | null {
  const currentPhase = getCurrentAccountTradePhase(account);
  if (currentPhase !== "funded") return null;

  const explicitDate = normalizeIsoDate(account.fundedAt);
  if (explicitDate) return explicitDate;

  return findFundingDateFromPassHistory(account, passedChallenges);
}

export function inferTradeAccountPhase(
  trade: Pick<TradeEntry, "date">,
  account: Pick<Account, "id" | "firm" | "name" | "type" | "status" | "phaseHint" | "fundedAt"> | null | undefined,
  passedChallenges: PassedChallenge[] = [],
): TradeAccountPhase | null {
  if (!account) return null;

  const currentPhase = getCurrentAccountTradePhase(account);
  if (!currentPhase) return null;
  if (currentPhase === "challenge") return "challenge";

  const fundedAt = getAccountFundingDate(account, passedChallenges);
  const tradeDate = normalizeIsoDate(trade.date);

  if (fundedAt && tradeDate && tradeDate < fundedAt) {
    return "challenge";
  }

  return "funded";
}

export function hydrateTradePhases(data: AppData): { data: AppData; changed: boolean } {
  const passedChallenges = data.passedChallenges ?? [];
  let changed = false;

  const accounts = (data.accounts ?? []).map((account) => {
    const fundedAt = getAccountFundingDate(account, passedChallenges);
    if (!fundedAt || account.fundedAt === fundedAt) return account;
    changed = true;
    return { ...account, fundedAt };
  });

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const tradeJournal = (data.tradeJournal ?? []).map((trade) => {
    const existingPhase = normalizeTradeAccountPhase(trade.accountPhase);
    const account = trade.accountId ? accountsById.get(trade.accountId) : undefined;
    const inferredPhase = inferTradeAccountPhase(trade, account, passedChallenges);

    if (existingPhase === inferredPhase) return trade;

    changed = true;

    if (!inferredPhase) {
      const { accountPhase, ...rest } = trade;
      return rest;
    }

    return {
      ...trade,
      accountPhase: inferredPhase,
    };
  });

  if (!changed) return { data, changed: false };

  return {
    changed: true,
    data: {
      ...data,
      accounts,
      tradeJournal,
    },
  };
}
