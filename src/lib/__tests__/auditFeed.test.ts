import { describe, expect, it } from "vitest";
import { buildAuditFeedCsvRows } from "../auditFeed";
import type { AppData } from "@/types";

const base: AppData = {
  expenses: [],
  genExpenses: [],
  withdrawals: [{ id: "w1", date: "2025-03-10", firm: "Firm", gross: 500 }],
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
  tradeJournal: [
    {
      id: "t1",
      date: "2025-03-12",
      time: "09:30",
      instrument: "NQ",
      direction: "short",
      entryPrice: 1,
      exitPrice: 1,
      contracts: 1,
      pnl: 20,
      fees: 0,
    },
  ],
  journalEntries: [{ id: "j1", date: "2025-03-11", notes: "Note", bias: "", mood: "", checklist: [] }],
};

describe("buildAuditFeedCsvRows", () => {
  it("sorts newest activity first and includes kinds", () => {
    const rows = buildAuditFeedCsvRows(base, 50);
    expect(rows.length).toBe(3);
    expect(rows[0].kind).toBe("trade");
    expect(new Set(rows.map((r) => r.kind))).toEqual(new Set(["trade", "payout", "journal_day"]));
  });
});
