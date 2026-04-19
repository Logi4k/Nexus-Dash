import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calculator,
  Calendar,
  CalendarX,
  Edit2,
  Check,
  X,
  Briefcase,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  PiggyBank,
  Info,
  ChevronDown,
  ChevronUp,
  BadgePoundSterling,
  FileText,
  Wallet,
  Building2,
  Plus,
  UserPlus,
  Upload,
} from "lucide-react";
import { useAppData } from "@/lib/store";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import { navigateToQuickAction } from "@/lib/quickActions";
import type { AppData } from "@/types";
import { fmtGBP, toNum, cn, daysUntil } from "@/lib/utils";
import { UK_TAX } from "@/lib/utils";
import { PAGE_THEMES } from "@/lib/theme";
import PageHeader from "@/components/PageHeader";
import { StatCardShell } from "@/components/StatCard";

// ─── UK Tax year helpers ───────────────────────────────────────────────────────

function getCurrentTaxYear(country = "United Kingdom") {
  const now = new Date();
  const y   = now.getFullYear();
  const m   = now.getMonth() + 1;
  const d   = now.getDate();

  // United Kingdom: tax year runs 6 April → 5 April
  const isAfterApril5 = m > 4 || (m === 4 && d >= 6);
  const syUK = isAfterApril5 ? y : y - 1;
  const eyUK = syUK + 1;

  // Default / other countries: calendar year (Jan 1 → Dec 31)
  const syDefault = y;
  const eyDefault = y;

  const sy = country === "United Kingdom" ? syUK : syDefault;
  const ey = country === "United Kingdom" ? eyUK : eyDefault;

  if (country === "United Kingdom") {
    return {
      start:     `${sy}-04-06`,
      end:       `${ey}-04-05`,
      label:     `${sy}/${String(ey).slice(2)}`,
      startYear: sy,
      endYear:   ey,
      filingDeadline:  `${ey + 1}-01-31`,
      balancingDate:   `${ey + 1}-01-31`,
      poaJul:          `${ey + 1}-07-31`,
      regDeadline:     `${ey + 1}-10-31`,
    };
  }

  // Calendar year (US, EU, etc.)
  return {
    start:     `${sy}-01-01`,
    end:       `${ey}-12-31`,
    label:     `${sy}`,
    startYear: sy,
    endYear:   ey,
    filingDeadline:  `${ey + 1}-04-15`,
    balancingDate:    `${ey}-12-31`,
    poaJul:          "",
    regDeadline:     "",
  };
}

// ─── Income tax calculation ────────────────────────────────────────────────────

function calcIncomeTax(totalIncome: number): {
  basic: number; higher: number; additional: number; total: number;
} {
  const taxable = Math.max(0, totalIncome - UK_TAX.PERSONAL_ALLOWANCE);
  const basicBand = Math.min(taxable, UK_TAX.BASIC_RATE_LIMIT - UK_TAX.PERSONAL_ALLOWANCE);
  const higherBand = Math.min(
    Math.max(0, taxable - basicBand),
    UK_TAX.HIGHER_RATE_LIMIT - UK_TAX.BASIC_RATE_LIMIT
  );
  const addBand = Math.max(0, taxable - basicBand - higherBand);
  const basic = basicBand * UK_TAX.BASIC_RATE;
  const higher = higherBand * UK_TAX.HIGHER_RATE;
  const additional = addBand * UK_TAX.ADDITIONAL_RATE;
  return { basic, higher, additional, total: basic + higher + additional };
}

// ─── Tax calendar entries ─────────────────────────────────────────────────────

