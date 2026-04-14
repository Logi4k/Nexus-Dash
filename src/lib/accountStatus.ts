import type { Account, AccountStatus } from "@/types";

export type NormalizedAccountStatus = "challenge" | "funded" | "breached" | "unknown";

function toStatusValue(
  accountOrStatus: Pick<Account, "status"> | AccountStatus | string | null | undefined
): string {
  if (!accountOrStatus) return "";
  if (typeof accountOrStatus === "object") {
    return String(accountOrStatus.status ?? "");
  }
  return String(accountOrStatus);
}

export function normalizeAccountStatus(
  accountOrStatus: Pick<Account, "status"> | AccountStatus | string | null | undefined
): NormalizedAccountStatus {
  const status = toStatusValue(accountOrStatus).trim().toLowerCase();

  if (status === "challenge") return "challenge";
  if (status === "funded") return "funded";
  if (status === "breached") return "breached";
  return "unknown";
}

export function getAccountPhaseLabel(
  accountOrStatus: Pick<Account, "status"> | AccountStatus | string | null | undefined
): "Challenge" | "Funded" | "Breached" | "Unknown" {
  const normalized = normalizeAccountStatus(accountOrStatus);

  if (normalized === "challenge") return "Challenge";
  if (normalized === "funded") return "Funded";
  if (normalized === "breached") return "Breached";
  return "Unknown";
}

export function isBreachedAccount(
  accountOrStatus: Pick<Account, "status"> | AccountStatus | string | null | undefined
): boolean {
  return normalizeAccountStatus(accountOrStatus) === "breached";
}

export function isActiveAccount(
  accountOrStatus: Pick<Account, "status"> | AccountStatus | string | null | undefined
): boolean {
  const normalized = normalizeAccountStatus(accountOrStatus);
  return normalized === "challenge" || normalized === "funded";
}

export function formatAccountOptionLabel(
  account: Pick<Account, "firm" | "name" | "status" | "type">,
  options?: {
    includeFirm?: boolean;
  }
): string {
  const phase = getAccountPhaseLabel(account.status);
  const baseName = (account.name?.trim() || account.type || "Unnamed account").trim();
  const withPhase = baseName.toLowerCase().includes(phase.toLowerCase())
    ? baseName
    : `${baseName} · ${phase}`;

  if (options?.includeFirm === false) {
    return withPhase;
  }

  return `${withPhase} (${account.firm})`;
}
