import { describe, expect, it } from "vitest";
import { applyPropAccountLifecycle, getPropAccountSnapshot, inferProgramKey } from "../propRules";
import { getAccountFundingDate } from "../tradePhases";
import { todayLocalIsoDate } from "../utils";
import type { Account, PassedChallenge, TradeEntry } from "@/types";

function nextIsoDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

describe("prop account lifecycle", () => {
  it("promotes a passed challenge into funded and creates a linked pass record", () => {
    const today = todayLocalIsoDate();
    const challengeAccount: Account = {
      id: "acct-pass",
      firm: "Lucid Trading",
      type: "LucidFlex 50K",
      name: "Main Lucid",
      status: "challenge",
      phaseHint: "challenge",
      balance: 53050,
      initialBalance: 50000,
      peakBalance: 53050,
    };

    const result = applyPropAccountLifecycle([challengeAccount], [], {});
    const funded = result.accounts[0];
    const pass = result.passedChallenges[0];

    expect(result.changed).toBe(true);
    expect(funded.status).toBe("funded");
    expect(funded.phaseHint).toBe("funded");
    expect(funded.type).toBe("LucidFlex 50K");
    expect(funded.balance).toBe(50000);
    expect(funded.initialBalance).toBe(50000);
    // Funded account starts a new risk phase, so the funded trailing floor
    // must not inherit the evaluation peak and instantly breach the account.
    expect(funded.peakBalance).toBe(50000);
    expect(funded.fundedAt).toBe(nextIsoDate(today));

    expect(pass.accountId).toBe("acct-pass");
    expect(pass.type).toBe("LucidFlex 50K");
    expect(pass.passedDate).toBe(today);
    expect(pass.finalBalance).toBe(53050);
    expect(pass.initialBalance).toBe(50000);
    expect(pass.profitTarget).toBe(3000);
  });

  it("marks breached accounts with a breached date when the live floor is broken", () => {
    const breachedAccount: Account = {
      id: "acct-breach",
      firm: "Topstep",
      type: "Trading Combine 50K",
      status: "challenge",
      phaseHint: "challenge",
      balance: 47950,
      initialBalance: 50000,
      peakBalance: 50000,
    };

    const result = applyPropAccountLifecycle([breachedAccount], [], {});
    const breached = result.accounts[0];

    expect(breached.status).toBe("breached");
    expect(breached.phaseHint).toBe("challenge");
    expect(breached.breachedDate).toBeTruthy();
  });
});