function buildTaxDates(
  ty: ReturnType<typeof getCurrentTaxYear>,
  saTaxDue: number,
  poaApplies: boolean,
  poaEach: number
) {
  const entries = [
    {
      date:   ty.end,
      label:  "Tax Year End",
      desc:   `${ty.label} tax year closes`,
      amount: null,
      icon:   "end",
    },
    {
      date:   ty.regDeadline,
      label:  "SA Registration Deadline",
      desc:   "Register for Self Assessment if you haven't already",
      amount: null,
      icon:   "reg",
    },
    {
      date:   `${ty.endYear + 1}-01-31`,
      label:  "Online Filing Deadline",
      desc:   `Submit your ${ty.label} Self Assessment return online`,
      amount: null,
      icon:   "file",
    },
    {
      date:   ty.balancingDate,
      label:  "Balancing Payment",
      desc:   `Pay any tax owed for ${ty.label}`,
      amount: saTaxDue > 0 ? saTaxDue : null,
      icon:   "pay",
    },
  ];

  if (poaApplies && poaEach > 0) {
    entries.push({
      date:   `${ty.endYear + 1}-01-31`,
      label:  "1st Payment on Account",
      desc:   `50% advance payment towards ${ty.endYear}/${ty.endYear + 1 - 2000} tax bill`,
      amount: poaEach,
      icon:   "poa",
    });
    entries.push({
      date:   ty.poaJul,
      label:  "2nd Payment on Account",
      desc:   `Second 50% advance payment towards ${ty.endYear}/${ty.endYear + 1 - 2000} tax bill`,
      amount: poaEach,
      icon:   "poa",
    });
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// Converts a color (hex or CSS var) to rgba with the given alpha.
// Avoids the broken `${color}18` pattern where color is a CSS variable like "var(--color-warn)".
function colorWithAlpha(color: string, alpha: number): string {
  // If it's a CSS variable, fall back to a neutral tint
  if (color.startsWith("var(")) return `rgba(128,128,128,${alpha})`;
  // Hex color — parse and convert to rgba
  const hex = color.replace("#", "");
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(128,128,128,${alpha})`;
}

// ─── Band bar ─────────────────────────────────────────────────────────────────

function BandBar({ salary, tradingProfit }: { salary: number; tradingProfit: number }) {
  const bw = useBWMode();
  const totalIncome = salary + tradingProfit;
  const maxBar = Math.max(totalIncome, UK_TAX.BASIC_RATE_LIMIT) * 1.15;

  const p = (v: number) => Math.min((v / maxBar) * 100, 100);
  const paPct      = p(UK_TAX.PERSONAL_ALLOWANCE);
  const basicTopPct = p(UK_TAX.BASIC_RATE_LIMIT);
  const salaryPct  = p(salary);
  const tradingPct = Math.min(p(tradingProfit), 100 - salaryPct);

  const zones = [
    { label: "Tax-free", from: 0,           to: paPct,      color: "rgba(var(--color-profit-rgb), 0.12)" },
    { label: "Basic 20%", from: paPct,       to: basicTopPct, color: "rgba(var(--color-warn-rgb), 0.10)" },
    { label: "Higher 40%", from: basicTopPct, to: 100,        color: "rgba(var(--color-loss-rgb), 0.08)" },
  ];

  return (
    <div className="space-y-2.5">
      {/* Zone labels above bar */}
      <div className="relative" style={{ height: "12px" }}>
        {zones.filter(z => z.to > z.from + 1).map((z) => (
          <span key={z.label}
            className="absolute text-[10px] font-semibold uppercase tracking-wider text-tx-3"
            style={{ left: `${z.from + (z.to - z.from) / 2}%`, transform: "translateX(-50%)" }}
          >
            {z.label}
          </span>
        ))}
      </div>

      {/* Main bar */}
      <div className="relative h-9 rounded-xl overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.1)" }}>
        {/* Tax zone backgrounds */}
        {zones.map((z) => z.to > z.from && (
          <div key={z.label} className="absolute top-0 h-full"
            style={{ left: `${z.from}%`, width: `${z.to - z.from}%`, background: z.color }} />
        ))}

        {/* Salary fill */}
        <div className="absolute top-1.5 bottom-1.5 left-1.5 rounded-lg transition-[width,background-color] duration-700"
          style={{ width: `calc(${salaryPct}% - 6px)`, background: bwColor("rgba(var(--color-blue-rgb), 0.7)", bw) }} />
        {/* Trading fill */}
        {tradingPct > 0 && (
          <div className="absolute top-1.5 bottom-1.5 rounded-lg transition-[left,width,background-color] duration-700"
            style={{ left: `${salaryPct}%`, width: `${tradingPct}%`, background: "rgba(var(--color-profit-rgb), 0.7)" }} />
        )}

        {/* PA threshold line */}
        {paPct > 2 && paPct < 97 && (
          <div className="absolute top-0 h-full w-px" style={{ left: `${paPct}%`, background: "rgba(var(--color-profit-rgb), 0.6)" }}>
            <span className="absolute bottom-1 left-0.5 text-[7px] font-bold" style={{ color: "rgba(var(--color-profit-rgb), 0.9)" }}>PA</span>
          </div>
        )}
        {/* Basic rate top line */}
        {basicTopPct > 2 && basicTopPct < 98 && (
          <div className="absolute top-0 h-full w-px" style={{ left: `${basicTopPct}%`, background: "rgba(var(--color-warn-rgb), 0.6)" }}>
            <span className="absolute bottom-1 left-0.5 text-[7px] font-bold" style={{ color: "rgba(var(--color-warn-rgb), 0.9)" }}>40%</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-tx-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: bwColor("rgba(var(--color-blue-rgb), 0.7)", bw) }} />
          Employment salary
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "rgba(var(--color-profit-rgb), 0.7)" }} />
          Trading profit
        </span>
      </div>
    </div>
  );
}

// ─── Inline editable value ─────────────────────────────────────────────────────

function EditableAmount({
  label: _label, value, onSave, prefix = "£",
}: { label: string; value: number; onSave: (v: number) => void; prefix?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing || typeof window === "undefined" || window.innerWidth < 768) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  function start() { setDraft(String(value)); setEditing(true); }
  function save() {
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= 0) onSave(n);
    setEditing(false);
  }

  return editing ? (
    <div className="flex items-center gap-1">
      <span className="text-tx-3 text-sm">{prefix}</span>
      <input
        ref={inputRef}
        className="nx-input w-28 text-sm py-0.5"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
      />
      <button onClick={save} className="p-1 rounded hover:bg-profit/10 text-profit" aria-label="Save"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-loss/10 text-loss" aria-label="Cancel"><X size={12} /></button>
    </div>
  ) : (
    <button
      type="button"
      className="flex items-center gap-1 group cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      onClick={start}
      aria-label={`Edit ${fmtGBP(value, 0)} amount`}
    >
      <span className="text-xl font-bold text-tx-1 tabular-nums">{fmtGBP(value, 0)}</span>
      <Edit2 size={11} className="text-tx-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── Breakdown Row ────────────────────────────────────────────────────────────

function BRow({
  label, sub, value, valueClass = "text-tx-1", bold = false, indent = false, divider = false
}: {
  label: string; sub?: string; value: string; valueClass?: string; bold?: boolean; indent?: boolean; divider?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-start justify-between py-2.5",
      divider && "border-t border-[rgba(var(--border-rgb),0.06)] mt-1 pt-3",
      indent && "pl-4"
    )}>
      <div className="flex flex-col gap-0.5">
        <span className={cn("text-sm", bold ? "text-tx-1 font-semibold" : "text-tx-2")}>{label}</span>
        {sub && <span className="text-[11px] text-tx-4">{sub}</span>}
      </div>
      <span className={cn("text-sm tabular-nums font-mono shrink-0 ml-4", bold && "font-bold text-base", valueClass)}>
        {value}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TaxPage() {
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.tax, isBW);
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const navigate = useNavigate();
  const taxYear = useMemo(
    () => getCurrentTaxYear(data.taxProfile?.country),
    [data.taxProfile?.country]
  );

  // ── Income sources ──
  const [tradingManual, setTradingManual] = useState<number | null>(null);
  const [expenseManual, setExpenseManual] = useState<number | null>(null);
  const [incomeMode, setIncomeMode] = useState<"auto" | "manual">("auto");
  const [expenseMode, setExpenseMode] = useState<"auto" | "manual">("auto");
  const [showPoaInfo, setShowPoaInfo] = useState(false);
  // Persisted tax settings — synced via AppData
  const salary = data.taxSettings?.salary ?? 30000;
  const savedSoFar = data.taxSettings?.savedSoFar ?? 0;
  const savingsGoalOverride = data.taxSettings?.savingsGoalOverride ?? null;

  const setSalary = (v: number) => {
    update((prev) => ({
      ...prev,
      taxSettings: { ...prev.taxSettings, salary: v, savedSoFar: prev.taxSettings?.savedSoFar ?? 0, savingsGoalOverride: prev.taxSettings?.savingsGoalOverride ?? null },
    }));
  };
  const setSavedSoFar = (v: number) => {
    update((prev) => ({
      ...prev,
      taxSettings: { ...prev.taxSettings, salary: prev.taxSettings?.salary ?? 30000, savedSoFar: v, savingsGoalOverride: prev.taxSettings?.savingsGoalOverride ?? null },
    }));
  };
  const setSavingsGoalOverride = (v: number | null) => {
    update((prev) => ({
      ...prev,
      taxSettings: { ...prev.taxSettings, salary: prev.taxSettings?.salary ?? 30000, savedSoFar: prev.taxSettings?.savedSoFar ?? 0, savingsGoalOverride: v },
    }));
  };

  // One-time migration from localStorage to AppData
  useEffect(() => {
    if (!data.taxSettings) {
      const lsSalary = localStorage.getItem("nexus_tax_salary");
      const lsSaved = localStorage.getItem("nexus_tax_saved");
      const lsGoal = localStorage.getItem("nexus_tax_goal_override");
      if (lsSalary || lsSaved || lsGoal) {
        update((prev) => ({
          ...prev,
          taxSettings: {
            salary: lsSalary ? parseFloat(lsSalary) : 30000,
            savedSoFar: lsSaved ? parseFloat(lsSaved) : 0,
            savingsGoalOverride: lsGoal ? parseFloat(lsGoal) : null,
          },
        }));
        localStorage.removeItem("nexus_tax_salary");
        localStorage.removeItem("nexus_tax_saved");
        localStorage.removeItem("nexus_tax_goal_override");
      }
    }
  }, []);

  // ── Auto-derive from data ──
  const withdrawalsThisYear = useMemo(() =>
    data.withdrawals.filter((w) => w.date >= taxYear.start && w.date <= taxYear.end),
    [data.withdrawals, taxYear]
  );
  const autoTradingIncome = useMemo(() =>
    withdrawalsThisYear.reduce((s, w) => s + toNum(w.gross), 0), [withdrawalsThisYear]
  );
  const propExpenses = useMemo(() =>
    data.expenses.filter((e) => {
      const d = e.date;
      return d >= taxYear.start && d <= taxYear.end;
    }),
    [data.expenses, taxYear]
  );
  const autoExpenses = useMemo(() =>
    propExpenses.reduce((s, e) => s + toNum(e.amount), 0), [propExpenses]
  );

  const tradingIncome = incomeMode === "auto" ? autoTradingIncome : (tradingManual ?? autoTradingIncome);
  const expenseDeduction = expenseMode === "auto" ? autoExpenses : (expenseManual ?? autoExpenses);

  // ── Tax maths ──
  const tradingProfit = Math.max(0, tradingIncome - expenseDeduction);
  const totalIncome   = salary + tradingProfit;

  // Income tax on COMBINED income
  const taxOnTotal  = calcIncomeTax(totalIncome);
  // Income tax on salary alone (what PAYE should cover)
  const taxOnSalary = calcIncomeTax(salary);
  // Additional tax via Self Assessment
  const additionalIncomeTax = Math.max(0, taxOnTotal.total - taxOnSalary.total);

  // Payment on Account (applies when SA tax bill > £1,000)
  const poaApplies = additionalIncomeTax > 1000;
  const poaEach    = poaApplies ? additionalIncomeTax / 2 : 0;

  // Months until Jan 31
  const jan31 = `${taxYear.endYear + 1}-01-31`;
  const daysToJan31 = daysUntil(jan31);
  const monthsToJan31 = Math.max(1, Math.ceil(daysToJan31 / 30));
  const totalDueJan31 = additionalIncomeTax + poaEach;
  const monthlySavingsTarget = totalDueJan31 > 0 ? totalDueJan31 / monthsToJan31 : 0;
  const effectiveMonthlyGoal = savingsGoalOverride ?? monthlySavingsTarget;
  const savingsProgress = totalDueJan31 > 0 ? Math.min(100, (savedSoFar / totalDueJan31) * 100) : 0;
  const remaining = Math.max(0, totalDueJan31 - savedSoFar);

  // Marginal rate on trading income
  const marginalRate = salary >= UK_TAX.BASIC_RATE_LIMIT
    ? 40
    : salary >= UK_TAX.PERSONAL_ALLOWANCE
    ? 20
    : tradingProfit > 0
    ? (additionalIncomeTax / tradingProfit) * 100
    : 0;

  // Calendar
  const calendarDates = useMemo(
    () => buildTaxDates(taxYear, additionalIncomeTax, poaApplies, poaEach),
    [taxYear, additionalIncomeTax, poaApplies, poaEach]
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <PageHeader eyebrow="Tax" title="Tax Profile" className="mb-3" />

      {/* ── Info Banner ── */}
      <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: theme.accent }} />
        <p className="text-xs leading-relaxed text-tx-2">
          As an employee, your salary is taxed through PAYE. You need to file Self Assessment to declare your additional prop trading income.
          Only the <strong style={{ color: theme.accent }}>extra tax</strong> on your trading profit (above what PAYE covers) is due via Self Assessment.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">

        {/* ── LEFT COLUMN ── */}
        <div className="flex flex-col gap-5">

          {/* ── Income inputs row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Salary */}
            <StatCardShell
              label="Employment Salary"
              icon={<Building2 size={14} />}
              accentColor={bwColor("#86939f", isBW)}
              trailing={(
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: theme.dim, color: theme.accent, border: `1px solid ${theme.border}` }}>PAYE</span>
              )}
            >
              <EditableAmount label="Annual Salary" value={salary} onSave={setSalary} />
              <p className="text-[11px] text-tx-4">Click to edit your gross annual salary</p>
            </StatCardShell>

            {/* Trading Income */}
            <StatCardShell
              label="Trading Income"
              icon={<TrendingUp size={14} />}
              accentColor={bwColor("#22c55e", isBW)}
              trailing={(
                <div className="flex items-center gap-1 bg-[rgba(var(--border-rgb),0.05)] rounded-md p-0.5">
                  {(["auto", "manual"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setIncomeMode(m)}
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] capitalize transition-colors",
                        incomeMode === m ? "font-bold" : "text-tx-3"
                      )}
                      style={incomeMode === m ? { background: theme.accent, color: "var(--bg-base)" } : undefined}
                    >{m}</button>
                  ))}
                </div>
              )}
            >
              {incomeMode === "auto" ? (
                <>
                  <div className="text-xl font-bold text-profit tabular-nums">{fmtGBP(autoTradingIncome, 0)}</div>
                  <p className="text-[11px] text-tx-4">
                    {withdrawalsThisYear.length} payout{withdrawalsThisYear.length !== 1 ? "s" : ""} · {taxYear.start} → {taxYear.end}
                  </p>
                  {withdrawalsThisYear.length === 0 && (
                    <div className="mt-1 flex flex-col gap-2">
                      <p className="text-xs text-tx-4">No payouts recorded this tax year.</p>
                      <button
                        className="btn-primary btn-sm self-start"
                        onClick={() => navigateToQuickAction(navigate, "/prop", "logPayout")}
                      >
                        <Plus size={14} /> Record Payout
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <input
                  type="number"
                  className="nx-input text-sm"
                  placeholder="0.00"
                  value={tradingManual ?? ""}
                  onChange={(e) => setTradingManual(parseFloat(e.target.value) || 0)}
                  min="0"
                />
              )}
            </StatCardShell>

            {/* Expenses */}
            <StatCardShell
              label="Trading Expenses"
              icon={<Wallet size={14} />}
              accentColor={bwColor("#ef4444", isBW)}
              trailing={(
                <div className="flex items-center gap-1 bg-[rgba(var(--border-rgb),0.05)] rounded-md p-0.5">
                  {(["auto", "manual"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setExpenseMode(m)}
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] capitalize transition-colors",
                        expenseMode === m ? "font-bold" : "text-tx-3"
                      )}
                      style={expenseMode === m ? { background: theme.accent, color: "var(--bg-base)" } : undefined}
                    >{m}</button>
                  ))}
                </div>
              )}
            >
              {expenseMode === "auto" ? (
                <>
                  <div className="text-xl font-bold text-loss tabular-nums">-{fmtGBP(autoExpenses, 0)}</div>
                  <p className="text-[11px] text-tx-4">{propExpenses.length} expense records this tax year</p>
                </>
              ) : (
                <input
                  type="number"
                  className="nx-input text-sm"
                  placeholder="0.00"
                  value={expenseManual ?? ""}
                  onChange={(e) => setExpenseManual(parseFloat(e.target.value) || 0)}
                  min="0"
                />
              )}
            </StatCardShell>
          </div>

          {/* ── Income band bar ── */}
          <div className={cn("card p-4 flex flex-col gap-3", isBW && "card--parchment-panel")} style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tx-2">Income Band Allocation</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-tx-3">Total: <span className="text-tx-1 font-semibold">{fmtGBP(totalIncome, 0)}</span></span>
                <span className={cn(
                  "font-semibold",
                  totalIncome > UK_TAX.HIGHER_RATE_LIMIT ? "text-loss" :
                  totalIncome > UK_TAX.BASIC_RATE_LIMIT ? "text-warn" : "text-profit"
                )}>
                  {totalIncome <= UK_TAX.PERSONAL_ALLOWANCE ? "Tax-free" :
                   totalIncome <= UK_TAX.BASIC_RATE_LIMIT ? "Basic Rate (20%)" :
                   totalIncome <= UK_TAX.HIGHER_RATE_LIMIT ? "Higher Rate (40%)" : "Additional Rate (45%)"}
                </span>
              </div>
            </div>
            <BandBar salary={salary} tradingProfit={tradingProfit} />
          </div>

          {/* ── Tax Breakdown ── */}
          <div className={cn("card p-5", isBW && "card--parchment-panel")} style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
            <div className="flex items-center gap-2 mb-4">
              <FileText size={15} className="text-accent" />
              <h2 className="font-semibold text-tx-1">{taxYear.label} Self-Assessment Breakdown</h2>
            </div>

            <div className="divide-y divide-[rgba(var(--border-rgb),0.04)]">
              {/* Employment income */}
              <BRow label="Employment (Salary)" sub="Gross annual salary — taxed via PAYE" value={fmtGBP(salary)} />
              <BRow label="Gross Trading Income" sub={`${withdrawalsThisYear.length} payouts this tax year`} value={fmtGBP(tradingIncome)} />
              <BRow label="Less Trading Expenses" sub="Allowable deductions (platform fees, etc.)" value={`-${fmtGBP(expenseDeduction)}`} valueClass="text-loss" indent />
              <BRow label="Trading Profit" sub="Taxable trading income" value={fmtGBP(tradingProfit)} bold divider />

              {/* Combined totals */}
              <BRow label="Total Combined Income" sub="Salary + Trading Profit" value={fmtGBP(totalIncome)} bold divider />
              <BRow label="Personal Allowance" sub="Tax-free threshold 2025/26" value={`-${fmtGBP(Math.min(UK_TAX.PERSONAL_ALLOWANCE, totalIncome))}`} valueClass="text-profit" indent />
              <BRow label="Total Taxable Income" value={fmtGBP(Math.max(0, totalIncome - UK_TAX.PERSONAL_ALLOWANCE))} bold />

              {/* Income tax bands */}
              <div className="py-2">
                <p className="text-[11px] text-tx-4 uppercase tracking-wider font-medium mb-2">Income Tax on Total Income</p>
              </div>
              {taxOnTotal.basic > 0 && (
                <BRow
                  label="Basic Rate (20%)"
                  sub={`Up to ${fmtGBP(UK_TAX.BASIC_RATE_LIMIT)} band`}
                  value={fmtGBP(taxOnTotal.basic)}
                  indent
                />
              )}
              {taxOnTotal.higher > 0 && (
                <BRow
                  label="Higher Rate (40%)"
                  sub={`${fmtGBP(UK_TAX.BASIC_RATE_LIMIT)} – ${fmtGBP(UK_TAX.HIGHER_RATE_LIMIT)} band`}
                  value={fmtGBP(taxOnTotal.higher)}
                  valueClass="text-warn"
                  indent
                />
              )}
              {taxOnTotal.additional > 0 && (
                <BRow
                  label="Additional Rate (45%)"
                  sub={`Above ${fmtGBP(UK_TAX.HIGHER_RATE_LIMIT)}`}
                  value={fmtGBP(taxOnTotal.additional)}
                  valueClass="text-loss"
                  indent
                />
              )}
              <BRow
                label="Total Income Tax (Combined)"
                value={fmtGBP(taxOnTotal.total)}
                bold
                divider
              />

              {/* PAYE credit */}
              <BRow
                label="Less: PAYE Tax Paid (est.)"
                sub="Tax deducted from salary at source by employer"
                value={`-${fmtGBP(taxOnSalary.total)}`}
                valueClass="text-profit"
                divider
              />

              {/* Final SA bill */}
              <div className={cn(
                "flex items-center justify-between py-3 mt-1 rounded-xl px-4",
                additionalIncomeTax > 0 ? "bg-warn/[0.07] border border-warn/15" : "bg-profit/[0.07] border border-profit/15"
              )}>
                <div>
                  <p className={cn("font-bold text-sm", additionalIncomeTax > 0 ? "text-warn" : "text-profit")}>
                    Additional Tax Due via Self Assessment
                  </p>
                  <p className="text-[11px] text-tx-4 mt-0.5">
                    {additionalIncomeTax <= 0
                      ? "No additional tax owed — PAYE covers it all"
                      : `Effective rate on trading profit: ~${marginalRate.toFixed(0)}%`}
                  </p>
                </div>
                <span className={cn(
                  "text-2xl font-bold tabular-nums",
                  additionalIncomeTax > 0 ? "text-warn" : "text-profit"
                )}>
                  {fmtGBP(additionalIncomeTax)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Payment on Account ── */}
          <div className={cn("card p-5", isBW && "card--parchment-panel")} style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setShowPoaInfo(!showPoaInfo)}
            >
              <div className="flex items-center gap-2">
                <BadgePoundSterling size={15} className={poaApplies ? "text-warn" : "text-tx-4"} />
                <span className={cn("font-semibold", poaApplies ? "text-tx-1" : "text-tx-3")}>
                  Payment on Account
                </span>
                {poaApplies ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-warn/10 text-warn border border-warn/20">Required</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(var(--border-rgb),0.05)] text-tx-4 border border-white/10">Not required (bill &lt; £1,000)</span>
                )}
              </div>
              {showPoaInfo ? <ChevronUp size={14} className="text-tx-4" /> : <ChevronDown size={14} className="text-tx-4" />}
            </button>

            {poaApplies && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg p-3 bg-[rgba(var(--border-rgb),0.04)] border border-[rgba(var(--border-rgb),0.08)] text-center">
                  <p className="text-[10px] text-tx-4 uppercase tracking-wide mb-1">1st POA (Jan 31)</p>
                  <p className="text-lg font-bold text-warn tabular-nums">{fmtGBP(poaEach)}</p>
                </div>
                <div className="rounded-lg p-3 bg-[rgba(var(--border-rgb),0.04)] border border-[rgba(var(--border-rgb),0.08)] text-center">
                  <p className="text-[10px] text-tx-4 uppercase tracking-wide mb-1">2nd POA (Jul 31)</p>
                  <p className="text-lg font-bold text-warn tabular-nums">{fmtGBP(poaEach)}</p>
                </div>
                <div className="rounded-lg p-3 bg-[rgba(var(--border-rgb),0.04)] border border-[rgba(var(--border-rgb),0.08)] text-center">
                  <p className="text-[10px] text-tx-4 uppercase tracking-wide mb-1">POA Total</p>
                  <p className="text-lg font-bold text-tx-1 tabular-nums">{fmtGBP(poaEach * 2)}</p>
                </div>
              </div>
            )}

            {showPoaInfo && (
              <div className="mt-4 p-3 rounded-lg bg-[rgba(var(--border-rgb),0.03)] border border-[rgba(var(--border-rgb),0.07)] text-xs text-tx-3 space-y-1.5 leading-relaxed">
                <p><strong className="text-tx-2">What is Payment on Account?</strong> If your Self Assessment tax bill exceeds £1,000, HMRC requires advance payments towards your <em>next</em> year's bill.</p>
                <p>Two equal instalments of 50% each — due <strong className="text-tx-2">31 January</strong> (alongside your balancing payment) and <strong className="text-tx-2">31 July</strong>.</p>
                <p>These are advance payments, not extra tax. They count as credit against your next year's bill.</p>
              </div>
            )}
          </div>

        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="flex flex-col gap-5">

          {/* ── Tax Rate Double-Ring + key numbers ── */}
          {(() => {
            const SIZE = 88, CX = 44, CY = 44;
            const R_OUTER = 36, R_INNER = 26;
            const circO = 2 * Math.PI * R_OUTER;
            const circI = 2 * Math.PI * R_INNER;
            const rateColor = marginalRate >= 40 ? "var(--color-loss)" : marginalRate >= 20 ? "var(--color-warn)" : "var(--color-profit)";
            const dashO = (Math.min(marginalRate, 100) / 100) * circO;
            const innerColor = savingsProgress >= 100 ? "var(--color-teal)" : savingsProgress >= 50 ? "var(--color-profit)" : "var(--color-warn)";
            const dashI = (Math.min(savingsProgress, 100) / 100) * circI;
            return (
              <div className={cn("card p-4", isBW && "card--parchment-panel")} style={{ background: "linear-gradient(135deg, rgba(var(--color-warn-rgb),0.06) 0%, rgba(var(--color-loss-rgb),0.03) 50%, rgba(var(--color-purple-rgb),0.02) 100%)" }}>
                <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                  <Calculator size={10} />Tax Summary · {taxYear.label}
                </p>
                <div className="flex items-center gap-4">
                  {/* Double ring */}
                  <div className="relative shrink-0">
                    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: "rotate(-90deg)" }}>
                      <defs>
                        <linearGradient id="taxRateGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={rateColor} stopOpacity="0.6" />
                          <stop offset="100%" stopColor={rateColor} />
                        </linearGradient>
                      </defs>
                      {/* Outer track */}
                      <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="rgba(var(--surface-rgb),0.08)" strokeWidth="6" />
                      {/* Outer ring = effective rate */}
                      <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="url(#taxRateGrad)" strokeWidth="6"
                        strokeDasharray={`${dashO} ${circO}`} strokeLinecap="round" />
                      {/* Inner track */}
                      <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="rgba(var(--surface-rgb),0.07)" strokeWidth="4" />
                      {/* Inner ring = savings progress */}
                      {totalDueJan31 > 0 && (
                        <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke={innerColor} strokeWidth="4"
                          strokeDasharray={`${dashI} ${circI}`} strokeLinecap="round" />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[15px] font-black tabular-nums leading-none" style={{ color: rateColor }}>
                        {marginalRate.toFixed(0)}%
                      </span>
                      <span className="text-[7px] text-tx-4 uppercase tracking-wider mt-0.5">rate</span>
                    </div>
                  </div>
                  {/* Key values */}
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-tx-3">Trading Profit</span>
                      <span className="text-[12px] font-bold text-profit tabular-nums font-mono">{fmtGBP(tradingProfit)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-tx-3">SA Tax Due</span>
                      <span className="text-[12px] font-bold tabular-nums font-mono" style={{ color: rateColor }}>{fmtGBP(additionalIncomeTax)}</span>
                    </div>
                    <div className="h-px bg-[rgba(var(--border-rgb),0.06)]" />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-tx-2 font-semibold">Total Due Jan 31</span>
                      <span className="text-sm font-black tabular-nums font-mono" style={{ color: totalDueJan31 > 0 ? "var(--color-warn)" : "var(--color-profit)" }}>
                        {fmtGBP(totalDueJan31)}
                      </span>
                    </div>
                    {totalDueJan31 > 0 && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <div className="flex-1 h-1 overflow-hidden rounded-full" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                          <div
                            className="h-full rounded-full transition-[width,background] duration-700"
                            style={{ width: `${Math.min(100, savingsProgress)}%`, background: `linear-gradient(90deg, ${innerColor}99, ${innerColor})` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono tabular-nums shrink-0" style={{ color: innerColor }}>
                          {savingsProgress.toFixed(0)}% saved
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Summary stat cards ── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              {
                label: "SA Tax Due",
                value: fmtGBP(additionalIncomeTax),
                sub: "Extra tax on trading income",
                color: additionalIncomeTax > 0 ? "var(--color-warn)" : "var(--color-profit)",
                icon: <Calculator size={13} />,
              },
              {
                label: "Trading Profit",
                value: fmtGBP(tradingProfit),
                sub: tradingProfit <= 0 ? "Expenses cover income" : `After ${fmtGBP(expenseDeduction, 0)} deductions`,
                color: tradingProfit > 0 ? "var(--color-profit)" : "var(--tx-3)",
                icon: <TrendingUp size={13} />,
              },
              {
                label: "Effective Rate",
                value: `${marginalRate.toFixed(0)}%`,
                sub: "On trading profit",
                color: marginalRate >= 40 ? "var(--color-loss)" : marginalRate >= 20 ? "var(--color-warn)" : "var(--color-profit)",
                icon: <Briefcase size={13} />,
              },
              {
                label: "Total Due Jan 31",
                value: fmtGBP(totalDueJan31),
                sub: poaApplies ? "Tax + 1st POA" : "Balancing payment only",
                color: totalDueJan31 > 0 ? "var(--color-warn)" : "var(--color-profit)",
                icon: <Calendar size={13} />,
              },
            ].map((s) => (
              <div key={s.label}
                className={cn("card p-3.5 flex flex-col gap-1.5 relative overflow-hidden", isBW && "card--parchment-panel")}
                style={{ borderLeft: `2px solid ${s.color}55` }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded-md" style={{ background: `${s.color}18`, color: s.color }}>
                    {s.icon}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-tx-3">{s.label}</span>
                </div>
                <span className="text-lg font-black tabular-nums" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[11px] text-tx-4 leading-tight">{s.sub}</span>
              </div>
            ))}
          </div>

          {/* ── Savings Tracker ── */}
          {totalDueJan31 > 0 && (
            <div className={cn("card p-4 flex flex-col gap-4", isBW && "card--parchment-panel")} style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-profit/10 shrink-0">
                  <PiggyBank size={18} className="text-profit" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-tx-1">Tax Savings Tracker</p>
                  <p className="text-[11px] text-tx-4 mt-0.5">
                    {fmtGBP(totalDueJan31)} due 31 Jan {taxYear.endYear + 1} · {monthsToJan31} month{monthsToJan31 !== 1 ? "s" : ""} away
                  </p>
                </div>
                {savedSoFar >= totalDueJan31 && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: bwColor("rgba(var(--color-teal-rgb), 0.1)", isBW),
                      color: bwColor("#5aadaa", isBW),
                      border: `1px solid ${bwColor("rgba(var(--color-teal-rgb), 0.2)", isBW)}`,
                    }}
                  >
                    Fully saved ✓
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-tx-3">Saved so far</span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      savingsProgress >= 100 ? "text-profit" : savingsProgress >= 50 ? "text-warn" : "text-tx-3",
                    )}
                  >
                    {savingsProgress.toFixed(0)}%
                  </span>
                </div>
                <div className="progress-track h-2.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width,background] duration-700"
                    style={{
                      width: `${savingsProgress}%`,
                      background:
                        savingsProgress >= 100
                          ? bwColor("linear-gradient(90deg,#5aadaa,#5aadaa)", isBW)
                          : savingsProgress >= 50
                          ? "linear-gradient(90deg,#d4a84a,#d4a84a)"
                          : "linear-gradient(90deg,#ff3d5a99,#ff3d5a)",
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-tx-4 font-mono">
                  <span>{fmtGBP(savedSoFar, 0)} saved</span>
                  <span>{fmtGBP(remaining, 0)} remaining</span>
                </div>
              </div>

              {/* Input row */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Saved so far */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-tx-4 uppercase tracking-wider">Saved So Far</label>
                  <div className="flex items-center gap-1.5 bg-[rgba(var(--border-rgb),0.04)] border border-[rgba(var(--border-rgb),0.1)] rounded-lg px-2.5 py-2 focus-within:border-profit/40 transition-colors">
                    <span className="text-tx-4 text-xs">£</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="flex-1 bg-transparent text-sm text-tx-1 font-mono tabular-nums focus:outline-none placeholder:text-tx-4 w-full"
                      placeholder="0"
                      value={savedSoFar || ""}
                      onChange={(e) => setSavedSoFar(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                </div>

                {/* Monthly goal override */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-tx-4 uppercase tracking-wider">Monthly Goal</label>
                    {savingsGoalOverride !== null && (
                      <button
                        onClick={() => setSavingsGoalOverride(null)}
                        className="text-[10px] text-tx-3 hover:text-accent transition-colors"
                      >
                        reset to auto
                      </button>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1.5 bg-[rgba(var(--border-rgb),0.04)] border rounded-lg px-2.5 py-2 transition-colors",
                      savingsGoalOverride !== null
                        ? "border-accent/30 focus-within:border-accent/50"
                        : "border-[rgba(var(--border-rgb),0.1)] focus-within:border-accent/40",
                    )}
                  >
                    <span className="text-tx-4 text-xs">£</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="flex-1 bg-transparent text-sm text-tx-1 font-mono tabular-nums focus:outline-none placeholder:text-tx-4 w-full"
                      placeholder={monthlySavingsTarget > 0 ? monthlySavingsTarget.toFixed(0) : "0"}
                      value={savingsGoalOverride ?? ""}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        setSavingsGoalOverride(isNaN(v) || v <= 0 ? null : v);
                      }}
                    />
                    {savingsGoalOverride !== null && (
                      <span
                        className="text-[10px] px-1 rounded font-medium shrink-0"
                        style={{ background: bwColor("rgba(var(--color-teal-rgb), 0.1)", isBW),                color: bwColor("#5aadaa", isBW) }}
                      >
                        custom
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Monthly target callout */}
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: "rgba(var(--color-teal-rgb), 0.05)",
                  border: "1px solid rgba(var(--color-teal-rgb), 0.1)",
                }}
              >
                <div>
                  <p className="text-xs text-tx-3">
                    {savingsGoalOverride !== null ? "Custom monthly goal" : "Recommended monthly"}
                  </p>
                  <p className="text-[11px] text-tx-4 mt-0.5">
                    {monthsToJan31} months to Jan 31 deadline
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-profit tabular-nums">
                    {fmtGBP(effectiveMonthlyGoal, 0)}
                  </span>
                  <span className="text-xs text-tx-3 font-normal ml-0.5">/mo</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Self-Assessment Calendar ── */}
          <div className={cn("card p-4 flex flex-col gap-1", isBW && "card--parchment-panel")} style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} className="text-accent" />
              <h3 className="font-semibold text-tx-1 text-sm">Self-Assessment Calendar</h3>
            </div>
            <div className="flex flex-col gap-2">
              {calendarDates.map((entry, i) => {
                const days = daysUntil(entry.date);
                const isPast = days < 0;
                const isSoon = days >= 0 && days <= 30;
                const accentColor = isPast ? "#4b5563" : isSoon ? "var(--color-warn)" : bwColor("#5b8bbf", isBW);
                const accentBg = colorWithAlpha(accentColor, 0.09);
                const accentBorder = colorWithAlpha(accentColor, 0.19);
                const dateParts = entry.date ? entry.date.split("-") : [];
                const mm = dateParts[1] ?? "";
                const dd = dateParts[2] ?? "";
                const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                const monthLabel = mm ? monthNames[parseInt(mm) - 1] ?? "" : "";
                const daysLabel = days === Infinity ? "No date" : days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "Today" : `${days}d`;

                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-2.5 transition-colors",
                      isPast ? "opacity-45 border-[rgba(var(--border-rgb),0.05)]" :
                      isSoon ? "bg-warn/[0.05] border-warn/15" :
                      "bg-[rgba(var(--border-rgb),0.02)] border-[rgba(var(--border-rgb),0.06)]"
                    )}
                  >
                    {/* Date chip */}
                    <div
                      className="shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center"
                      style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
                    >
                      <span className="text-[10px] font-bold uppercase" style={{ color: accentColor }}>{monthLabel}</span>
                      <span className="text-sm font-black leading-none" style={{ color: accentColor }}>{dd}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {entry.icon === "end" && <CalendarX size={11} style={{ color: accentColor }} />}
                        {entry.icon === "reg" && <UserPlus size={11} style={{ color: accentColor }} />}
                        {entry.icon === "file" && <Upload size={11} style={{ color: accentColor }} />}
                        {entry.icon === "pay" && <BadgePoundSterling size={11} style={{ color: accentColor }} />}
                        {entry.icon === "poa" && <PiggyBank size={11} style={{ color: accentColor }} />}
                        <p className={cn("text-xs font-semibold", isPast ? "text-tx-3" : isSoon ? "text-warn" : "text-tx-1")}>
                          {entry.label}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[10px] leading-snug text-tx-4 break-words">{entry.desc}</p>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {entry.amount != null && entry.amount > 0 && (
                        <span className="text-[11px] font-bold tabular-nums font-mono" style={{ color: accentColor }}>
                          {fmtGBP(entry.amount)}
                        </span>
                      )}
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: accentBg,
                          color: accentColor,
                        }}
                      >
                        {days === Infinity ? "—" : isPast ? "done" : days === 0 ? "today" : `${days}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Quick tips ── */}
          <div className={cn("card p-4", isBW && "card--parchment-panel")} style={{ background: theme.dim, border: `1px solid ${theme.border}` }}>
            <h3 className="text-[10px] font-bold text-tx-3 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Info size={11} />SA Tips
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { tip: "Trading income must be declared even if under your personal allowance — HMRC requires disclosure.", icon: <FileText size={11} />, color: bwColor("#5b8bbf", isBW) },
                { tip: "Platform fees, subscriptions, and challenge costs are allowable trading expenses.", icon: <CheckCircle size={11} />, color: bwColor("var(--color-profit)", isBW) },
                { tip: "Keep records of all payouts and expenses for at least 5 years after the SA deadline.", icon: <Clock size={11} />, color: bwColor("#9b8ec2", isBW) },
                { tip: "If your SA tax exceeds £1,000, you'll need Payments on Account for the following year.", icon: <AlertCircle size={11} />, color: bwColor("var(--color-warn)", isBW) },
              ].map((t, i) => (
                <div key={i}
                  className="flex items-start gap-2.5 p-2.5 rounded-lg"
                  style={{ background: `color-mix(in srgb, ${t.color} 5%, transparent)`, border: `1px solid color-mix(in srgb, ${t.color} 12%, transparent)` }}
                >
                  <div className="shrink-0 mt-0.5 p-1 rounded" style={{ background: `color-mix(in srgb, ${t.color} 12%, transparent)`, color: t.color }}>{t.icon}</div>
                  <p className="text-[11px] text-tx-3 leading-relaxed">{t.tip}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
