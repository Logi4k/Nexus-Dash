import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { PAGE_THEMES } from "@/lib/theme";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, ArrowDownToLine, Globe,
  Layers, Clock, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Target,
  AlertCircle, Activity, CreditCard, Zap, BarChart3,
  ArrowUpRight, Receipt, Wallet, CalendarDays, PiggyBank,
  TrendingDown as TrendDown, Banknote, Flame, BookOpen,
  Calendar, Plus, Pencil, Trash2, NotebookPen,
} from "lucide-react";
import {
  AreaChart, Area, Line, LineChart, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ComposedChart, ReferenceLine,
} from "recharts";
import { useAppData } from "@/lib/store";
import type { AppData } from "@/types";
import Modal from "@/components/Modal";
import { navigateToQuickAction, type QuickAction } from "@/lib/quickActions";
import {
  fmtGBP, fmtUSD, fmtShortDate, toNum, groupByMonth,
  formatMinutesAsLabel, getActiveSession, getETMinutes, getEasternTimeParts,
  getEasternTimeZoneAbbreviation, getLocalTimeZoneAbbreviation, getNextMarketSession, MARKET_SESSIONS, minutesUntilNextOpen,
} from "@/lib/utils";
import type { MarketSession } from "@/types";
import AnimatedNumber from "@/components/AnimatedNumber";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import { KPICard } from "@/components/dashboard/KPICard";
import { TrendPill } from "@/components/dashboard/TrendPill";
import { AccountTile } from "@/components/dashboard/AccountTile";

// ── Palette constants (semantic – these keep colour even in BW) ────────────────
const PROFIT  = "#22c55e";
const LOSS    = "#f87171";
const WARN    = "#d97706";  // amber-600 — readable on both light and dark

// ── Decorative palette (greyed out in BW mode via useBWMode) ───────────────────
const ACCENT_RAW = "#f1f5f9";
const PURPLE_RAW = "#9b8ec2";
const BLUE_RAW   = "#5b8bbf";
const ORANGE_RAW = "#c49060";

// ── Framer Motion variants ─────────────────────────────────────────────────────
const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};


// ── Live clock ─────────────────────────────────────────────────────────────────
function useCurrentTime() {
  const nowRef = useRef(new Date());
  return nowRef.current;
}

// ── Session helpers ────────────────────────────────────────────────────────────
function sessionProgress(s: MarketSession, now: Date): number {
  const cur = getETMinutes(now);
  const [sh, sm] = s.startET.split(":").map(Number);
  const [eh, em] = s.endET.split(":").map(Number);
  const start = sh * 60 + sm, end = eh * 60 + em;
  const total = end > start ? end - start : 1440 - start + end;
  const elapsed = end > start ? cur - start : cur >= start ? cur - start : 1440 - start + cur;
  return Math.max(0, Math.min(100, (elapsed / total) * 100));
}

