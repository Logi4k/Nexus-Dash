import { normalizeAccountWithPropRules, type PropAccountContext } from "@/lib/propRules";
import { toNum } from "@/lib/utils";
import type { Account, Withdrawal } from "@/types";

type LinkedPayout = Pick<Withdrawal, "accountId" | "gross"> | null | undefined;

export function reconcileLinkedPayoutAccounts(
  accounts: Account[],
  previous: LinkedPayout,
  next: LinkedPayout,
  context?: PropAccountContext
): Account[] {
  const balanceDeltas = new Map<string, number>();

  if (previous?.accountId) {
    balanceDeltas.set(
      previous.accountId,
      (balanceDeltas.get(previous.accountId) ?? 0) + toNum(previous.gross)
    );
  }

  if (next?.accountId) {
    balanceDeltas.set(
      next.accountId,
      (balanceDeltas.get(next.accountId) ?? 0) - toNum(next.gross)
    );
  }

  if (balanceDeltas.size === 0) {
    return accounts;
  }

  return accounts.map((account) => {
    const delta = balanceDeltas.get(account.id);
    if (delta == null || delta === 0) {
      return account;
    }

    return normalizeAccountWithPropRules({
      ...account,
      balance: Math.max(0, toNum(account.balance) + delta),
    }, context);
  });
}