describe("funding dates and payout cycle rules", () => {
  it("treats the explicit funded date as authoritative over inferred pass history", () => {
    const account: Account = {
      id: "acct-funded",
      firm: "Topstep",
      type: "Express Funded Standard 50K",
      name: "Topstep XFA",
      status: "funded",
      phaseHint: "funded",
      fundedAt: "2026-03-12",
      balance: 1200,
    };

    const passes: PassedChallenge[] = [
      {
        id: "pass-1",
        accountId: "acct-funded",
        firm: "Topstep",
        type: "Trading Combine 50K",
        name: "Topstep XFA",
        passedDate: "2026-03-05",
        finalBalance: 53000,
        initialBalance: 50000,
        profitTarget: 3000,
      },
    ];

    expect(getAccountFundingDate(account, passes)).toBe("2026-03-12");
  });

  it("counts funded winning days from the funded date and ignores challenge-phase trades", () => {
    const account: Account = {
      id: "acct-cycle",
      firm: "Topstep",
      type: "Express Funded Standard 50K",
      status: "funded",
      phaseHint: "funded",
      fundedAt: "2026-03-10",
      balance: 1600,
      peakBalance: 1600,
      initialBalance: 0,
      payoutCycleStartBalance: 0,
    };

    const trades: TradeEntry[] = [
      {
        id: "t-pre",
        date: "2026-03-09",
        time: "09:30",
        instrument: "NQ",
        direction: "long",
        entryPrice: 1,
        exitPrice: 2,
        contracts: 1,
        pnl: 400,
        fees: 0,
        accountId: "acct-cycle",
        accountPhase: "challenge",
      },
      {
        id: "t-1",
        date: "2026-03-10",
        time: "09:30",
        instrument: "NQ",
        direction: "long",
        entryPrice: 1,
        exitPrice: 2,
        contracts: 1,
        pnl: 150,
        fees: 0,
        accountId: "acct-cycle",
        accountPhase: "funded",
      },
      {
        id: "t-2",
        date: "2026-03-11",
        time: "09:30",
        instrument: "NQ",
        direction: "long",
        entryPrice: 1,
        exitPrice: 2,
        contracts: 1,
        pnl: 149,
        fees: 0,
        accountId: "acct-cycle",
        accountPhase: "funded",
      },
      {
        id: "t-3",
        date: "2026-03-12",
        time: "09:30",
        instrument: "NQ",
        direction: "long",
        entryPrice: 1,
        exitPrice: 2,
        contracts: 1,
        pnl: 180,
        fees: 0,
        accountId: "acct-cycle",
        accountPhase: "funded",
      },
    ];

    const snapshot = getPropAccountSnapshot(account, { tradeJournal: trades, withdrawals: [] });

    expect(snapshot?.cycleWinningDays).toBe(2);
    expect(snapshot?.cycleLargestWinningDay).toBe(180);
  });

  it("maps a generic Tradeify challenge type to Select Evaluation", () => {
    expect(
      inferProgramKey({
        firm: "Tradeify",
        type: "100K Challenge",
        status: "challenge",
        phaseHint: "challenge",
      })
    ).toBe("tradeify-select-evaluation");
  });

  it("uses Select Evaluation profit targets for Tradeify 100K and 150K", () => {
    const eval100: Account = {
      id: "t-eval-100",
      firm: "Tradeify",
      type: "Select 100K",
      status: "challenge",
      phaseHint: "challenge",
      balance: 50000,
      initialBalance: 50000,
      peakBalance: 50000,
    };
    const eval150: Account = {
      id: "t-eval-150",
      firm: "Tradeify",
      type: "Select Evaluation 150K",
      status: "challenge",
      phaseHint: "challenge",
      balance: 50000,
      initialBalance: 150000,
      peakBalance: 50000,
    };
    expect(getPropAccountSnapshot(eval100)?.profitTarget).toBe(6000);
    expect(getPropAccountSnapshot(eval150)?.profitTarget).toBe(9000);
  });

  it("caps Tradeify Select Flex payout availability at the per-size plan cap", () => {
    const flex100: Account = {
      id: "t-flex-100",
      firm: "Tradeify",
      type: "Select Flex 100K",
      status: "funded",
      phaseHint: "funded",
      fundedAt: "2026-03-10",
      balance: 110000,
      initialBalance: 100000,
      peakBalance: 110000,
      payoutCycleStartBalance: 100000,
    };
    const snapshot = getPropAccountSnapshot(flex100, { tradeJournal: [], withdrawals: [] });
    expect(snapshot?.payoutMinimumRequest).toBe(250);
    /* 50% of $10k profit = $5k, capped at $4k for 100K Flex */
    expect(snapshot?.payoutAvailableAmount).toBe(4000);
  });

  it("calculates the capped payout availability for Tradeify Select Daily", () => {
    const account: Account = {
      id: "acct-daily",
      firm: "Tradeify",
      type: "Select Daily 50K",
      status: "funded",
      phaseHint: "funded",
      fundedAt: "2026-03-10",
      balance: 53050,
      initialBalance: 50000,
      peakBalance: 53050,
      payoutCycleStartBalance: 52800,
    };

    const snapshot = getPropAccountSnapshot(account, { tradeJournal: [], withdrawals: [] });

    expect(snapshot?.payoutMinimumRequest).toBe(250);
    expect(snapshot?.payoutAvailableAmount).toBe(500);
  });
});