function sessionCountdown(s: MarketSession, now: Date): string {
  const { hour, minute, second } = getEasternTimeParts(now);
  const totalSec = hour * 3600 + minute * 60 + second;
  const [eh, em] = s.endET.split(":").map(Number);
  const endSec = eh * 3600 + em * 60;
  const rem = endSec > totalSec ? endSec - totalSec : 86400 - totalSec + endSec;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Returns "Xh Ym" or "Ym" until a session next opens, accounting for weekends. */
function opensInLabel(session: MarketSession, now: Date): string {
  return formatMinutesAsLabel(minutesUntilNextOpen(session, now));
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.dashboard, isBW);
  const ACCENT = bwColor(ACCENT_RAW, isBW);
  const PURPLE = bwColor(PURPLE_RAW, isBW);
  const BLUE   = bwColor(BLUE_RAW, isBW);
  const ORANGE = bwColor(ORANGE_RAW, isBW);
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const navigate = useNavigate();
  const now = useCurrentTime();
  const easternTz = getEasternTimeZoneAbbreviation(now);
  const localTz = getLocalTimeZoneAbbreviation();

  const [activeSession, setActiveSession] = useState<MarketSession | null>(
    () => getActiveSession(new Date())
  );
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedChartMonth, setSelectedChartMonth] = useState<number | null>(null);
  const [heroPeriod, setHeroPeriod] = useState<"1W" | "1M" | "3M" | "All">("All");

  // ── Wealth target modal ──────────────────────────────────────────────────────
  const emptyTargetForm = { emoji: "TG", name: "", desc: "", target: "", saved: "", monthly: "" };
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
  const [targetForm, setTargetForm] = useState(emptyTargetForm);

  function openAddTarget() {
    setEditingTargetId(null);
    setTargetForm(emptyTargetForm);
    setTargetModalOpen(true);
  }
  function openEditTarget(id: string) {
    const t = data.wealthTargets.find((x) => x.id === id);
    if (!t) return;
    setEditingTargetId(id);
    setTargetForm({ emoji: t.emoji, name: t.name, desc: t.desc ?? "", target: String(t.target), saved: String(t.saved), monthly: String(t.monthly) });
    setTargetModalOpen(true);
  }
  function saveTarget() {
    const payload = {
      emoji: targetForm.emoji || "TG",
      name: targetForm.name.trim(),
      desc: targetForm.desc.trim(),
      target: parseFloat(targetForm.target) || 0,
      saved: parseFloat(targetForm.saved) || 0,
      monthly: parseFloat(targetForm.monthly) || 0,
    };
    if (!payload.name) return;
    if (editingTargetId) {
      update((prev) => ({
        ...prev,
        wealthTargets: prev.wealthTargets.map((t) =>
          t.id === editingTargetId ? { ...t, ...payload } : t
        ),
      }));
    } else {
      update((prev) => ({
        ...prev,
        wealthTargets: [...(prev.wealthTargets ?? []), { id: crypto.randomUUID(), ...payload }],
      }));
    }
    setTargetModalOpen(false);
  }
  function deleteTarget(id: string) {
    update((prev) => ({
      ...prev,
      wealthTargets: prev.wealthTargets.filter((t) => t.id !== id),
    }));
  }

  useEffect(() => {
    const id = setInterval(() => {
      setActiveSession(getActiveSession(new Date()));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const toggleSection = useCallback((key: string) => {
    setExpandedSection((prev) => (prev === key ? null : key));
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // Period filter cutoff
    const now = new Date();
    const cutoff = heroPeriod === "1W" ? new Date(now.getTime() - 7 * 86400000)
      : heroPeriod === "1M" ? new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      : heroPeriod === "3M" ? new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      : null;
    const filteredWithdrawals = cutoff ? data.withdrawals.filter((w) => new Date(w.date) >= cutoff) : data.withdrawals;
    const filteredExpenses = cutoff ? data.expenses.filter((e) => new Date(e.date) >= cutoff) : data.expenses;

    // Core P&L
    const totalWithdrawals = filteredWithdrawals.reduce((s, w) => s + toNum(w.gross), 0);
    const totalExpenses = filteredExpenses.reduce((s, e) => s + toNum(e.amount), 0);
    const netPnL = totalWithdrawals - totalExpenses;
    const margin = totalWithdrawals > 0 ? (netPnL / totalWithdrawals) * 100 : 0;

    // Portfolio
    const investVal = data.investments.reduce(
      (s, i) => s + toNum(i.units) * toNum(i.cur), 0
    );
    const investCost = data.investments.reduce(
      (s, i) => s + toNum(i.units) * toNum(i.buy), 0
    );
    const t212Val = data.t212?.total_value || 0;
    const portfolioValue = investVal + t212Val;
    const portfolioGain = investVal - investCost + (data.t212?.ppl || 0);

    // Debt
    const allDebts = [...(data.debts || []), ...(data.otherDebts || [])];
    const totalDebt = allDebts.reduce((s, d) => s + d.currentBalance, 0);
    const monthlyDebtPayments = allDebts.reduce((s, d) => s + (d.monthly || 0), 0);

    // Accounts
    const fundedAccs = data.accounts.filter((a) =>
      ["funded", "Funded"].includes(a.status)
    );
    const challengeAccs = data.accounts.filter((a) => a.status.toLowerCase() === "challenge");
    const breachedAccs = data.accounts.filter((a) =>
      ["Breached", "breached"].includes(a.status)
    );
    const activeAccs = [...fundedAccs, ...challengeAccs].slice(0, 8);

    // Funded account P&L (balance growth above initial balance in active funded accounts)
    const fundedAccountPnL = fundedAccs.reduce((s, a) => {
      const bal = toNum(a.balance);
      const init = toNum(a.initialBalance ?? a.balance);
      return s + (bal - init);
    }, 0);

    // Monthly subscriptions (active only)
    const monthlySubs = data.subscriptions.filter((sub) => !sub.cancelled).reduce((s, sub) => {
      if (sub.frequency === "monthly") return s + toNum(sub.amount);
      if (sub.frequency === "yearly") return s + toNum(sub.amount) / 12;
      if (sub.frequency === "weekly") return s + (toNum(sub.amount) * 52) / 12;
      return s;
    }, 0);

    // Chart data: income vs costs per month (last 8 months)
    const byMonth = groupByMonth(filteredExpenses);
    const wByMonth: Record<string, number> = {};
    filteredWithdrawals.forEach((w) => {
      const k = w.date.slice(0, 7);
      wByMonth[k] = (wByMonth[k] || 0) + toNum(w.gross);
    });
    const allKeys = [
      ...new Set([...Object.keys(byMonth), ...Object.keys(wByMonth)]),
    ].sort();
    const last8 = allKeys.slice(-8);
    const monthlyChart = last8.map((k) => {
      const income = wByMonth[k] || 0;
      const costs = byMonth[k]?.reduce((s, e) => s + toNum(e.amount), 0) || 0;
      return {
        month: new Date(k + "-01T00:00:00").toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
        }),
        monthKey: k,
        income,
        costs,
        net: income - costs,
      };
    });

    // Cumulative P&L chart (month-by-month running total)
    let runningPnL = 0;
    const pnlChart = last8.map((k) => {
      const inc = wByMonth[k] || 0;
      const cost = byMonth[k]?.reduce((s, e) => s + toNum(e.amount), 0) || 0;
      runningPnL += inc - cost;
      return {
        month: new Date(k + "-01T00:00:00").toLocaleDateString("en-GB", {
          month: "short",
          year: "2-digit",
        }),
        pnl: runningPnL,
      };
    });

    // Firm spending breakdown
    const firmMap: Record<string, number> = {};
    data.expenses.forEach((e) => {
      firmMap[e.description] = (firmMap[e.description] || 0) + toNum(e.amount);
    });
    const topFirms = Object.entries(firmMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    const firmMax = topFirms[0]?.[1] || 1;

    // Recent activity (latest 6 expenses)
    const recentTx = [...data.expenses]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);

    // Monthly averages
    const monthKeys = Object.keys(wByMonth);
    const avgMonthlyIncome =
      monthKeys.length > 0 ? totalWithdrawals / monthKeys.length : 0;

    // Withdrawal firms
    const wdByFirm: Record<string, number> = {};
    data.withdrawals.forEach((w) => {
      wdByFirm[w.firm] = (wdByFirm[w.firm] || 0) + toNum(w.gross);
    });
    const topPayouts = Object.entries(wdByFirm)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    // Trading performance metrics
    const profitableMonths = monthlyChart.filter((m) => (m.income - m.costs) > 0).length;
    const totalMonths = monthlyChart.length;
    const winRateMonths = totalMonths > 0 ? (profitableMonths / totalMonths) * 100 : 0;
    let streak = 0;
    for (let i = monthlyChart.length - 1; i >= 0; i--) {
      if (monthlyChart[i].income > 0) streak++;
      else break;
    }
    const bestMonthIncome = [...monthlyChart].sort((a, b) => b.income - a.income)[0]?.income ?? 0;

    // Sparkline data series
    const pnlSparkData = pnlChart.map((d) => d.pnl);
    const incomeSparkData = monthlyChart.map((d) => d.income);
    const netSparkData = monthlyChart.map((d) => d.income - d.costs);

    return {
      netPnL, totalWithdrawals, totalExpenses, margin, portfolioValue,
      portfolioGain, investVal, t212Val, totalDebt, monthlyDebtPayments,
      fundedAccs, challengeAccs, breachedAccs, activeAccs, fundedAccountPnL,
      monthlySubs, monthlyChart, pnlChart, topFirms, firmMax,
      recentTx, avgMonthlyIncome, topPayouts,
      allDebts, investCost,
      profitableMonths, totalMonths, winRateMonths, streak, bestMonthIncome,
      pnlSparkData, incomeSparkData, netSparkData,
    };
  }, [data, heroPeriod]);

  // ── Time strings ──────────────────────────────────────────────────────────────
  const timeStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="space-y-5 w-full"
      variants={container}
      initial={false}
      animate="visible"
    >
      {/* ── PAGE HEADER ───────────────────────────────────────────────────────── */}
      <motion.div variants={item}>
        {/* Page header */}
        <div className="mb-6">
          <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>
            Dashboard
          </div>
          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="page-title">Portfolio Overview</h1>
            <div
              className="flex items-center gap-2.5 px-4 py-2 rounded-xl flex-shrink-0"
              style={{
                background: "rgba(var(--surface-rgb),0.04)",
                border: "1px solid rgba(var(--border-rgb),0.08)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{
                  background: ACCENT,
                  boxShadow: `0 0 8px ${ACCENT}`,
                  animation: "pulseDot 2s ease-in-out infinite",
                }}
              />
              <Clock size={11} className="text-tx-3" />
              <span className="text-tx-2 text-xs">{dateStr}</span>
              <span className="text-tx-4 text-xs">·</span>
              <span className="text-tx-1 text-xs font-mono tabular-nums font-semibold">
                {timeStr}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── HERO BANNER ───────────────────────────────────────────────────────── */}
      <motion.div variants={item} className="card-hero p-7 relative overflow-hidden" style={{ background: theme.dim, border: `1px solid ${theme.border}`, position: "relative", zIndex: 1 }}>
        {/* Decorative glow orbs */}
        <div
          className="pointer-events-none absolute -top-32 -right-20"
          style={{
            width: 400, height: 400, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-40"
          style={{
            width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,197,94,0.10) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute top-8 right-60"
          style={{
            width: 180, height: 180, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)",
          }}
        />

        {/* Main content */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-6">
          {/* Left: Net P&L */}
          <div>
            <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
              <p className="section-label" style={{ color: theme.accent }}>
                Net Trading P&L
              </p>
              {/* Period filter pills */}
              <div className="flex gap-1.5">
                {(["1W", "1M", "3M", "All"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setHeroPeriod(p)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
                    style={{
                      background: heroPeriod === p ? `${theme.accent}22` : "rgba(var(--surface-rgb),0.05)",
                      border: `1px solid ${heroPeriod === p ? theme.accent + "55" : "rgba(var(--border-rgb),0.08)"}`,
                      color: heroPeriod === p ? theme.accent : "var(--tx-4)",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div
              className="text-[40px] md:text-[56px] font-black tabular-nums leading-none truncate"
              style={{
                color: stats.netPnL >= 0 ? PROFIT : LOSS,
                letterSpacing: "-0.04em",
              }}
            >
              <AnimatedNumber value={stats.netPnL} prefix="£" decimals={2} />
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <TrendPill value={stats.margin} />
              {stats.portfolioGain !== 0 && (
                <TrendPill value={stats.investCost > 0 ? (stats.portfolioGain / stats.investCost) * 100 : 0} />
              )}
              {stats.totalDebt > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    color: LOSS,
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  <CreditCard size={8} />
                  {fmtGBP(stats.totalDebt)} debt
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: "rgba(20,184,166,0.12)",
                  color: ACCENT,
                  border: "1px solid rgba(20,184,166,0.2)",
                }}
              >
                <Activity size={8} />
                {fmtGBP(stats.portfolioValue)} portfolio
              </span>
              {stats.totalMonths > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: "rgba(59,130,246,0.12)", color: BLUE, border: "1px solid rgba(59,130,246,0.2)" }}
                >
                  <Target size={8} />
                  {stats.winRateMonths.toFixed(0)}% win rate
                </span>
              )}
              {stats.streak >= 2 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ background: "rgba(249,115,22,0.12)", color: ORANGE, border: "1px solid rgba(249,115,22,0.2)" }}
                >
                  <Flame size={8} />
                  {stats.streak}mo streak
                </span>
              )}
            </div>
          </div>

          {/* Right: account status pills */}
          <div className="flex flex-row gap-1.5 w-full md:w-auto">
            {[
              {
                label: "Funded",
                count: stats.fundedAccs.length,
                color: PROFIT,
                icon: <CheckCircle2 size={8} className="md:w-[13px] md:h-[13px]" />,
                onClick: () => navigate("/prop"),
              },
              {
                label: "Challenges",
                count: stats.challengeAccs.length,
                color: WARN,
                icon: <Target size={8} className="md:w-[13px] md:h-[13px]" />,
                onClick: () => navigate("/prop"),
              },
              {
                label: "Breached",
                count: stats.breachedAccs.length,
                color: LOSS,
                icon: <AlertCircle size={8} className="md:w-[13px] md:h-[13px]" />,
                onClick: () => navigate("/prop"),
              },
            ].map((p) => (
              <button
                key={p.label}
                onClick={p.onClick}
                className="flex-shrink-0 w-[calc(33.33%-4px)] text-center py-1.5 px-1 md:flex-1 md:py-3 md:px-4 rounded-xl cursor-pointer transition-all duration-200 active:scale-95 min-w-0"
                style={{
                  background: `${p.color}0d`,
                  border: `1px solid ${p.color}22`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${p.color}18`;
                  (e.currentTarget as HTMLButtonElement).style.border = `1px solid ${p.color}40`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = `${p.color}0d`;
                  (e.currentTarget as HTMLButtonElement).style.border = `1px solid ${p.color}22`;
                }}
              >
                <div className="flex justify-center mb-0.5 md:mb-1" style={{ color: p.color }}>
                  {p.icon}
                </div>
                <div
                  className="text-[18px] md:text-[32px] font-black leading-none tabular-nums"
                  style={{ color: p.color, letterSpacing: "-0.03em" }}
                >
                  {p.count}
                </div>
                <div
                  className="text-[8px] md:text-[10px] uppercase tracking-[0.1em] mt-0.5 md:mt-1 font-bold leading-tight"
                  style={{ color: `${p.color}88` }}
                >
                  {p.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cumulative P&L sparkline */}
        {stats.pnlChart.length > 1 && (() => {
          const W = 1000, H = 56;
          const values = stats.pnlChart.map((d) => d.pnl);
          const min = Math.min(0, ...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          const pts = values.map((v, i) => [
            (i / (values.length - 1)) * W,
            H - 18 - ((v - min) / range) * (H - 28),
          ]);
          const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
          const area = `${line} L ${W} ${H} L 0 ${H} Z`;
          const isUp = values[values.length - 1] >= (values[0] ?? 0);
          const col = isUp ? PROFIT : LOSS;
          const lastPt = pts[pts.length - 1];
          return (
            <div className="relative z-10 mt-5 -mb-1">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-tx-4">Cumulative P&L</span>
                <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: col }}>
                  {values[values.length - 1] >= 0 ? "+" : ""}{fmtGBP(values[values.length - 1])}
                </span>
              </div>
              <div className="relative">
              <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: "block" }}>
                <defs>
                  <linearGradient id="heroSparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={col} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={col} stopOpacity="0.01" />
                  </linearGradient>
                  <filter id="heroGlow">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {/* Zero line */}
                {min < 0 && (
                  <line
                    x1="0" y1={(H - 18 - ((0 - min) / range) * (H - 28)).toFixed(1)}
                    x2={W} y2={(H - 18 - ((0 - min) / range) * (H - 28)).toFixed(1)}
                    stroke="rgba(var(--surface-rgb),0.1)" strokeWidth="1" strokeDasharray="4 4"
                  />
                )}
                <path d={area} fill="url(#heroSparkGrad)" />
                <path d={line} fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                {/* Data point ticks */}
                {pts.map(([x, y], i) => (
                  <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={col} opacity="0.45" />
                ))}
                {/* Terminal dot (highlighted) */}
                <circle cx={lastPt[0].toFixed(1)} cy={lastPt[1].toFixed(1)} r="4" fill={col} filter="url(#heroGlow)" />
                <circle cx={lastPt[0].toFixed(1)} cy={lastPt[1].toFixed(1)} r="2" fill="var(--bg-base)" />
              </svg>
              {/* Month labels — positioned absolutely using percentage-based left */}
              <div className="flex justify-between mt-0.5 px-0">
                {stats.pnlChart.map((d, i) => (
                  <span key={i} className="text-[10px] font-mono tabular-nums" style={{ color: "var(--tx-4)" }}>
                    {d.month}
                  </span>
                ))}
              </div>
              </div>
            </div>
          );
        })()}

        {/* Divider */}
        <Separator className="my-5 relative z-10 opacity-60" />

        {/* 4-stat bottom row */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Prop Income",  value: stats.totalWithdrawals, color: PROFIT,  icon: <ArrowDownToLine size={13} />, path: "/prop",    delay: 0 },
            { label: "Firm Costs",   value: stats.totalExpenses,   color: LOSS,    icon: <Receipt size={13} />,          path: "/expenses",  delay: 60 },
            { label: "Portfolio",    value: stats.portfolioValue,  color: PURPLE,  icon: <BarChart3 size={13} />,        path: "/investments", delay: 120 },
            { label: "Monthly Burn", value: stats.monthlySubs,     color: WARN,    icon: <Zap size={13} />,              path: "/expenses",   delay: 180 },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => navigate(s.path)}
              className="text-left rounded-xl p-3.5 transition-all duration-200 hover:scale-[1.02] hover:brightness-110 cursor-pointer animate-fade-up"
              style={{
                background: `${s.color}14`,
                border: `1px solid ${s.color}25`,
                animationDelay: `${s.delay}ms`,
                animationFillMode: "both",
              }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <div className="p-1.5 rounded-lg flex-shrink-0" style={{ background: `${s.color}18`, color: s.color }}>
                  {s.icon}
                </div>
                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: s.color }}>{s.label}</p>
              </div>
              <p className="text-[17px] font-black font-mono tabular-nums leading-none" style={{ color: s.color }}>
                {fmtGBP(s.value)}
              </p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── MAIN 2-COL LAYOUT ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">
      <div className="space-y-5">

      {/* ── KPI GRID — original layout restored on all breakpoints ─ */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Net P&L"
          value={stats.netPnL}
          color={stats.netPnL >= 0 ? PROFIT : LOSS}
          icon={<TrendingUp size={15} />}
          sub={`from ${data.withdrawals.length} payouts`}
          badge={<TrendPill value={stats.margin} />}
          sparkData={stats.pnlSparkData}
        />
        <KPICard
          label="Avg Monthly Income"
          value={stats.avgMonthlyIncome}
          color={isBW ? "#374151" : BLUE}
          icon={<Wallet size={15} />}
          sub="per active month"
          sparkData={stats.incomeSparkData}
        />
        <KPICard
          label="Portfolio"
          value={stats.portfolioValue}
          color={PURPLE}
          icon={<BarChart3 size={15} />}
          sub={`${data.investments.length} holdings + T212`}
          badge={
            stats.portfolioGain !== 0 ? (
              <TrendPill
                value={stats.investCost > 0 ? (stats.portfolioGain / stats.investCost) * 100 : 0}
              />
            ) : undefined
          }
          onClick={() => navigate("/investments")}
        />
        <KPICard
          label="Total Debt"
          value={stats.totalDebt}
          color={stats.totalDebt > 0 ? LOSS : PROFIT}
          icon={<CreditCard size={15} />}
          sub={`${stats.allDebts.length} account${stats.allDebts.length !== 1 ? "s" : ""} · £${stats.monthlyDebtPayments.toFixed(0)}/mo`}
          onClick={() => navigate("/debt")}
        />
      </motion.div>

      {/* ── CHARTS ROW ────────────────────────────────────────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Monthly Breakdown — custom grouped bar chart */}
        <Card className="md:col-span-3 flex flex-col">
          <CardContent className="pt-5 flex flex-col flex-1">
            {stats.monthlyChart.length > 0 ? ((isBW: boolean) => {
              const bgIncome = isBW ? "rgba(0,100,50,0.08)" : "rgba(34,197,94,0.07)";
              const bgCost   = isBW ? "rgba(100,0,0,0.06)" : "rgba(239,68,68,0.07)";
              const bdrIncome = isBW ? "rgba(0,100,50,0.18)" : "rgba(34,197,94,0.18)";
              const bdrCost   = isBW ? "rgba(100,0,0,0.16)" : "rgba(239,68,68,0.18)";
              const gradIncome = isBW ? "linear-gradient(90deg,#3d8a5a,#22c55e)" : "linear-gradient(90deg,#3d8a5a,#22c55e)";
              const gradCost   = isBW ? "linear-gradient(90deg,#b84040,#dc4040)" : "linear-gradient(90deg,#b84040,#dc4040)";
              const maxVal = Math.max(...stats.monthlyChart.map((m) => Math.max(m.income, m.costs)), 1);
              const totalIncome = stats.monthlyChart.reduce((s, m) => s + m.income, 0);
              const totalCosts  = stats.monthlyChart.reduce((s, m) => s + m.costs,  0);
              const totalNet    = totalIncome - totalCosts;
              const selIdx = selectedChartMonth;
              const selM   = selIdx !== null ? (stats.monthlyChart[selIdx] ?? null) : null;

              return (
                <div className="flex flex-col flex-1 gap-0">
                  {/* ── Aggregate summary strip ── */}
                  {/* Mobile: compact single-row strip */}
                  <div className="flex md:hidden items-center gap-1 mb-4 rounded-lg overflow-hidden" style={{ border: `1px solid rgba(var(--border-rgb),0.1)` }}>
                    {[
                      { label: "Income", value: fmtGBP(totalIncome), color: PROFIT, bg: bgIncome },
                      { label: "Costs",  value: fmtGBP(totalCosts),  color: LOSS,   bg: bgCost },
                      { label: "Net",    value: `${totalNet >= 0 ? "+" : ""}${fmtGBP(totalNet)}`, color: totalNet >= 0 ? PROFIT : LOSS, bg: totalNet >= 0 ? bgIncome : bgCost },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className="flex-1 text-center py-2 px-1.5" style={{ background: bg }}>
                        <p className="text-[8px] font-bold uppercase tracking-wider text-tx-4">{label}</p>
                        <p className="text-[11px] font-black tabular-nums leading-tight mt-0.5" style={{ color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Desktop: full cards */}
                  <div className="hidden md:grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: "Total Income", value: fmtGBP(totalIncome), color: PROFIT, bg: bgIncome,  border: bdrIncome },
                      { label: "Total Costs",  value: fmtGBP(totalCosts),  color: LOSS,   bg: bgCost,   border: bdrCost   },
                      { label: "Net P&L",      value: `${totalNet >= 0 ? "+" : ""}${fmtGBP(totalNet)}`, color: totalNet >= 0 ? PROFIT : LOSS, bg: totalNet >= 0 ? bgIncome : bgCost, border: totalNet >= 0 ? bdrIncome : bdrCost },
                    ].map(({ label, value, color, bg, border }) => (
                      <div key={label} className="rounded-xl px-3.5 py-2.5" style={{ background: bg, border: `1px solid ${border}` }}>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-tx-4 mb-1">{label}</p>
                        <p className="text-base font-black tabular-nums leading-none" style={{ color }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── Custom grouped bar chart ── */}
                  <div className="flex items-end gap-1 flex-1 min-h-[100px] px-1 mb-3">
                    {stats.monthlyChart.map((m, idx) => {
                      const isSelected = selIdx !== null && selIdx === idx;
                      const isOther    = selIdx !== null && !isSelected;
                      const incH = Math.max(4, (m.income / maxVal) * 110);
                      const cstH = Math.max(4, (m.costs  / maxVal) * 110);
                      const net  = m.net;
                      const isPos = net >= 0;

                      return (
                        <button
                          key={m.month}
                          onClick={() => setSelectedChartMonth(isSelected ? null : idx)}
                          className="flex-1 flex flex-col items-center gap-0 group cursor-pointer"
                          style={{ transition: "opacity 0.2s", opacity: isOther ? 0.4 : 1 }}
                        >
                          {/* Net label */}
                          <span
                            className="text-[10px] font-bold tabular-nums mb-1 leading-none transition-opacity"
                            style={{
                              color: isPos ? PROFIT : LOSS,
                              opacity: isSelected ? 1 : 0.7,
                              fontFamily: "JetBrains Mono",
                            }}
                          >
                            {net >= 1000 ? `£${(net/1000).toFixed(1)}k` : net <= -1000 ? `-£${(Math.abs(net)/1000).toFixed(1)}k` : `£${Math.round(net)}`}
                          </span>
                          {/* Bars */}
                          <div className="flex items-end gap-0.5 w-full justify-center" style={{ height: 112 }}>
                            <div
                              className="rounded-t-sm transition-all duration-500"
                              style={{
                                flex: 1,
                                height: `${incH}px`,
                                background: isSelected
                                  ? "linear-gradient(180deg, #4a9a7a, #3d8a5a)"
                                  : "linear-gradient(180deg, rgba(74,154,122,0.4), rgba(61,138,90,0.27))",
                                boxShadow: isSelected ? "0 0 8px rgba(34,197,94,0.15)" : "none",
                              }}
                            />
                            <div
                              className="rounded-t-sm transition-all duration-500"
                              style={{
                                flex: 1,
                                height: `${cstH}px`,
                                background: isSelected
                                  ? "linear-gradient(180deg, #d07070, #b84040)"
                                  : "linear-gradient(180deg, rgba(184,64,64,0.33), rgba(184,64,64,0.27))",
                                boxShadow: isSelected ? "0 0 8px rgba(239,68,68,0.15)" : "none",
                              }}
                            />
                          </div>
                          {/* Month label */}
                          <span
                            className="text-[10px] mt-1.5 font-mono leading-none text-center whitespace-nowrap w-full"
                            style={{ color: isSelected ? "var(--tx-1)" : "var(--tx-4)", fontWeight: isSelected ? 700 : 400 }}
                          >
                            {m.month}
                          </span>
                          {/* Selection dot */}
                          <div
                            className="mt-1 rounded-full transition-all duration-200"
                            style={{
                              width: isSelected ? 14 : 4,
                              height: 3,
                              background: isSelected ? (isPos ? PROFIT : LOSS) : "transparent",
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 text-[10px] text-tx-4 mb-4 px-1">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: PROFIT }} />Income</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: LOSS }} />Costs</span>
                    <span className="text-tx-4 ml-auto text-[10px]">Click a bar to inspect</span>
                  </div>

                  {/* ── Selected month detail ── */}
                  {selM && (() => {
                    const net = selM.income - selM.costs;
                    const isPos = net >= 0;
                    const roi = selM.costs > 0 ? ((selM.income - selM.costs) / selM.costs) * 100 : null;
                    const incPct = selM.income > 0 ? Math.min(100, (selM.income / (selM.income + selM.costs)) * 100) : 0;
                    const monthTrades = (data.tradeJournal ?? []).filter((t) => t.date.startsWith(selM.monthKey));
                    const tradePnL = monthTrades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0);
                    const tradeWins = monthTrades.filter((t) => (t.pnl - (t.fees ?? 0)) > 0).length;

                    return (
                      <div
                        className="rounded-xl overflow-hidden"
                        style={{
                          border: `1px solid ${isPos ? (isBW ? "rgba(0,100,50,0.2)" : "rgba(34,197,94,0.2)") : (isBW ? "rgba(100,0,0,0.2)" : "rgba(239,68,68,0.2)")}`,
                          background: isPos ? (isBW ? "rgba(0,100,50,0.06)" : "rgba(34,197,94,0.04)") : (isBW ? "rgba(100,0,0,0.05)" : "rgba(239,68,68,0.04)"),
                        }}
                      >
                        {/* Header bar */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(var(--border-rgb),0.09)" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: isPos ? PROFIT : LOSS }} />
                            <span className="text-xs font-bold text-tx-1">{selM.month}</span>
                            {roi !== null && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{
                                background: isPos ? (isBW ? "rgba(0,100,50,0.12)" : "rgba(34,197,94,0.12)") : (isBW ? "rgba(100,0,0,0.1)" : "rgba(239,68,68,0.12)"),
                                color: isPos ? PROFIT : LOSS,
                                }}
                              >
                                {roi >= 0 ? "+" : ""}{roi.toFixed(0)}% ROI
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedChartMonth(null)}
                            className="text-[10px] text-tx-4 hover:text-tx-2 transition-colors"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Metrics row */}
                        <div className="grid grid-cols-1 divide-y divide-white/[0.06] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                          <div className="px-4 py-3">
                            <p className="text-[10px] text-tx-4 uppercase tracking-wider mb-1">Income</p>
                            <p className="text-lg font-black tabular-nums text-profit leading-none">{fmtGBP(selM.income)}</p>
                          </div>
                          <div className="px-4 py-3 border-l border-[rgba(var(--border-rgb),0.06)]">
                            <p className="text-[10px] text-tx-4 uppercase tracking-wider mb-1">Costs</p>
                            <p className="text-lg font-black tabular-nums text-loss leading-none">{fmtGBP(selM.costs)}</p>
                          </div>
                          <div className="px-4 py-3 border-l border-[rgba(var(--border-rgb),0.06)]">
                            <p className="text-[10px] text-tx-4 uppercase tracking-wider mb-1">Net</p>
                            <p className="text-lg font-black tabular-nums leading-none" style={{ color: isPos ? PROFIT : LOSS }}>
                              {isPos ? "+" : ""}{fmtGBP(net)}
                            </p>
                          </div>
                        </div>

                        {/* Income vs costs split bar */}
                        <div className="px-4 pb-3">
                          <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                            <div className="h-full transition-all duration-700" style={{ width: `${incPct}%`, background: gradIncome }} />
                            <div className="h-full flex-1" style={{ background: gradCost }} />
                          </div>
                          <div className="flex justify-between mt-1.5 text-[10px] text-tx-4">
                            <span>{incPct.toFixed(0)}% income</span>
                            <span>{(100 - incPct).toFixed(0)}% costs</span>
                          </div>
                          {/* Trade stats */}
                          {monthTrades.length > 0 && (
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[rgba(var(--border-rgb),0.05)] text-[10px]">
                              <span className="text-tx-4">{monthTrades.length} trades logged</span>
                              <span className="text-tx-4">·</span>
                              <span style={{ color: tradePnL >= 0 ? PROFIT : LOSS }}>{tradePnL >= 0 ? "+" : ""}{fmtUSD(tradePnL)} P&L</span>
                              <span className="text-tx-4">·</span>
                              <span className="text-tx-3">{Math.round((tradeWins / monthTrades.length) * 100)}% WR</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })(isBW) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <BarChart3 size={32} className="text-tx-4" />
                <p className="text-sm text-tx-3">No data yet</p>
                <p className="text-xs text-tx-4">Add withdrawals and expenses to see your breakdown</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Firm spending breakdown */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardDescription>Cost Breakdown</CardDescription>
            <CardTitle className="mt-1">Spending by Firm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.topFirms.map(([name, val], i) => {
                const pct = (val / stats.firmMax) * 100;
                const colors = [LOSS, ORANGE, WARN, ACCENT, PURPLE, BLUE];
                const col = colors[i % colors.length];
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-tx-2 truncate mr-3 flex-1">
                        {name}
                      </span>
                      <span className="text-xs font-mono font-bold text-tx-1 flex-shrink-0">
                        {fmtGBP(val)}
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      className="h-1.5"
                      indicatorStyle={{ background: col }}
                    />
                    <p className="text-[10px] text-tx-4 mt-1 text-right">
                      {pct.toFixed(0)}% of top spend
                    </p>
                  </div>
                );
              })}
              {stats.topFirms.length === 0 && (
                <p className="text-xs text-tx-3 py-8 text-center">
                  No expense data yet
                </p>
              )}
            </div>

            {stats.topFirms.length > 0 && (
              <>
                <Separator className="mt-4 mb-3" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-tx-3">
                    Total costs
                  </span>
                  <span className="text-sm font-black font-mono text-loss">
                    {fmtGBP(stats.totalExpenses)}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── ACCOUNTS + ACTIVITY ───────────────────────────────────────────────── */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active prop accounts */}
        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>Prop Trading</CardDescription>
                <CardTitle className="mt-1">Active Accounts</CardTitle>
              </div>
              <button
                onClick={() => navigate("/prop")}
                className="btn-ghost btn-sm flex items-center gap-1.5"
              >
                View all
                <ChevronRight size={12} />
              </button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col flex-1">
            <div className="flex-1">
            {stats.activeAccs.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-2">
                <Target size={28} className="text-tx-4" />
                <p className="text-sm text-tx-3">No active accounts</p>
                <p className="text-xs text-tx-4">
                  Go to Prop Accounts to add funded accounts
                </p>
              </div>
            ) : (
              <>
                {/* Mobile: compact horizontal scroll pills */}
                <div className="md:hidden overflow-x-auto -mx-1 px-1 pb-2">
                  <div className="flex flex-nowrap gap-2" style={{ minWidth: "max-content" }}>
                    {stats.activeAccs.map((acc) => {
                      const isFunded = ["funded", "Funded"].includes(acc.status);
                      const pillColor = isFunded ? PROFIT : WARN;
                      return (
                        <button
                          key={acc.id}
                          onClick={() => navigate("/prop")}
                          className="flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap transition-all duration-200"
                          style={{
                            background: `${pillColor}0c`,
                            border: `1px solid ${pillColor}22`,
                          }}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: pillColor }}
                          />
                          <span className="text-[11px] font-semibold text-tx-2 truncate max-w-[100px]">
                            {acc.name || acc.firm}
                          </span>
                          <Badge variant={isFunded ? "funded" : "challenge"} className="text-[8px] px-1.5 py-0">
                            {acc.status}
                          </Badge>
                          <span className="text-[11px] font-black tabular-nums font-mono" style={{ color: pillColor }}>
                            {fmtUSD(toNum(acc.balance))}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Desktop: full card grid */}
                <div className="hidden md:grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {stats.activeAccs.map((acc) => (
                    <AccountTile
                      key={acc.id}
                      firm={acc.firm}
                      name={acc.name}
                      status={acc.status}
                      balance={toNum(acc.balance)}
                      type={acc.type}
                      onClick={() => navigate("/prop")}
                    />
                  ))}
                </div>
              </>
            )}
            </div>

            {/* Payout summary */}
            {stats.topPayouts.length > 0 && (
              <>
                <Separator className="mt-4 mb-3" />
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-tx-3">
                    Top Payout Sources
                  </p>
                  <span className="text-xs font-black font-mono text-profit">
                    {fmtGBP(stats.topPayouts.reduce((s, [, a]) => s + a, 0))}
                  </span>
                </div>
                <div className="space-y-3">
                  {(() => {
                    const maxAmt = stats.topPayouts[0]?.[1] ?? 1;
                    const totalAmt = stats.topPayouts.reduce((s, [, a]) => s + a, 0);
                    const rankBg = isBW
                      ? ["rgba(0,80,40,0.16)", "rgba(0,80,40,0.10)", "rgba(0,80,40,0.07)", "rgba(0,80,40,0.05)"]
                      : ["rgba(34,197,94,0.18)", "rgba(34,197,94,0.12)", "rgba(34,197,94,0.09)", "rgba(34,197,94,0.07)"];
                    const barColors = isBW
                      ? ["linear-gradient(90deg,#3d8a5a,#6dbf80)", "linear-gradient(90deg,#5aadaa,#8bcfcc)", "linear-gradient(90deg,#7a80b4,#9b8ec2)", "linear-gradient(90deg,#c49060,#d4a84a)"]
                      : ["linear-gradient(90deg,#3d8a5a,#4a9a7a)", "linear-gradient(90deg,#3d8a5a,#22c55e)", "linear-gradient(90deg,#2d7a4a,#3d8a5a)", "linear-gradient(90deg,#1d6a3a,#2d7a4a)"];
                    return stats.topPayouts.map(([firm, amount], i) => {
                      const pct = (amount / maxAmt) * 100;
                      const sharePct = totalAmt > 0 ? (amount / totalAmt) * 100 : 0;
                      return (
                        <div key={firm}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div
                              className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0"
                              style={{ background: rankBg[i], color: PROFIT }}
                            >
                              {i + 1}
                            </div>
                            <span className="text-xs font-medium text-tx-2 flex-1 min-w-0 truncate">{firm}</span>
                            <span className="text-[10px] text-tx-4 flex-shrink-0 tabular-nums">{sharePct.toFixed(0)}%</span>
                            <span className="text-xs font-black font-mono text-profit flex-shrink-0 tabular-nums">
                              {fmtGBP(amount)}
                            </span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: "rgba(34,197,94,0.08)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: barColors[i] }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="md:col-span-2 hidden md:block">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardDescription>Latest</CardDescription>
                <CardTitle className="mt-1">Activity Feed</CardTitle>
              </div>
              <button
                onClick={() => navigate("/expenses")}
                className="btn-ghost btn-sm"
              >
                All expenses
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {stats.recentTx.map((tx, i) => {
                const txColors = [LOSS, ORANGE, WARN, BLUE, PURPLE, ACCENT];
                const dotColor = txColors[i % txColors.length];
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-accent-subtle transition-colors group"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}80` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <p className="text-[10px] text-tx-4 font-mono">{fmtShortDate(tx.date)}</p>
                        {tx.cat && (
                          <span
                            className="text-[10px] px-1 py-px rounded font-bold uppercase tracking-wide"
                            style={{ background: `${dotColor}18`, color: dotColor }}
                          >
                            {tx.cat}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-tx-1 truncate">
                        {tx.description}
                      </p>
                    </div>
                    <p className="text-sm font-black font-mono tabular-nums text-loss flex-shrink-0">
                      -{fmtGBP(toNum(tx.amount))}
                    </p>
                  </div>
                );
              })}
              {stats.recentTx.length === 0 && (
                <div className="py-8 text-center">
                  <Receipt size={24} className="mx-auto mb-2 text-tx-4" />
                  <p className="text-xs text-tx-3">No expenses yet</p>
                </div>
              )}
            </div>

            {stats.recentTx.length > 0 && (
              <>
                <Separator className="mt-4 mb-3" />
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-tx-3">
                      Total spent
                    </span>
                    <span className="text-sm font-black font-mono text-loss">
                      {fmtGBP(stats.totalExpenses)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-tx-3">
                      Monthly subs
                    </span>
                    <span className="text-sm font-black font-mono text-warn">
                      {fmtGBP(stats.monthlySubs)}/mo
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── WEALTH TARGETS ────────────────────────────────────────────────────── */}
      {(
        <div className="hidden md:block">
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardDescription>Financial Goals</CardDescription>
                  <CardTitle className="mt-1">Wealth Targets</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="flex items-center gap-1.5 text-[11px] font-medium text-tx-3 hover:text-tx-1 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[rgba(var(--surface-rgb),0.05)]"
                    onClick={openAddTarget}
                  >
                    <Plus size={13} /> Add
                  </button>
                  {data.wealthTargets && data.wealthTargets.length > 0 && (
                    <button
                      className="flex items-center gap-1.5 text-[11px] font-medium text-tx-3 hover:text-tx-1 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-[rgba(var(--surface-rgb),0.05)]"
                      onClick={() => toggleSection("targets")}
                    >
                      {expandedSection === "targets" ? (
                        <><ChevronUp size={13} /> Collapse</>
                      ) : (
                        <><ChevronDown size={13} /> Expand</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!data.wealthTargets || data.wealthTargets.length === 0 ? (
                /* ── Empty state ── */
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Target size={28} className="opacity-30 text-tx-3" />
                  <p className="text-[11px] text-tx-4 text-center">No targets yet. Click <strong className="text-tx-3">Add</strong> to create your first goal.</p>
                </div>
              ) : expandedSection !== "targets" ? (
                /* ── Compact summary view ── */
                <div className="flex flex-col gap-2.5">
                  {data.wealthTargets.map((t) => {
                    const pct = Math.min(100, t.target > 0 ? (t.saved / t.target) * 100 : 0);
                    return (
                      <div key={t.id} className="flex items-center gap-3 group">
                        <span className="text-base leading-none w-5 shrink-0 text-center">{t.emoji}</span>
                        <p className="text-[11px] text-tx-2 font-medium truncate flex-1 min-w-0">{t.name}</p>
                        <div className="w-28 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: pct >= 100 ? PROFIT : `linear-gradient(90deg, ${BLUE}, ${PURPLE})`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-tx-3 font-mono tabular-nums w-9 text-right shrink-0">
                          {pct.toFixed(0)}%
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-tx-4 shrink-0">
                          {fmtGBP(t.saved)}
                        </span>
                        <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openEditTarget(t.id)} className="p-1 rounded hover:bg-[rgba(var(--surface-rgb),0.10)] text-tx-4 hover:text-tx-2 transition-colors">
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => deleteTarget(t.id)} className="p-1 rounded hover:bg-red-500/15 text-tx-4 hover:text-red-400 transition-colors">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {(() => {
                    const totalSaved  = data.wealthTargets.reduce((s, t) => s + t.saved,  0);
                    const totalTarget = data.wealthTargets.reduce((s, t) => s + t.target, 0);
                    const overallPct  = totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0;
                    const onTrack     = data.wealthTargets.filter(t => (t.saved / t.target) >= 0.25).length;
                    return (
                      <div className="mt-1 pt-2 border-t border-[rgba(var(--border-rgb),0.05)] flex items-center justify-between">
                        <span className="text-[10px] text-tx-4 uppercase tracking-wider">
                          {onTrack} of {data.wealthTargets.length} goals on track
                        </span>
                        <span className="text-[10px] text-tx-3 font-mono">
                          {fmtGBP(totalSaved)} <span className="text-tx-4">of</span> {fmtGBP(totalTarget)} · <span style={{ color: overallPct >= 50 ? PROFIT : WARN }}>{overallPct.toFixed(0)}%</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* ── Expanded full card grid ── */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.wealthTargets.map((t) => {
                    const pct = Math.min(100, t.target > 0 ? (t.saved / t.target) * 100 : 0);
                    const remaining = t.target - t.saved;
                    const monthsLeft = t.monthly > 0 ? Math.ceil(remaining / t.monthly) : null;
                    return (
                      <div
                        key={t.id}
                        className="rounded-xl p-4 group relative"
                        style={{
                          background: "rgba(var(--surface-rgb),0.03)",
                          border: "1px solid rgba(var(--border-rgb),0.09)",
                        }}
                      >
                        <div className="absolute top-2.5 right-2.5 flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditTarget(t.id)} className="p-1.5 rounded-lg hover:bg-[rgba(var(--surface-rgb),0.10)] text-tx-4 hover:text-tx-2 transition-colors">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => deleteTarget(t.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-tx-4 hover:text-red-400 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-2xl leading-none">{t.emoji}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-tx-1 truncate">{t.name}</p>
                            <p className="text-[10px] text-tx-3 line-clamp-2">{t.desc}</p>
                          </div>
                        </div>
                        <Progress
                          value={pct}
                          className="h-1.5 mb-2"
                          indicatorStyle={{
                            background: pct >= 100
                              ? PROFIT
                              : `linear-gradient(90deg, ${ACCENT}, ${PURPLE})`,
                          }}
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-tx-3 font-mono">
                            {fmtGBP(t.saved)} / {fmtGBP(t.target)}
                          </span>
                          <span
                            className="text-[10px] font-bold"
                            style={{ color: pct >= 100 ? PROFIT : ACCENT }}
                          >
                            {pct.toFixed(0)}%
                          </span>
                        </div>
                        {monthsLeft !== null && monthsLeft > 0 && (
                          <p className="text-[10px] text-tx-4 mt-1">
                            ~{monthsLeft} months at {fmtGBP(t.monthly)}/mo
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        </div>
      )}

      {/* ── ACTIVE SUBSCRIPTIONS ─────────────────────────────────────────────── */}
      {data.subscriptions.filter(s => !s.cancelled).length > 0 && (
        <motion.div variants={item}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Subscriptions</CardTitle>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-tx-4 mt-1 block">Active</span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="px-3 py-1.5 rounded-xl text-xs font-bold font-mono"
                    style={{
                      background: "rgba(245,158,11,0.12)",
                      color: WARN,
                      border: "1px solid rgba(245,158,11,0.2)",
                    }}
                  >
                    {fmtGBP(stats.monthlySubs)}/mo
                  </div>
                  <button
                    onClick={() => navigate("/investments")}
                    className="btn-ghost btn-sm flex items-center gap-1.5"
                  >
                    View all
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data.subscriptions.filter(sub => !sub.cancelled).map(sub => {
                  const monthly =
                    sub.frequency === "monthly"
                      ? sub.amount
                      : sub.frequency === "yearly"
                      ? sub.amount / 12
                      : (sub.amount * 52) / 12;
                  const freqColors: Record<string, string> = {
                    monthly: WARN,
                    yearly: BLUE,
                    weekly: ORANGE,
                  };
                  const col = freqColors[sub.frequency] ?? WARN;
                  return (
                    <div
                      key={sub.id}
                      className="relative flex flex-col gap-1 px-3 py-2.5 rounded-xl overflow-hidden"
                      style={{
                        background: `${col}08`,
                        border: `1px solid ${col}18`,
                      }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, ${col}60, transparent)` }} />
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-bold text-tx-1 truncate">{sub.name}</p>
                        <span
                          className="text-[10px] px-1 py-px rounded font-bold uppercase shrink-0"
                          style={{ background: `${col}20`, color: col }}
                        >
                          {sub.frequency.slice(0, 2)}
                        </span>
                      </div>
                      <p className="text-sm font-black font-mono tabular-nums" style={{ color: col }}>
                        {fmtGBP(monthly)}<span className="text-[10px] font-medium text-tx-4">/mo</span>
                      </p>
                    </div>
                  );
                })}
              </div>
              {/* Cancelled - desktop only */}
              {data.subscriptions.filter(s => s.cancelled).length > 0 && (
                <>
                  <div className="hidden md:flex items-center gap-2 mt-4 mb-2">
                    <div className="flex-1 h-px bg-[rgba(var(--border-rgb),0.06)]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-tx-4">Cancelled</span>
                    <div className="flex-1 h-px bg-[rgba(var(--border-rgb),0.06)]" />
                  </div>
                  <div className="hidden lg:grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {data.subscriptions.filter(sub => sub.cancelled).map(sub => {
                      const monthly =
                        sub.frequency === "monthly"
                          ? sub.amount
                          : sub.frequency === "yearly"
                          ? sub.amount / 12
                          : (sub.amount * 52) / 12;
                      return (
                        <div
                          key={sub.id}
                          className="relative flex flex-col gap-1 px-3 py-2.5 rounded-xl overflow-hidden"
                          style={{
                            background: "rgba(107,114,128,0.06)",
                            border: "1px solid rgba(107,114,128,0.15)",
                            opacity: 0.5,
                          }}
                        >
                          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "rgba(107,114,128,0.3)" }} />
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-xs font-bold text-tx-1 truncate line-through">{sub.name}</p>
                            <span className="text-[10px] px-1 py-px rounded font-bold uppercase shrink-0 bg-[rgba(var(--surface-rgb),0.06)] text-tx-4">
                              Cancelled
                            </span>
                          </div>
                          {sub.cancelledAt && (
                            <p className="text-[10px] text-tx-4">{sub.cancelledAt}</p>
                          )}
                          <p className="text-sm font-black font-mono tabular-nums" style={{ color: "#6b7280" }}>
                            {fmtGBP(monthly)}<span className="text-[10px] font-medium text-tx-4">/mo</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── MARKET SESSIONS ───────────────────────────────────────────────────── */}
      <motion.div variants={item} className="hidden md:block">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle>Trading Sessions</CardTitle>
                  <p className="text-[10px] text-tx-4 mt-1">{localTz}</p>
                </div>
              </div>

              {/* Countdown strip */}
              {activeSession ? (
                <div
                  className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-2 rounded-xl text-xs"
                  style={{
                    background: `${activeSession.color}0d`,
                    border: `1px solid ${activeSession.color}28`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{
                      background: activeSession.color,
                      boxShadow: `0 0 8px ${activeSession.color}`,
                      animation: "pulseDot 2s ease-in-out infinite",
                    }}
                  />
                  <span className="font-semibold" style={{ color: activeSession.color }}>
                    {activeSession.name}
                  </span>
                  <span className="text-tx-3">·</span>
                  <span className="font-mono font-bold text-tx-1">
                    {sessionCountdown(activeSession, now)}
                  </span>
                  <span className="text-tx-3">remaining</span>
                </div>
              ) : (
                <div
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-tx-3"
                  style={{ background: "rgba(var(--surface-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
                >
                  No active session
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(() => {
                const nextSession = getNextMarketSession(now);
                return MARKET_SESSIONS.map((session) => {
                  const isActive = activeSession?.name === session.name;
                  const isNext = !isActive && nextSession?.name === session.name;
                  const progress = isActive ? sessionProgress(session, now) : 0;
                  const openLabel = !isActive ? opensInLabel(session, now) : "";
                  return (
                    <div
                      key={session.name}
                      className={cn("card p-4 transition-all duration-300 relative overflow-hidden", isActive ? "accent-top" : "")}
                      style={
                        isActive
                          ? {
                              border: `1px solid ${session.color}35`,
                              borderLeft: 0,
                              boxShadow: `0 0 28px ${session.color}0d, 0 4px 20px rgba(0,0,0,0.4)`,
                              background: `linear-gradient(160deg, ${session.color}09 0%, var(--bg-base) 60%)`,
                            }
                          : isNext
                            ? {
                                border: `1px solid rgba(var(--border-rgb),0.07)`,
                                borderLeft: 0,
                                background: "rgba(var(--surface-rgb),0.03)",
                                opacity: 0.6,
                              }
                            : {
                                borderLeft: 0,
                                background: "rgba(var(--surface-rgb),0.03)",
                                opacity: 0.4,
                              }
                      }
                    >
                      {/* Subtle color wash top line for inactive */}
                      {!isActive && (
                        <div
                          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                          style={{ background: `linear-gradient(90deg, ${session.color}40, transparent)` }}
                        />
                      )}

                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                background: session.color,
                                boxShadow: `0 0 8px ${session.color}cc`,
                                animation: "pulseDot 2s ease-in-out infinite",
                              }}
                            />
                          ) : (
                            <span
                              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                              style={{
                                background: session.color,
                                opacity: isNext ? 0.5 : 0.22,
                              }}
                            />
                          )}
                          <span
                            className="font-semibold text-sm"
                            style={{ color: isActive ? session.color : "var(--tx-4)" }}
                          >
                            {session.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isActive && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                              style={{
                                background: `${session.color}18`,
                                color: session.color,
                                border: `1px solid ${session.color}35`,
                              }}
                            >
                              Active
                            </span>
                          )}
                          {isNext && (
                            <span
                              className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                              style={{
                                background: `${session.color}12`,
                                color: `${session.color}cc`,
                                border: `1px solid ${session.color}28`,
                              }}
                            >
                              Next
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Time range */}
                      <div className="text-xs font-mono mb-1" style={{ color: isActive ? "var(--tx-3)" : "var(--tx-4)" }}>
                        {session.startET} &ndash; {session.endET}{" "}
                        <span style={{ color: "var(--tx-4)" }}>ET</span>
                      </div>

                      {/* Opens in label */}
                      {!isActive && (
                        <div className="mb-3">
                          <span
                            className="text-[10px] font-mono tabular-nums"
                            style={{ color: isNext ? "var(--tx-3)" : "var(--tx-4)" }}
                          >
                            {isNext ? `Opens in ${openLabel}` : `Opens in ${openLabel}`}
                          </span>
                        </div>
                      )}
                      {isActive && <div className="mb-3" />}

                      {/* Progress bar */}
                      <div className="space-y-1.5">
                        <div className="progress-track h-1.5">
                          <div
                            className="progress-fill transition-all duration-1000"
                            style={{
                              width: `${isActive ? progress : 0}%`,
                              background: isActive
                                ? `linear-gradient(90deg, ${session.color}60, ${session.color})`
                                : "transparent",
                            }}
                          />
                        </div>
                        {isActive && (
                          <div className="flex justify-between">
                            <span className="text-tx-4 text-[10px] font-mono">{session.startET}</span>
                            <span className="text-[10px] font-mono tabular-nums" style={{ color: session.color }}>
                              {progress.toFixed(1)}%
                            </span>
                            <span className="text-tx-4 text-[10px] font-mono">{session.endET}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      </div>{/* end left col */}

      {/* ── RIGHT SIDEBAR ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 xl:sticky xl:top-6">

        {/* Quick Actions */}
        <div
          className="card-secondary p-4 hidden md:block"
          style={{
            background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(168,85,247,0.04) 100%)",
            borderColor: "rgba(59,130,246,0.12)",
          }}
        >
          <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
            <Zap size={10} />Quick Actions
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { label: "Add Expense", path: "/expenses", color: LOSS, icon: <Receipt size={13} />,        action: "addExpense" },
              { label: "Add Account", path: "/prop",     color: BLUE, icon: <Target size={13} />,          action: "addAccount" },
              { label: "Log Payout",  path: "/prop",     color: PROFIT, icon: <ArrowDownToLine size={13} />, action: "logPayout" },
              { label: "View Tax",    path: "/tax",      color: WARN, icon: <PiggyBank size={13} /> },
            ].map(({ label, path, color, icon, action }) => (
              <button
                key={label}
                onClick={() =>
                  action
                    ? navigateToQuickAction(navigate, path, action as QuickAction)
                    : navigate(path)
                }
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-[10px] font-semibold transition-all duration-150 hover:scale-[1.04] active:scale-[0.97]"
                style={{
                  background: `${color}12`,
                  border: `1px solid ${color}22`,
                  color,
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Trading Performance */}
        {stats.totalMonths > 0 && (() => {
          const SIZE = 84, CX = 42, CY = 42;
          const R_OUTER = 36, R_INNER = 27;
          const circO = 2 * Math.PI * R_OUTER;
          const circI = 2 * Math.PI * R_INNER;
          const dashO = (stats.winRateMonths / 100) * circO;
          const profitablePct = stats.totalMonths > 0 ? (stats.profitableMonths / stats.totalMonths) * 100 : 0;
          const dashI = (profitablePct / 100) * circI;
          const ringColor = stats.winRateMonths >= 60 ? PROFIT : stats.winRateMonths >= 40 ? BLUE : WARN;
          const innerColor = profitablePct >= 60 ? "#4a9a7a" : profitablePct >= 40 ? "#5b8bbf" : "#d97706";
          const gradId = "perfGrad";
          return (
            <div
              className="card p-4"
              style={{ background: "linear-gradient(160deg, rgba(59,130,246,0.07) 0%, rgba(168,85,247,0.04) 50%, rgba(34,197,94,0.03) 100%)" }}
            >
              <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                <TrendingUp size={10} />Trading Performance
              </p>
              <div className="flex items-center gap-4">
                {/* Double ring */}
                <div className="relative shrink-0">
                  <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: "rotate(-90deg)" }}>
                    <defs>
                      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={ringColor} stopOpacity="0.7" />
                        <stop offset="100%" stopColor={ringColor} />
                      </linearGradient>
                    </defs>
                    {/* Outer track */}
                    <circle cx={CX} cy={CY} r={R_OUTER} fill="none" stroke="rgba(var(--surface-rgb),0.08)" strokeWidth="5.5" />
                    {/* Outer arc — win rate */}
                    <circle cx={CX} cy={CY} r={R_OUTER} fill="none"
                      stroke={`url(#${gradId})`} strokeWidth="5.5"
                      strokeDasharray={`${dashO} ${circO}`}
                      strokeLinecap="round"
                    />
                    {/* Inner track */}
                    <circle cx={CX} cy={CY} r={R_INNER} fill="none" stroke="rgba(var(--surface-rgb),0.08)" strokeWidth="4" />
                    {/* Inner arc — profitable months */}
                    <circle cx={CX} cy={CY} r={R_INNER} fill="none"
                      stroke={innerColor} strokeWidth="4"
                      strokeDasharray={`${dashI} ${circI}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[13px] font-black tabular-nums leading-none" style={{ color: ringColor }}>
                      {stats.winRateMonths.toFixed(0)}%
                    </span>
                    <span className="text-[8px] font-semibold text-tx-4 uppercase tracking-[0.1em] leading-none mt-1">Win Rate</span>
                  </div>
                </div>
                {/* Stats grid */}
                <div className="flex-1 min-w-0 flex flex-col gap-2.5">
                  {/* Ring legend */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ringColor }} />
                      <span className="text-[10px] text-tx-4">Monthly win rate</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: innerColor }} />
                      <span className="text-[10px] text-tx-4">{stats.profitableMonths}/{stats.totalMonths} profitable mo</span>
                    </div>
                  </div>
                  {/* Divider */}
                  <div className="h-px bg-[rgba(var(--border-rgb),0.06)]" />
                  {/* Key metrics — spaced grid with clear separation */}
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                    {stats.bestMonthIncome > 0 && (
                      <div className="min-w-0">
                        <div className="text-[10px] text-tx-4 uppercase tracking-wider mb-0.5">Best Mo.</div>
                        <div className="text-sm font-bold text-profit tabular-nums font-mono truncate">{fmtGBP(stats.bestMonthIncome)}</div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] text-tx-4 uppercase tracking-wider mb-0.5">Avg Payout</div>
                      <div className="text-sm font-bold tabular-nums font-mono truncate" style={{ color: ACCENT }}>{fmtGBP(stats.avgMonthlyIncome)}</div>
                    </div>
                    {stats.streak > 0 && (
                      <div className="min-w-0">
                        <div className="text-[10px] text-tx-4 uppercase tracking-wider mb-0.5">Streak</div>
                        <div className="text-sm font-bold flex items-center gap-1" style={{ color: ORANGE }}>
                          <Flame size={9} className="shrink-0" />{stats.streak}mo
                        </div>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[10px] text-tx-4 uppercase tracking-wider mb-0.5">Active Mo.</div>
                      <div className="text-sm font-bold text-tx-2 tabular-nums">{stats.totalMonths}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Market Pulse */}
        <div>
        <div
          className="card p-4"
          style={{
            background: "linear-gradient(135deg, rgba(20,184,166,0.05) 0%, transparent 100%)",
          }}
        >
          <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
            <Globe size={10} />Market Pulse
          </p>
          <div className="flex flex-col gap-2">
            {MARKET_SESSIONS.map((session) => {
              const isActive = activeSession?.name === session.name;
              const prog = isActive ? sessionProgress(session, now) : 0;
              return (
                <div key={session.name} className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: isActive ? session.color : "rgba(var(--surface-rgb),0.2)",
                      boxShadow: isActive ? `0 0 6px ${session.color}` : "none",
                      animation: isActive ? "pulseDot 2s ease-in-out infinite" : "none" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-medium"
                        style={{ color: isActive ? session.color : "var(--tx-4)" }}>
                        {session.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold tabular-nums font-mono"
                          style={{ color: session.color }}>{prog.toFixed(0)}%</span>
                      )}
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{ width: `${prog}%`, background: isActive ? session.color : "transparent" }} />
                    </div>
                    <span className="text-[10px] text-tx-4 font-mono">{session.startET}–{session.endET} ET</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>

        {/* Monthly Snapshot */}
        <div className="hidden md:block">
        {(() => {
          const thisMth = stats.monthlyChart[stats.monthlyChart.length - 1];
          const lastMth = stats.monthlyChart[stats.monthlyChart.length - 2];
          const inc  = thisMth?.income ?? 0;
          const cost = thisMth?.costs  ?? 0;
          const net  = inc - cost;
          const lastInc = lastMth?.income ?? 0;
          const mom = lastInc > 0 ? ((inc - lastInc) / lastInc) * 100 : null;
          return (
            <div
              className="card p-4"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.05) 0%, transparent 100%)" }}
            >
              <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                <CalendarDays size={10} />This Month
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tx-3">Income</span>
                  <div className="flex items-center gap-2">
                    {mom !== null && (
                      <span className={cn("text-[10px] font-bold",
                        mom >= 0 ? "text-profit" : "text-loss")}>
                        {mom >= 0 ? "+" : ""}{mom.toFixed(0)}%
                      </span>
                    )}
                    <span className="text-xs font-bold text-profit tabular-nums font-mono">{fmtGBP(inc)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tx-3">Costs</span>
                  <span className="text-xs font-bold text-loss tabular-nums font-mono">{fmtGBP(cost)}</span>
                </div>
                <div className="h-px bg-[rgba(var(--border-rgb),0.06)] my-0.5" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-tx-2 font-semibold">Net</span>
                  <span className={cn("text-sm font-bold tabular-nums font-mono", net >= 0 ? "text-profit" : "text-loss")}>
                    {net >= 0 ? "+" : ""}{fmtGBP(net)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
        </div>

        {/* Net Worth Snapshot */}
        <div className="hidden md:block">
        {(() => {
          const netWorth = stats.totalWithdrawals - stats.totalExpenses + stats.portfolioValue - stats.totalDebt + stats.fundedAccountPnL;
          const rows = [
            { label: "Prop P&L",      value: stats.netPnL,              cls: stats.netPnL >= 0 ? "text-profit" : "text-loss" },
            ...(stats.fundedAccountPnL !== 0 ? [{ label: "Active Accounts", value: stats.fundedAccountPnL, cls: stats.fundedAccountPnL >= 0 ? "text-profit" : "text-loss" }] : []),
            { label: "Portfolio",     value: stats.portfolioValue,      cls: "text-accent" },
            { label: "Debt",          value: -stats.totalDebt,          cls: "text-loss" },
          ];
          return (
            <div
              className="card p-4"
              style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.05) 0%, rgba(59,130,246,0.03) 100%)" }}
            >
              <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                <Banknote size={10} />Net Worth
              </p>
              <div className="flex flex-col gap-1.5">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-xs text-tx-3">{r.label}</span>
                    <span className={cn("text-xs font-bold tabular-nums font-mono", r.cls)}>
                      {r.value >= 0 ? "" : "-"}{fmtGBP(Math.abs(r.value))}
                    </span>
                  </div>
                ))}
                <div className="h-px bg-[rgba(var(--border-rgb),0.06)] my-0.5" />
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-tx-2">Total</span>
                  <span className={cn("text-base font-black tabular-nums font-mono", netWorth >= 0 ? "text-profit" : "text-loss")}>
                    {netWorth >= 0 ? "+" : ""}{fmtGBP(netWorth)}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
        </div>

        {/* Today's Trades */}
        {(() => {
          const today = new Date().toISOString().slice(0, 10);
          const todayTrades = (data.tradeJournal ?? []).filter((t) => t.date === today);
          const todayPnL = todayTrades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0);
          const wins = todayTrades.filter((t) => (t.pnl - (t.fees ?? 0)) > 0).length;
          const losses = todayTrades.filter((t) => (t.pnl - (t.fees ?? 0)) <= 0).length;
          const isPos = todayPnL >= 0;
          if (todayTrades.length === 0) return null;
          return (
            <div
              className="card p-4 relative overflow-hidden"
              onClick={() => navigate("/journal")}
              style={{
                background: `linear-gradient(135deg, ${isPos ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)"} 0%, transparent 100%)`,
                borderColor: isPos ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
                cursor: "pointer",
              }}
            >
              {/* Watermark */}
              <div className="absolute right-2 top-0 text-[42px] font-black tabular-nums select-none pointer-events-none leading-none"
                style={{ color: isPos ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)" }}>
                {todayTrades.length}
              </div>
              <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                <BookOpen size={10} />Today's Trades
              </p>
              <div className={cn("text-xl font-black tabular-nums font-mono mb-1", isPos ? "text-profit" : "text-loss")}>
                {isPos ? "+" : ""}{fmtUSD(todayPnL)}
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="text-tx-4">{todayTrades.length} trade{todayTrades.length !== 1 ? "s" : ""}</span>
                {todayTrades.length > 0 && (
                  <>
                    <span className="text-profit font-semibold">{wins}W</span>
                    <span className="text-loss font-semibold">{losses}L</span>
                    {todayTrades.length > 0 && (
                      <span className="text-tx-3 ml-auto">{Math.round((wins / todayTrades.length) * 100)}% WR</span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* SA Tax Countdown */}
        {(() => {
          const now2 = new Date();
          const y = now2.getFullYear();
          const month = now2.getMonth() + 1;
          const taxEndYear = month > 4 || (month === 4 && now2.getDate() >= 6) ? y + 1 : y;
          const jan31 = new Date(`${taxEndYear}-01-31T00:00:00`);
          const diff = Math.ceil((jan31.getTime() - now2.getTime()) / 86400000);
          if (diff < 0 || diff > 365) return null;
          return (
            <div className={cn("card p-4", diff <= 30 ? "border-warn/20 bg-warn/[0.04]" : "")}>
              <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
                <PiggyBank size={10} />SA Tax Deadline
              </p>
              <div className="flex items-end justify-between">
                <div>
                  <p className={cn("text-2xl font-black tabular-nums", diff <= 30 ? "text-warn" : "text-tx-1")}>{diff}</p>
                  <p className="text-[10px] text-tx-4">days until Jan 31</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-tx-3">Self Assessment</p>
                  <p className="text-[10px] text-tx-4">filing & payment due</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Upcoming Economic Events ── */}
        {(() => {
          let upcoming: Array<{ title: string; date: string; country: string; impact: string }> = [];
          try {
            const cached = sessionStorage.getItem("ff_cal_this");
            if (cached) {
              const all: Array<{ title: string; date: string; country: string; impact: string }> = JSON.parse(cached);
              const now2 = new Date();
              upcoming = all
                .filter((ev) => {
                  const d = new Date(ev.date);
                  return (
                    d > now2 &&
                    (ev.impact === "High" || ev.impact === "Medium") &&
                    (ev.country === "USD" || ev.country === "GBP")
                  );
                })
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 5);
            }
          } catch {}
          if (upcoming.length === 0) return null;
          const todayET = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
          return (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <Calendar size={10} className="text-accent" />Upcoming Events
                </p>
                <button
                  onClick={() => navigate("/market")}
                  className="text-[10px] text-tx-4 hover:text-tx-2 flex items-center gap-0.5 transition-colors"
                >
                  All <ChevronRight size={10} />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {upcoming.map((ev, i) => {
                  const d = new Date(ev.date);
                  const isToday = ev.date.slice(0, 10) === todayET;
                  const impCol = ev.impact === "High" ? LOSS : WARN;
                  const timeStr = d.toLocaleTimeString("en-US", {
                    hour: "2-digit", minute: "2-digit", hour12: false,
                    timeZone: "America/New_York",
                  });
                  const dayStr = isToday
                    ? "Today"
                    : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "America/New_York" });
                  return (
                    <div key={i} className="flex items-start gap-2 group">
                      <div
                        className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: impCol, boxShadow: `0 0 4px ${impCol}80` }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-tx-1 font-medium truncate leading-tight">{ev.title}</p>
                        <p className="text-[10px] text-tx-4 font-mono mt-0.5">
                          <span style={{ color: isToday ? "#5aadaa" : undefined }}>{dayStr}</span>
                          {" · "}{timeStr} ET
                        </p>
                      </div>
                      <span
                        className="text-[10px] font-bold flex-shrink-0 mt-0.5 px-1 py-0.5 rounded"
                        style={{ background: `${impCol}15`, color: impCol }}
                      >
                        {ev.country}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── Trade Journal Summary ── */}
        {(() => {
          const trades = data.tradeJournal ?? [];
          const wins = trades.filter((t) => t.pnl > 0).length;
          const losses = trades.filter((t) => t.pnl < 0).length;
          const net = trades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0);
          const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
          const today = new Date().toISOString().slice(0, 10);
          const todayTrades = trades.filter((t) => t.date === today);
          const todayNet = todayTrades.reduce((s, t) => s + t.pnl - (t.fees ?? 0), 0);

          // Best/worst trade
          const bestPnl = trades.reduce((m, t) => Math.max(m, t.pnl), -Infinity);
          const grossWins = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
          const grossLoss = Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
          const pf = grossLoss > 0 ? grossWins / grossLoss : null;

          return (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <BookOpen size={10} className="text-accent" />Trade Journal
                </p>
                <button
                  onClick={() => navigate("/journal")}
                  className="text-[10px] text-tx-4 hover:text-tx-2 flex items-center gap-0.5 transition-colors"
                >
                  View <ChevronRight size={10} />
                </button>
              </div>

              {/* Today's session */}
              {todayTrades.length > 0 && (
                <div
                  className="rounded-lg p-2.5 mb-3 flex items-center justify-between"
                  style={{
                    background: todayNet >= 0 ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    border: `1px solid ${todayNet >= 0 ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                  }}
                >
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-tx-3">Today</p>
                    <p className="text-[11px] font-semibold text-tx-2">{todayTrades.length} trade{todayTrades.length !== 1 ? "s" : ""}</p>
                  </div>
                  <span
                    className="text-sm font-black tabular-nums"
                    style={{ color: todayNet >= 0 ? PROFIT : LOSS }}
                  >
                    {todayNet >= 0 ? "+" : ""}{fmtUSD(todayNet)}
                  </span>
                </div>
              )}

              {trades.length === 0 ? (
                <button
                  onClick={() => navigate("/journal")}
                  className="w-full py-6 flex flex-col items-center gap-2 rounded-xl transition-colors hover:bg-accent-subtle"
                  style={{ border: "1px dashed rgba(var(--border-rgb,255,255,255),0.1)" }}
                >
                  <BookOpen size={20} className="text-tx-4" />
                  <p className="text-[11px] text-tx-4">No trades logged yet</p>
                  <span className="text-[10px] font-semibold text-accent">Start logging →</span>
                </button>
              ) : (
                <>
                  {/* Compact mobile-first stats grid */}
                  <div className="grid grid-cols-4 gap-x-1.5 gap-y-1 mb-2.5">
                    {/* Net P&L - most prominent */}
                    <div className="min-w-0">
                      <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5 truncate">Net P&L</p>
                      <p className="text-[11px] sm:text-sm font-black tabular-nums leading-tight truncate" style={{ color: net >= 0 ? PROFIT : LOSS }}>
                        {net >= 0 ? "+" : ""}{fmtUSD(net)}
                      </p>
                    </div>
                    {/* Win Rate */}
                    <div className="min-w-0">
                      <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5 truncate">Win Rate</p>
                      <p className="text-[11px] sm:text-sm font-black tabular-nums leading-tight truncate" style={{ color: "var(--accent)" }}>
                        {winRate.toFixed(0)}%
                      </p>
                    </div>
                    {/* Total Trades */}
                    <div className="min-w-0">
                      <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5 truncate">Trades</p>
                      <p className="text-[11px] sm:text-sm font-black tabular-nums text-tx-2 leading-tight truncate">{trades.length}</p>
                    </div>
                    {/* P.Factor */}
                    <div className="min-w-0">
                      <p className="text-[9px] text-tx-4 uppercase tracking-wider mb-0.5 truncate">P.F</p>
                      <p className="text-[11px] sm:text-sm font-black tabular-nums leading-tight truncate" style={{ color: "var(--accent)" }}>
                        {pf !== null ? pf.toFixed(2) : "—"}
                      </p>
                    </div>
                  </div>

                  {/* W/L bar - compact */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-tx-4 w-6 text-right tabular-nums shrink-0">{wins}W</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: "rgba(var(--surface-rgb,255,255,255),0.06)" }}>
                      <div style={{ width: `${(wins / trades.length) * 100}%`, background: "linear-gradient(90deg,#3d8a5a,#22c55e)" }} className="h-full rounded-l-full" />
                      <div style={{ flex: 1, background: "linear-gradient(90deg,#b84040,#b84040)" }} className="h-full rounded-r-full" />
                    </div>
                    <span className="text-[10px] text-tx-4 w-6 tabular-nums shrink-0">{losses}L</span>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Recent payouts */}
        {data.withdrawals.length > 0 && (
          <div
            className="card p-4"
            style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.04) 0%, transparent 100%)" }}
          >
            <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
              <ArrowDownToLine size={10} />Recent Payouts
            </p>
            <div className="flex flex-col gap-1.5">
              {[...data.withdrawals].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((w) => (
                <div key={w.id} className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-tx-2 font-medium truncate">{w.firm.split(" ")[0]}</p>
                    <p className="text-[10px] text-tx-4 font-mono">{w.date.slice(5).replace("-", "/")}</p>
                  </div>
                  <span className="text-xs font-bold text-profit tabular-nums font-mono shrink-0 ml-2">
                    +{fmtGBP(w.gross)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>{/* end right sidebar */}
      </div>{/* end 2-col grid */}

    {/* ── WEALTH TARGET MODAL ──────────────────────────────────────────────── */}
    <Modal
      open={targetModalOpen}
      onClose={() => setTargetModalOpen(false)}
      title={editingTargetId ? "Edit Target" : "Add Target"}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {/* Emoji + Name row */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-tx-3 uppercase tracking-wider font-medium">Emoji</label>
            <input
              type="text"
              value={targetForm.emoji}
              onChange={(e) => setTargetForm((p) => ({ ...p, emoji: e.target.value }))}
              className="nx-input w-14 text-center text-xl px-2.5 py-2"
              maxLength={2}
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[11px] text-tx-3 uppercase tracking-wider font-medium">Name</label>
            <input
              type="text"
              placeholder="e.g. Emergency Fund"
              value={targetForm.name}
              onChange={(e) => setTargetForm((p) => ({ ...p, name: e.target.value }))}
              className="nx-input"
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-tx-3 uppercase tracking-wider font-medium">Description</label>
          <input
            type="text"
            placeholder="Short description (optional)"
            value={targetForm.desc}
            onChange={(e) => setTargetForm((p) => ({ ...p, desc: e.target.value }))}
            className="bg-[rgba(var(--border-rgb),0.05)] border border-[rgba(var(--border-rgb),0.10)] rounded-lg px-3 py-2 text-sm text-tx-1 outline-none focus:border-[rgba(var(--border-rgb),0.20)] placeholder:text-tx-4"
          />
        </div>

        {/* Target / Saved row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-tx-3 uppercase tracking-wider font-medium">Target (£)</label>
            <input
              type="number"
              placeholder="0"
              value={targetForm.target}
              onChange={(e) => setTargetForm((p) => ({ ...p, target: e.target.value }))}
              className="nx-input font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-tx-3 uppercase tracking-wider font-medium">Saved (£)</label>
            <input
              type="number"
              placeholder="0"
              value={targetForm.saved}
              onChange={(e) => setTargetForm((p) => ({ ...p, saved: e.target.value }))}
              className="nx-input font-mono"
            />
          </div>
        </div>

        {/* Monthly */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-tx-3 uppercase tracking-wider font-medium">Monthly Contribution (£)</label>
          <input
            type="number"
            placeholder="0"
            value={targetForm.monthly}
            onChange={(e) => setTargetForm((p) => ({ ...p, monthly: e.target.value }))}
            className="nx-input font-mono"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setTargetModalOpen(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-tx-3 hover:text-tx-1 transition-colors"
            style={{ background: "rgba(var(--surface-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
          >
            Cancel
          </button>
          <button
            onClick={saveTarget}
            disabled={!targetForm.name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", color: "var(--tx-1)" }}
          >
            {editingTargetId ? "Save Changes" : "Add Target"}
          </button>
        </div>
      </div>
    </Modal>

    </motion.div>
  );
}
