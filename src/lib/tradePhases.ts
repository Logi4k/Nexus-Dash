import type { Account, PassedChallenge } from "@/types";

export function getAccountFundingDate(
  account: Account,
  _passedChallenges?: PassedChallenge[]
): string | undefined {
  return account.fundedAt;
}
