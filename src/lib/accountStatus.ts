import type { Account, AccountStatus } from "@/types";

export function normalizeAccountStatus(status: string): AccountStatus {
  const s = status.toLowerCase();
  if (s === "funded" || s === "fund") return "funded";
  if (s === "breached") return "breached";
  if (s === "challenge") return "Challenge";
  return "funded";
}

export function formatAccountOptionLabel(
  account: Account,
  options?: { includeFirm?: boolean }
): string {
  const name = account.name ?? account.firm;
  if (options?.includeFirm === false) {
    return `${name} (${account.type})`;
  }
  return `${name} (${account.type})`;
}

export function isActiveAccount(account: Account): boolean {
  return account.status === "funded" || account.status === "Funded" || account.status === "Challenge";
}
