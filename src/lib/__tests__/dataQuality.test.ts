import { describe, expect, it } from "vitest";
import { collectDataQualityIssues, dataQualityRowsForCsv } from "../dataQuality";
import type { AppData } from "@/types";

const emptyBase: AppData = {
  expenses: [],
  genExpenses: [],
  withdrawals: [],
  investments: [],
  wealthTargets: [],
  accounts: [],
  debts: [],
  creditCards: [],
  subscriptions: [],
  t212: { last_sync: 0, free_cash: 0, total_value: 0, invested: 0, ppl: 0, result: 0 },
  t212History: [],
  taxProfile: {
    country: "UK",
    employmentStatus: "",
    annualIncome: 0,
    ukSpecific: { studentLoan: "", pensionPercentage: 0, taxCode: "", isScottish: false },
    otherSpecific: { effectiveTaxRate: 0 },
  },
  marketTickers: [],
  otherDebts: [],
};

describe("collectDataQualityIssues", () => {
  it("flags duplicate payouts with identical fingerprint", () => {
    const data: AppData = {
      ...emptyBase,
      withdrawals: [
        { id: "1", date: "2025-01-01", firm: "Apex", gross: 1000, accountId: "a1" },
        { id: "2", date: "2025-01-01", firm: "Apex", gross: 1000, accountId: "a1" },
      ],
    };
    const issues = collectDataQualityIssues(data);
    expect(issues.some((i) => i.id.startsWith("dup-payout-"))).toBe(true);
  });

  it("flags trades missing account when accounts exist", () => {
    const data: AppData = {
      ...emptyBase,
      accounts: [{ id: "a1", firm: "X", type: "Eval", status: "funded", balance: 0 }],
      tradeJournal: [
        {
          id: "t1",
          date: "2025-02-01",
          time: "10:00",
          instrument: "ES",
          direction: "long",
          entryPrice: 1,
          exitPrice: 2,
          contracts: 1,
          pnl: 10,
          fees: 1,
        },
      ],
    };
    expect(collectDataQualityIssues(data).some((i) => i.id === "trades-missing-account")).toBe(true);
  });

  it("exports rows for CSV helper", () => {
    const rows = dataQualityRowsForCsv([
      { id: "x", severity: "info", title: "T", detail: "D", ref: "/a" },
    ]);
    expect(rows[0]).toMatchObject({ id: "x", title: "T", ref: "/a" });
  });
});
