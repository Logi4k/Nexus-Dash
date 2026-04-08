import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from 'sonner';
import { PAGE_THEMES } from "@/lib/theme";
import { useLocation } from "react-router-dom";
import {
  Plus,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
  Receipt,
  Wallet,
  TrendingDown,
  Hash,
  BarChart2,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,

} from "lucide-react";
import { useAppData } from "@/lib/store";
import { getQuickActionState } from "@/lib/quickActions";
import { fmtGBP, fmtDate, toNum, groupByMonth, cn, generateId } from "@/lib/utils";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import Modal from "@/components/Modal";
import StatCard from "@/components/StatCard";
import CustomSelect from "@/components/CustomSelect";
import DatePicker from "@/components/DatePicker";
import type { AppData, Expense } from "@/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FIRMS = [
  "Lucid Trading",
  "Tradeify",
  "Topstep",
  "FundingTicks",
  "MyFundedFX",
  "Take Profit Trader",
  "Maven Trading",
] as const;

const EXPENSE_CATS = ["account", "subscription", "other"] as const;
type ExpenseCat = (typeof EXPENSE_CATS)[number];

// Keep in sync with --color-cat-* tokens in index.css
const CAT_COLORS: Record<string, string> = {
  account:      "#5b8bbf",  // --color-cat-account
  subscription: "#9b8ec2",  // --color-cat-subscription
  other:        "#5aadaa",  // --color-cat-other (brand teal)
};

type TabKey = "propfirm" | "other";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseUSD(notes?: string): number | null {
  if (!notes) return null;
  const m = notes.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (!m) return null;
  return parseFloat(m[1].replace(",", ""));
}

function fmtMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Delete confirm button (inline)                                    */
/* ------------------------------------------------------------------ */

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [pending, setPending] = useState(false);

  if (!pending) {
    return (
      <button
        onClick={() => setPending(true)}
        className="md:opacity-0 md:group-hover:opacity-100 p-1.5 rounded text-tx-3 hover:text-loss hover:bg-loss/10 transition-all"
        title="Delete"
      >
        <Trash2 size={13} />
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        onClick={() => {
          setPending(false);
          onDelete();
        }}
        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-loss/15 text-loss hover:bg-loss/25 transition-all"
      >
        Delete
      </button>
      <button
        onClick={() => setPending(false)}
        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[rgba(var(--border-rgb),0.05)] text-tx-3 hover:text-tx-1 transition-all"
      >
        No
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spending Trend — custom CSS bars (no recharts)                    */
/* ------------------------------------------------------------------ */

function MonthlyTrendChart({
  monthGroups,
}: {
  monthGroups: { month: string; label: string; total: number }[];
}) {
  const bw = useBWMode();
  const [showAll, setShowAll] = useState(false);
  const chartData = useMemo(() => {
    return [...monthGroups]
      .slice(0, 8)
      .reverse()
      .map((g) => {
        const parts = g.label.split(" ");
        const shortMonth = parts[0].slice(0, 3);
        const shortYear = parts[1]?.slice(-2) ?? "";
        return {
          month: `${shortMonth} '${shortYear}`,
          total: parseFloat(g.total.toFixed(2)),
          fullLabel: g.label,
        };
      });
  }, [monthGroups]);

  if (chartData.length < 2) return null;

  const maxVal = Math.max(...chartData.map((d) => d.total), 1);
  const avgVal = chartData.reduce((s, d) => s + d.total, 0) / chartData.length;

  const latest = chartData[chartData.length - 1];
  const prev   = chartData[chartData.length - 2];
  const momPct = prev?.total > 0 ? ((latest.total - prev.total) / prev.total) * 100 : null;
  const momUp  = momPct !== null && momPct > 0;

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-tx-4">Spending Trend</p>
          <p className="text-sm font-semibold text-tx-1 mt-0.5">Monthly prop firm costs</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:items-center md:gap-5">
          <div className="text-right">
            <p className="text-[10px] text-tx-4 uppercase tracking-wider">Peak</p>
            <p className="text-sm font-bold text-loss font-mono tabular-nums mt-0.5">{fmtGBP(maxVal, 0)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-tx-4 uppercase tracking-wider">Avg / mo</p>
            <p className="text-sm font-bold text-tx-2 font-mono tabular-nums mt-0.5">{fmtGBP(avgVal, 0)}</p>
          </div>
          {momPct !== null && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
              style={{
                background: momUp ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
                border: `1px solid ${momUp ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`,
                color: momUp ? "#dc4040" : "var(--color-profit)",
              }}
            >
              {momUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {momUp ? "+" : ""}{momPct.toFixed(1)}% MoM
            </div>
          )}
        </div>
      </div>

      {/* Custom horizontal bar rows */}
      <div className="space-y-2.5">
        {chartData.slice(0, showAll ? undefined : 4).map((d, i) => {
          const pct       = (d.total / maxVal) * 100;
          const isCurrent = i === chartData.length - 1;
          const isPeak    = d.total === maxVal;
          const isLow     = d.total === Math.min(...chartData.map((c) => c.total));
          const color     = isPeak ? "#dc4040" : isCurrent ? bwColor("#5aadaa", bw) : "#a1a1aa";
          const barBg     = isPeak
            ? "linear-gradient(90deg,#dc404060,#dc4040)"
            : isCurrent
            ? bwColor("linear-gradient(90deg,#5aadaa80,#5aadaa)", bw)
            : "linear-gradient(90deg,rgba(var(--surface-rgb),0.08),rgba(var(--surface-rgb),0.16))";

          // Delta vs previous month
          const prevD = chartData[i - 1];
          const delta = prevD ? d.total - prevD.total : null;

          return (
            <div key={d.month} className="group rounded-xl p-3 md:p-0 transition-all duration-200 hover:bg-[rgba(var(--surface-rgb),0.03)]"
              style={{ border: isPeak ? "1px solid rgba(239,68,68,0.15)" : isCurrent ? "1px solid rgba(90,173,170,0.15)" : "1px solid rgba(var(--border-rgb),0.05)" }}>
              <div className="flex items-center justify-between gap-3 mb-2 md:hidden">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-[11px] font-mono text-tx-3 tabular-nums">{d.month}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isPeak && <span className="text-[8px] font-bold text-loss px-1 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)" }}>PEAK</span>}
                  {isCurrent && !isPeak && <span className="text-[8px] font-bold text-accent px-1 py-0.5 rounded" style={{ background: "rgba(14,184,154,0.1)" }}>NOW</span>}
                  <span className="text-[11px] font-bold font-mono tabular-nums" style={{ color }}>
                    {fmtGBP(d.total, 0)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <span className="hidden md:block text-[10px] font-mono text-tx-4 w-14 shrink-0 text-right tabular-nums">
                {d.month}
              </span>
              <div className="flex-1 relative h-7 rounded-lg overflow-hidden"
                style={{ background: "rgba(var(--surface-rgb),0.06)" }}>
                <div
                  className="absolute left-0 top-0 h-full rounded-lg transition-all duration-700"
                  style={{ width: `${pct}%`, background: barBg }}
                />
                <span
                  className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold font-mono tabular-nums"
                  style={{ color }}
                >
                  {fmtGBP(d.total, 0)}
                </span>
              </div>
              <div className="w-full md:w-20 shrink-0 flex items-center gap-1 justify-start md:justify-end flex-wrap">
                {isPeak && (
                  <span className="text-[10px] font-bold text-loss px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(239,68,68,0.1)" }}>PEAK</span>
                )}
                {isCurrent && !isPeak && (
                  <span className="text-[10px] font-bold text-accent px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(14,184,154,0.1)" }}>NOW</span>
                )}
                {isLow && !isCurrent && !isPeak && (
                  <span className="text-[10px] font-bold text-tx-4 px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(var(--surface-rgb),0.07)" }}>LOW</span>
                )}
                {delta !== null && !isPeak && !isCurrent && !isLow && (
                  <span className={cn(
                    "text-[10px] font-mono tabular-nums",
                    delta > 0 ? "text-loss/70" : "text-profit/70"
                  )}>
                    {delta > 0 ? "+" : ""}{fmtGBP(delta, 0)}
                  </span>
                )}
              </div>
              </div>
            </div>
          );
        })}
      </div>
      {chartData.length > 4 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 rounded-xl text-[12px] font-medium transition-all text-tx-3 hover:text-tx-1 sm:hidden"
          style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
        >
          View all {chartData.length} months
        </button>
      )}
      {showAll && chartData.length > 4 && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-2 rounded-xl text-[12px] font-medium transition-all text-tx-3 hover:text-tx-1 sm:hidden"
          style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
        >
          Show less
        </button>
      )}

      {/* Average line legend */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[rgba(var(--border-rgb),0.05)]">
        <div className="flex-1 relative h-px" style={{ background: "rgba(var(--surface-rgb),0.09)" }}>
          <div
            className="absolute top-0 h-px"
            style={{
              left: 0,
              width: `${(avgVal / maxVal) * 100}%`,
              background: "rgba(161,161,170,0.4)",
              borderRight: "1px dashed rgba(161,161,170,0.5)",
            }}
          />
        </div>
        <span className="text-[10px] text-tx-4 shrink-0">avg {fmtGBP(avgVal, 0)}/mo</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Firm Breakdown Strip                                               */
/* ------------------------------------------------------------------ */

function FirmBreakdownStrip({ expenses }: { expenses: { description: string; amount: number | string }[] }) {
  const bw = useBWMode();
  const firmTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.description] = (map[e.description] ?? 0) + toNum(e.amount);
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);
  }, [expenses]);

  const maxSpend = firmTotals[0]?.[1] ?? 1;

  const FIRM_COLORS = ["#dc4040","#c49060","#d4a84a","#5b8bbf","#9b8ec2","#5aadaa"].map(c => bwColor(c, bw));
  const totalAll = firmTotals.reduce((s, [, v]) => s + v, 0) || 1;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] text-tx-4 uppercase tracking-widest font-bold">Spend by Firm</p>
        <span className="text-[11px] font-bold font-mono text-loss">{firmTotals.length === 0 ? '£0.00' : fmtGBP(totalAll)}</span>
      </div>

      {/* Mini donut strip */}
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden mb-4">
        {firmTotals.map(([firm, total], i) => (
          <div
            key={firm}
            className="h-full rounded-sm transition-all duration-700"
            style={{ width: `${(total / totalAll) * 100}%`, background: FIRM_COLORS[i % FIRM_COLORS.length] }}
            title={`${firm}: ${((total / totalAll) * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      <div className="space-y-2">
        {firmTotals.map(([firm, total], i) => {
          const col = FIRM_COLORS[i % FIRM_COLORS.length];
          const pct = (total / maxSpend) * 100;
          const share = (total / totalAll) * 100;
          const medalColors = [bwColor("#f59e0b", bw), bwColor("#94a3b8", bw), bwColor("#cd7f32", bw)];
          const rankColor = i < 3 ? medalColors[i] : col;
          return (
            <div key={firm} className="flex items-center gap-2.5 group px-2.5 py-2 rounded-lg transition-colors hover:bg-[rgba(var(--surface-rgb),0.025)]">
              <span
                className="text-[10px] font-black w-4 h-4 rounded flex items-center justify-center shrink-0 tabular-nums"
                style={{
                  background: `${rankColor}18`,
                  color: rankColor,
                  border: `1px solid ${rankColor}30`,
                }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-tx-2 text-xs font-medium truncate">{firm}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] font-semibold tabular-nums" style={{ color: col }}>{share.toFixed(0)}%</span>
                    <span className="text-tx-1 text-xs font-mono font-bold">{fmtGBP(total)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.07)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${col}88, ${col})` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Prop Firm Tab                                                      */
/* ------------------------------------------------------------------ */

function PropFirmTab({ initialOpen = false, onOpened }: { initialOpen?: boolean; onOpened?: () => void }) {
  const bw = useBWMode();
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (!initialOpen) return;
    setAddOpen(true);
    onOpened?.();
  }, [initialOpen, onOpened]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    firm: FIRMS[0] as string,
    cat: "" as ExpenseCat | "",
    customCat: "",
    amount: "",
    customFirm: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  /* ---- Stats ---- */
  const stats = useMemo(() => {
    const expenses = data.expenses;
    const total = expenses.reduce((s, e) => s + toNum(e.amount), 0);
    const count = expenses.length;
    const avg = count > 0 ? total / count : 0;

    // Monthly breakdown for trend
    const byMonth = groupByMonth(expenses);
    const monthTotals = Object.entries(byMonth).map(([m, items]) => ({
      month: m,
      total: items.reduce((s, e) => s + toNum(e.amount), 0),
      count: items.length,
    })).sort((a, b) => b.month.localeCompare(a.month));

    const thisMonth   = monthTotals[0]?.total ?? 0;
    const lastMonth   = monthTotals[1]?.total ?? 0;
    const mom = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
    const peakMonth   = monthTotals.reduce((m, d) => d.total > m.total ? d : m, { month: "", total: 0, count: 0 });

    // Total earned from withdrawals
    const totalEarned = data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
    const roi = total > 0 ? ((totalEarned - total) / total) * 100 : 0;

    // Category breakdown
    const cats: Record<string, number> = {};
    for (const e of expenses) {
      cats[e.cat ?? "other"] = (cats[e.cat ?? "other"] ?? 0) + toNum(e.amount);
    }

    // Firm vs earned
    const firmStats = FIRMS.map((firm) => ({
      firm,
      spent:  expenses.filter((e) => e.description === firm).reduce((s, e) => s + toNum(e.amount), 0),
      earned: data.withdrawals.filter((w) => w.firm === firm).reduce((s, w) => s + toNum(w.gross), 0),
    })).filter((f) => f.spent > 0 || f.earned > 0).sort((a, b) => (b.earned - b.spent) - (a.earned - a.spent));

    return { total, count, avg, thisMonth, lastMonth, mom, peakMonth, totalEarned, roi, cats, firmStats };
  }, [data.expenses, data.withdrawals]);

  /* ---- Filtered (search over firm name and notes) ---- */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...data.expenses]
      .filter(
        (e) =>
          !q ||
          e.description.toLowerCase().includes(q) ||
          (e.notes ?? "").toLowerCase().includes(q) ||
          (e.cat ?? "").toLowerCase().includes(q) ||
          e.date.toLowerCase().includes(q) ||
          String(e.amount).toLowerCase().includes(q)
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.expenses, search]);

  /* ---- Monthly groups (from filtered, sorted desc) ---- */
  const monthGroups = useMemo(() => {
    const grouped = groupByMonth(filtered);
    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, items]) => ({
        month,
        label: fmtMonthLabel(month),
        items: [...items].sort((a, b) => b.date.localeCompare(a.date)),
        total: items.reduce((s, e) => s + toNum(e.amount), 0),
      }));
  }, [filtered]);

  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    setExpandedMonths(new Set(monthGroups.map((group) => group.month)));
  }, [monthGroups, search]);

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      next.has(month) ? next.delete(month) : next.add(month);
      return next;
    });
  };

  const handleAdd = () => {
    const firmName = form.firm === "__other__" ? form.customFirm.trim() : form.firm;
    const catValue = form.cat === "__other__" ? form.customCat.trim() : form.cat;
    const newErrors: Record<string, string> = {};
    if (!form.amount || parseFloat(form.amount) <= 0) newErrors.amount = 'Must be > 0';
    if (!catValue) newErrors.cat = 'Required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    const expense: Expense = {
      id: generateId(),
      date: form.date,
      description: firmName,
      cat: catValue as ExpenseCat,
      amount: parseFloat(form.amount),
    };
    update((prev) => ({ ...prev, expenses: [expense, ...prev.expenses] }));
    toast.success('Expense added');
    setAddOpen(false);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      firm: FIRMS[0],
      cat: "",
      customCat: "",
      amount: "",
      customFirm: "",
    });
  };

  const handleDelete = (id: string) => {
    const deleted = data.expenses.find((e) => e.id === id);
    if (!deleted) return;
    update((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
    toast('Expense deleted', {
      action: { label: 'Undo', onClick: () => update((prev) => ({ ...prev, expenses: [...prev.expenses, deleted] })) },
      duration: 5000,
    });
  };

  return (
    <div className="space-y-5">
      {/* Monthly Trend Chart + quick stats row */}
      <MonthlyTrendChart monthGroups={monthGroups} />

      {/* 4-metric stats strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Spent"
          value={stats.total}
          icon={<TrendingDown size={15} className="text-loss" />}
          accentColor="var(--color-loss)"
          delay={0}
        />
        <StatCard
          label="This Month"
          value={stats.thisMonth}
          change={stats.mom}
          subLabel={stats.mom !== 0 ? `vs ${fmtGBP(stats.lastMonth)} last mo` : undefined}
          icon={<BarChart2 size={15} />}
          accentColor="var(--color-warn)"
          delay={60}
        />
        <StatCard
          label="Average/Entry"
          value={stats.avg}
          icon={<Hash size={15} />}
          accentColor="var(--color-teal)"
          delay={120}
        />
        <StatCard
          label="Total Earned"
          value={stats.totalEarned}
          icon={<DollarSign size={15} className={stats.totalEarned >= stats.total ? "text-profit" : "text-loss"} />}
          accentColor={stats.totalEarned >= stats.total ? "var(--color-profit)" : "var(--color-loss)"}
          change={stats.roi}
          subLabel="vs total spent"
          delay={180}
        />
      </div>

      {/* Two-column: main content + insights sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-5 items-start">

        {/* ── Left: Firm Breakdown + Search + Monthly sections ── */}
        <div className="flex flex-col gap-4">
          <FirmBreakdownStrip expenses={data.expenses} />

          {/* Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none" />
              <input
                className="nx-input pl-9 text-xs"
                placeholder="Search firm or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-primary btn btn-sm" onClick={() => setAddOpen(true)}>
              <Plus size={13} />
              Add Expense
            </button>
          </div>

          {/* Monthly collapsible sections */}
          {monthGroups.length === 0 ? (
            <div className="task-empty">
              <div className="task-empty-copy">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-tx-4">
                  <Receipt size={12} />
                  Prop Expenses
                </div>
                <div>
                  <p className="text-base font-semibold text-tx-1">
                    {search ? "No prop expenses match this search." : "Start tracking evaluation and platform costs."}
                  </p>
                  <p className="mt-1 text-sm text-tx-3">
                    {search
                      ? "Clear the filter or add a new entry to keep the ledger complete."
                      : "Capture account fees, subscriptions, and firm costs so net payout performance stays accurate."}
                  </p>
                </div>
              </div>
              <div className="task-empty-actions mt-4">
                {search ? (
                  <button className="btn-ghost btn-sm" onClick={() => setSearch("")}>
                    Clear Search
                  </button>
                ) : (
                  <button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
                    <Plus size={14} /> Add Expense
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {monthGroups.map(({ month, label, items, total }, mIdx) => {
            const isOpen = expandedMonths.has(month);
            const mColors = ["#5b8bbf","#9b8ec2","#d4a84a","#dc4040","#5aadaa","#c49060","#22c55e","#c070a0"].map(c => bwColor(c, bw));
            const mColor = mColors[mIdx % mColors.length];
            return (
              <div
                key={month}
                className="card overflow-hidden"
                style={{ borderLeft: `2px solid ${mColor}50` }}
              >
                {/* Month header */}
                <button
                  onClick={() => toggleMonth(month)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-[rgba(var(--surface-rgb),0.02)] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen ? (
                      <ChevronDown size={14} className="text-tx-3" />
                    ) : (
                      <ChevronRight size={14} style={{ color: mColor }} />
                    )}
                    <span className="text-tx-1 text-sm font-medium">{label}</span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                      style={{ background: `${mColor}15`, color: mColor }}
                    >
                      {items.length}
                    </span>
                  </div>
                  <span className="text-tx-1 font-mono font-bold tabular-nums text-sm">
                    {fmtGBP(total)}
                  </span>
                </button>

                {/* Expanded rows */}
                {isOpen && (
                  <div className="border-t border-[rgba(var(--border-rgb),0.06)]">
                    {/* Column headers */}
                    <div className="hidden md:grid grid-cols-[100px_1fr_100px_80px_40px] gap-3 px-4 py-2 border-b border-[rgba(var(--border-rgb),0.04)]">
                      <span className="text-tx-3 text-[10px] uppercase tracking-wider font-medium">Date</span>
                      <span className="text-tx-3 text-[10px] uppercase tracking-wider font-medium">Firm</span>
                      <span className="text-tx-3 text-[10px] uppercase tracking-wider font-medium">Category</span>
                      <span className="text-tx-3 text-[10px] uppercase tracking-wider font-medium text-right">Amount</span>
                      <span />
                    </div>
                    <div className="divide-y divide-white/[0.04] md:hidden">
                      {items.map((e) => {
                        const catColor = bwColor(CAT_COLORS[e.cat ?? "other"], bw);
                        return (
                          <div key={`mobile-${e.id}`} className="space-y-2 px-4 py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-tx-1 text-sm font-medium truncate">{e.description}</div>
                                <div className="mt-1 text-tx-3 text-[11px]">{fmtDate(e.date)}</div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-tx-1 text-sm font-semibold font-mono tabular-nums">{fmtGBP(toNum(e.amount))}</div>
                                <div className="mt-1 flex justify-end">
                                  <DeleteButton onDelete={() => handleDelete(e.id)} />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize"
                                style={{ background: `${catColor}18`, color: catColor }}
                              >
                                {e.cat ?? "other"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="hidden divide-y divide-white/[0.04] md:block">
                      {items.map((e) => (
                        <div
                          key={e.id}
                          className="grid grid-cols-[100px_1fr_100px_80px_40px] gap-3 px-4 py-2.5 group hover:bg-[rgba(var(--surface-rgb),0.02)] transition-colors"
                        >
                          <span className="text-tx-3 text-xs font-mono tabular-nums self-center">
                            {fmtDate(e.date)}
                          </span>
                          <span className="text-tx-1 text-xs font-medium self-center truncate">
                            {e.description}
                          </span>
                          {(() => {
                            const catColor = bwColor(CAT_COLORS[e.cat ?? "other"], bw);
                            return (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded capitalize self-center"
                                style={{ background: `${catColor}18`, color: catColor }}
                              >
                                {e.cat ?? "other"}
                              </span>
                            );
                          })()}
                          <span className="text-tx-1 text-xs font-mono tabular-nums text-right self-center font-semibold">
                            {fmtGBP(toNum(e.amount))}
                          </span>
                          <div className="self-center flex justify-end">
                            <DeleteButton onDelete={() => handleDelete(e.id)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
              })}
            </div>
          )}
        </div>

        {/* ── Right: Insights sidebar ── */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-6">

          {/* Spend vs Earned ROI */}
          {(() => {
            const net   = stats.totalEarned - stats.total;
            const isPos = net >= 0;
            return (
              <div className="card p-4 overflow-hidden relative"
                style={{
                  background: isPos
                    ? "linear-gradient(135deg, rgba(34,197,94,0.07) 0%, transparent 60%)"
                    : "linear-gradient(135deg, rgba(239,68,68,0.07) 0%, transparent 60%)",
                  borderColor: isPos ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
                }}
              >
                {/* Watermark */}
                <div className="absolute right-1 top-0 text-[46px] font-black tabular-nums select-none pointer-events-none"
                  style={{ color: isPos ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)", lineHeight: 1 }}
                >
                  {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(0)}%
                </div>
                <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-2">Spend vs Earned</p>
                <div className={cn("text-[24px] font-black tabular-nums leading-none mb-1", isPos ? "text-profit" : "text-loss")}>
                  {isPos ? "+" : ""}{fmtGBP(net)}
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-3"
                  style={{
                    background: isPos ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    color: isPos ? "#4a9a7a" : "#f87171",
                    border: `1px solid ${isPos ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  }}
                >
                  {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}% ROI
                </span>
                <div className="flex items-center justify-between text-xs mb-2">
                  <div>
                    <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-0.5">Invested</p>
                    <p className="text-loss font-bold tabular-nums">{fmtGBP(stats.total)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-tx-3 uppercase tracking-wider mb-0.5">Earned</p>
                    <p className="text-profit font-bold tabular-nums">{fmtGBP(stats.totalEarned)}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden bg-[rgba(var(--border-rgb),0.06)]">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", isPos ? "bg-profit" : "bg-loss")}
                    style={{ width: `${Math.min((Math.min(stats.totalEarned, stats.total) / Math.max(stats.total, stats.totalEarned, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Peak month callout */}
          {stats.peakMonth.month && (
            <div className="card p-4" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.05) 0%, transparent 100%)", borderColor: "rgba(239,68,68,0.1)" }}>
              <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-1">Peak Month</p>
              <p className="text-sm font-bold text-tx-1">{fmtMonthLabel(stats.peakMonth.month)}</p>
              <p className="text-lg font-bold text-loss tabular-nums">{fmtGBP(stats.peakMonth.total)}</p>
              <p className="text-[11px] text-tx-4 mt-0.5">{stats.peakMonth.count} entries</p>
            </div>
          )}
        </div>

      </div>{/* end 2-col grid */}

      {/* Add Expense Modal */}
      <Modal open={addOpen} onClose={() => { setAddOpen(false); setErrors({}); }} title="Add Expense" size="sm">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-tx-3 text-xs block mb-1">Date</label>
              <DatePicker
                value={form.date}
                onChange={(date) => setForm((p) => ({ ...p, date }))}
              />
            </div>
            <div>
              <label className="text-tx-3 text-xs block mb-1">Category</label>
              <CustomSelect
                value={form.cat}
                onChange={(v) => { setForm((p) => ({ ...p, cat: v, customCat: v === "__other__" ? "" : p.customCat })); setErrors((prev) => ({ ...prev, cat: '' })); }}
                options={[...EXPENSE_CATS.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })), { value: "__other__", label: "Other" }]}
                placeholder="Select category..."
                allowCustom={true}
                customLabel="Type expense type…"
              />
              {form.cat === "__other__" && (
                <input
                  className="nx-input mt-2"
                  placeholder="What was this expense for?"
                  value={form.customCat}
                  onChange={(e) => setForm((p) => ({ ...p, customCat: e.target.value }))}
                />
              )}
              {errors.cat && <p className="text-[10px] text-loss mt-1">{errors.cat}</p>}
            </div>
          </div>

          <div>
            <label className="text-tx-3 text-xs block mb-1">Firm</label>
            <CustomSelect
              value={form.firm}
              onChange={(v) => { setForm((p) => ({ ...p, firm: v, customFirm: "" })); }}
              options={[...FIRMS.map((f) => ({ value: f, label: f })), { value: "__other__", label: "Other..." }]}
              placeholder="Select firm"
            />
            {form.firm === "__other__" && (
              <input
                className="nx-input mt-2"
                placeholder="Firm name"
                value={form.customFirm}
                onChange={(e) => setForm((p) => ({ ...p, customFirm: e.target.value }))}
              />
            )}
          </div>

          <div>
            <label className="text-tx-3 text-xs block mb-1">Amount (£)</label>
            <input
              className="nx-input"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => { setForm((p) => ({ ...p, amount: e.target.value })); setErrors((prev) => ({ ...prev, amount: '' })); }}
            />
            {errors.amount && <p className="text-[10px] text-loss mt-1">{errors.amount}</p>}
          </div>

          <div className="modal-action-bar">
            <button className="btn-primary btn flex-1" onClick={handleAdd}
              disabled={!form.amount || !form.cat || (form.firm === "__other__" ? !form.customFirm.trim() : false) || (form.cat === "__other__" ? !form.customCat.trim() : false)}
              style={(!form.amount || !form.cat || (form.firm === "__other__" ? !form.customFirm.trim() : false) || (form.cat === "__other__" ? !form.customCat.trim() : false)) ? { opacity: 0.5 } : undefined}>
              Add Expense
            </button>
            <button className="btn-ghost btn" onClick={() => { setAddOpen(false); setErrors({}); }}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Other Expenses Tab                                                 */
/* ------------------------------------------------------------------ */

function OtherExpensesTab() {
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);

  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    description: "",
  });

  /* ---- Stats ---- */
  const stats = useMemo(() => {
    const entries = data.genExpenses;
    const totalGBP = entries.reduce((s, e) => s + toNum(e.amount), 0);
    const totalUSD = entries.reduce((s, e) => {
      const usd = parseUSD(e.notes);
      return s + (usd ?? 0);
    }, 0);
    // Monthly breakdown
    const byMonth: Record<string, number> = {};
    for (const e of entries) {
      const k = e.date.slice(0, 7);
      byMonth[k] = (byMonth[k] ?? 0) + toNum(e.amount);
    }
    const months = Object.values(byMonth);
    const avgMonthly = months.length ? months.reduce((s, v) => s + v, 0) / months.length : 0;
    const thisMonth = byMonth[new Date().toISOString().slice(0, 7)] ?? 0;
    return { totalGBP, totalUSD, count: entries.length, avgMonthly, thisMonth };
  }, [data.genExpenses]);

  /* ---- Filtered + sorted entries ---- */
  const sorted = useMemo(() => {
    const q = search.toLowerCase().trim();
    return [...data.genExpenses]
      .filter((e) => {
        if (!q) return true;
        return [e.description, e.notes ?? "", e.date, String(e.amount)]
          .some((value) => value.toLowerCase().includes(q));
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.genExpenses, search]);

  const handleAdd = () => {
    if (!form.amount) return;
    const expense: Expense = {
      id: generateId(),
      date: form.date,
      description: form.description.trim() || "Other",
      cat: "other",
      amount: parseFloat(form.amount),
    };
    update((prev) => ({ ...prev, genExpenses: [expense, ...prev.genExpenses] }));
    toast.success('Expense added');
    setAddOpen(false);
    setForm({
      date: new Date().toISOString().slice(0, 10),
      amount: "",
      description: "",
    });
  };

  const handleDelete = (id: string) => {
    const deleted = data.genExpenses.find((e) => e.id === id);
    if (!deleted) return;
    update((prev) => ({
      ...prev,
      genExpenses: prev.genExpenses.filter((e) => e.id !== id),
    }));
    toast('Expense deleted', {
      action: { label: 'Undo', onClick: () => update((prev) => ({ ...prev, genExpenses: [...prev.genExpenses, deleted] })) },
      duration: 5000,
    });
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Spent"
          value={stats.totalGBP}
          icon={<Wallet size={15} className="text-loss" />}
          accentColor="var(--color-loss)"
          delay={0}
        />
        <StatCard
          label="This Month"
          value={stats.thisMonth}
          icon={<BarChart2 size={15} />}
          accentColor="var(--color-warn)"
          delay={60}
        />
        <StatCard
          label="Avg / Month"
          value={stats.avgMonthly}
          icon={<Hash size={15} />}
          accentColor="var(--color-teal)"
          delay={120}
        />
        <StatCard
          label="Total Entries"
          value={stats.count}
          prefix=""
          suffix=""
          decimals={0}
          icon={<DollarSign size={15} />}
          accentColor="var(--color-warn)"
          delay={180}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="text-tx-3 text-xs">
            {sorted.length} {sorted.length === 1 ? "entry" : "entries"} recorded
          </div>
          <div className="relative flex-1 min-w-0 sm:min-w-[240px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3 pointer-events-none" />
            <input
              className="nx-input pl-9 text-xs"
              placeholder="Search description or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-primary btn btn-sm" onClick={() => setAddOpen(true)}>
          <Plus size={13} />
          Add Expense
        </button>
      </div>

      {/* Entries list */}
      <div className="card overflow-hidden" style={{ border: "1px solid rgba(14,184,154,0.1)" }}>
        {sorted.length === 0 ? (
          <div className="task-empty m-3">
            <div className="task-empty-copy">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-tx-4">
                <Wallet size={12} />
                Other Expenses
              </div>
              <div>
                <p className="text-base font-semibold text-tx-1">
                  {search ? "No entries match this search." : "Keep your trading overhead in one ledger."}
                </p>
                <p className="mt-1 text-sm text-tx-3">
                  {search
                    ? "Reset the search or add a new item."
                    : "Track software, gear, education, and other trading costs so tax and ROI views stay complete."}
                </p>
              </div>
            </div>
            <div className="task-empty-actions mt-4">
              {search ? (
                <button className="btn-ghost btn-sm" onClick={() => setSearch("")}>
                  Clear Search
                </button>
              ) : (
                <button className="btn-primary btn-sm" onClick={() => setAddOpen(true)}>
                  <Plus size={14} /> Add Expense
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Column headers — desktop */}
            <div className="hidden md:grid grid-cols-[110px_1fr_110px_48px] gap-3 px-4 py-3 border-b border-[rgba(var(--border-rgb),0.06)]">
              <span className="text-tx-3 text-[10px] uppercase tracking-wider font-medium">Date</span>
              <span className="text-tx-3 text-[10px] uppercase tracking-wider font-medium">Description</span>
              <span className="text-tx-3 text-[10px] uppercase tracking-wider font-medium text-right">Amount</span>
              <span />
            </div>
            <div className="divide-y divide-white/[0.04]">
              {(listExpanded ? sorted : sorted.slice(0, 5)).map((e, i) => {
                const gbp = toNum(e.amount);
                const usd = parseUSD(e.notes);
                return (
                  <div key={e.id} className={cn("group hover:bg-[rgba(var(--surface-rgb),0.02)] transition-colors", i % 2 !== 0 && "bg-[rgba(var(--border-rgb),0.01)]")}>
                    {/* Mobile */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 md:hidden">
                      <div className="min-w-0">
                        <div className="text-tx-2 text-sm font-medium truncate">{e.description}</div>
                        <div className="mt-0.5 text-tx-3 text-[11px]">{fmtDate(e.date)}</div>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-2">
                        <div>
                          <div className="text-tx-1 text-sm font-semibold font-mono tabular-nums">{fmtGBP(gbp)}</div>
                          {usd !== null && <div className="mt-0.5 text-tx-4 text-[10px] font-mono">${usd.toFixed(0)}</div>}
                        </div>
                        <DeleteButton onDelete={() => handleDelete(e.id)} />
                      </div>
                    </div>
                    {/* Desktop */}
                    <div className={cn("hidden md:grid grid-cols-[110px_1fr_110px_48px] gap-3 px-4 py-2.5", i % 2 !== 0 && "bg-[rgba(var(--border-rgb),0.01)]")}>
                      <span className="text-tx-2 text-xs font-mono tabular-nums self-center">{fmtDate(e.date)}</span>
                      <span className="text-tx-2 text-xs font-medium self-center truncate">{e.description}</span>
                      <span className="text-tx-1 text-xs font-mono tabular-nums font-semibold text-right self-center">
                        {fmtGBP(gbp)}{usd !== null && <span className="text-tx-4 font-normal text-[10px] ml-1">(${usd.toFixed(0)})</span>}
                      </span>
                      <div className="self-center flex justify-end">
                        <DeleteButton onDelete={() => handleDelete(e.id)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {sorted.length > 5 && (
              <button
                className="w-full py-2.5 text-[11px] font-medium text-tx-3 hover:text-tx-1 transition-colors border-t border-[rgba(var(--border-rgb),0.04)]"
                onClick={() => setListExpanded((v) => !v)}
              >
                {listExpanded ? `Show less` : `Show ${sorted.length - 5} more`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Other Expense"
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Date</label>
            <DatePicker
              value={form.date}
              onChange={(date) => setForm((p) => ({ ...p, date }))}
            />
          </div>

          <div>
            <label className="text-tx-3 text-xs block mb-1">Description</label>
            <input
              className="nx-input"
              placeholder="e.g. Software, Course, Equipment..."
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-tx-3 text-xs block mb-1">Amount (£)</label>
            <input
              className="nx-input"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            />
          </div>

          <div className="modal-action-bar">
            <button className="btn-primary btn flex-1" onClick={handleAdd}
              disabled={!form.amount}
              style={!form.amount ? { opacity: 0.5 } : undefined}>
              <Wallet size={13} />
              Add Expense
            </button>
            <button className="btn-ghost btn" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function Expenses() {
  const { data: _data } = useAppData();
  const data = _data ?? ({} as AppData);
  const location = useLocation();
  const handledLocationAction = useRef<string | null>(null);
  const [tab, setTab] = useState<TabKey>("propfirm");

  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.expenses, isBW);
  const [triggerAddOpen, setTriggerAddOpen] = useState(false);

  useEffect(() => {
    const quickAction = getQuickActionState(location.state);
    const requestKey = quickAction?.quickActionId ?? null;

    if (!quickAction?.action) {
      handledLocationAction.current = null;
      return;
    }
    if (handledLocationAction.current === requestKey) return;

    if (quickAction.action === "addExpense") {
      handledLocationAction.current = requestKey;
      setTab("propfirm");
      setTriggerAddOpen(true);
    }
  }, [location.state]);

  const tabs: { key: TabKey; label: string; count: number; icon: React.ReactNode }[] = [
    {
      key: "propfirm",
      label: "Prop Firm",
      count: data.expenses.length,
      icon: <Receipt size={13} />,
    },
    {
      key: "other",
      label: "Other Expenses",
      count: data.genExpenses.length,
      icon: <Wallet size={13} />,
    },
  ];

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Expenses</div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="page-title">Expense Tracker</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1">
        {tabs.map(({ key, label, count, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn("tab-pill flex items-center gap-1.5", tab === key && "active")}
          >
            {icon}
            {label}
            <span className={cn("ml-0.5 text-[10px]", tab === key ? "opacity-70" : "opacity-40")}>
              ({count})
            </span>
          </button>
        ))}
      </div>

      <div className="divider" />

      {/* Tab content */}
      {tab === "propfirm" && <PropFirmTab initialOpen={triggerAddOpen} onOpened={() => setTriggerAddOpen(false)} />}
      {tab === "other" && <OtherExpensesTab />}
    </div>
  );
}
