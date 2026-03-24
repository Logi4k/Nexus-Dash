/// <reference types="vite/client" />
import { useState, useMemo, useEffect, useCallback } from "react";
import { PAGE_THEMES } from "@/lib/theme";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Search,
  Wifi,
  WifiOff,
  Target,
  Repeat,
  Check,
  X,
  AlertCircle,
  Trophy,
  CalendarClock,
  Layers,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { useAppData } from "@/lib/store";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import {
  fmtGBP,
  fmtDate,
  fmtShortDate,
  toNum,
  pct,
  cn,
  daysUntil,
  generateId,
} from "@/lib/utils";
import Modal from "@/components/Modal";
import type { Investment, WealthTarget, Subscription } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

// Dev: Vite proxies /t212 → https://live.trading212.com/api/v0 (bypasses CORS)
const T212_BASE = import.meta.env.DEV ? "/t212" : "https://live.trading212.com/api/v0";
const ALLOC_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

// ─── T212 API types ───────────────────────────────────────────────────────────

interface T212Position {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  ppl: number;
  fxPpl: number;
}

interface T212Cash {
  free: number;
  total: number;
  ppl: number;
  result: number;
  invested: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function investmentValue(inv: Investment): number {
  return inv.units * inv.cur;
}

function investmentCost(inv: Investment): number {
  return inv.units * inv.buy;
}

function investmentPnl(inv: Investment): number {
  return investmentValue(inv) - investmentCost(inv);
}

function investmentPnlPct(inv: Investment): number {
  const cost = investmentCost(inv);
  if (!cost) return 0;
  return (investmentPnl(inv) / cost) * 100;
}

function monthlySubCost(sub: Subscription): number {
  if (sub.frequency === "monthly") return sub.amount;
  if (sub.frequency === "yearly") return sub.amount / 12;
  if (sub.frequency === "weekly") return (sub.amount * 52) / 12;
  return sub.amount;
}

function emptyInvestment(): Omit<Investment, "id"> {
  return { ticker: "", name: "", type: "etf", units: 0, buy: 0, cur: 0 };
}

function emptySubscription(): Omit<Subscription, "id"> {
  return {
    name: "",
    amount: 0,
    frequency: "monthly",
    startDate: new Date().toISOString().slice(0, 10),
    nextRenewal: new Date().toISOString().slice(0, 10),
    notes: "",
  };
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  valueClass = "text-tx-1",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs text-tx-3 uppercase tracking-wider">{label}</span>
      <span className={cn("text-2xl font-bold tabular-nums", valueClass)}>{value}</span>
      {sub && <span className="text-xs text-tx-3 mt-0.5">{sub}</span>}
    </div>
  );
}


// ─── Investment Form Modal ────────────────────────────────────────────────────

function InvestmentFormModal({
  open,
  onClose,
  onSave,
  initial,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (inv: Omit<Investment, "id">) => void;
  initial?: Omit<Investment, "id">;
  title: string;
}) {
  const [form, setForm] = useState<Omit<Investment, "id">>(
    initial ?? emptyInvestment()
  );

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSave() {
    if (!form.ticker.trim() || !form.name.trim()) return;
    onSave({
      ...form,
      units: toNum(form.units),
      buy: toNum(form.buy),
      cur: toNum(form.cur),
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Ticker</label>
          <input
            className="nx-input uppercase"
            placeholder="e.g. VUAG"
            value={form.ticker}
            onChange={(e) => setField("ticker", e.target.value.toUpperCase())}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Type</label>
          <select
            className="nx-select"
            value={form.type}
            onChange={(e) => setField("type", e.target.value as "etf" | "stock")}
          >
            <option value="etf">ETF</option>
            <option value="stock">Stock</option>
          </select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Name</label>
          <input
            className="nx-input"
            placeholder="Full instrument name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Units / Quantity</label>
          <input
            type="number"
            className="nx-input"
            value={form.units || ""}
            onChange={(e) => setField("units", parseFloat(e.target.value) || 0)}
            min="0"
            step="0.000001"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Avg Buy Price (GBP)</label>
          <input
            type="number"
            className="nx-input"
            value={form.buy || ""}
            onChange={(e) => setField("buy", parseFloat(e.target.value) || 0)}
            min="0"
            step="0.0001"
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Current Price (GBP)</label>
          <input
            type="number"
            className="nx-input"
            value={form.cur || ""}
            onChange={(e) => setField("cur", parseFloat(e.target.value) || 0)}
            min="0"
            step="0.0001"
          />
        </div>
        <div className="col-span-2 flex gap-2 pt-1">
          <button className="btn-ghost flex-1 btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 btn-sm" onClick={handleSave}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Subscription Form Modal ──────────────────────────────────────────────────

function SubscriptionFormModal({
  open,
  onClose,
  onSave,
  initial,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (sub: Omit<Subscription, "id">) => void;
  initial?: Omit<Subscription, "id">;
  title: string;
}) {
  const [form, setForm] = useState<Omit<Subscription, "id">>(
    initial ?? emptySubscription()
  );

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleSave() {
    if (!form.name.trim()) return;
    onSave({ ...form, amount: toNum(form.amount) });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Name</label>
          <input
            className="nx-input"
            placeholder="e.g. TradingView"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tx-3">Amount (£)</label>
            <input
              type="number"
              className="nx-input"
              value={form.amount || ""}
              onChange={(e) => setField("amount", parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-tx-3">Frequency</label>
            <select
              className="nx-select"
              value={form.frequency}
              onChange={(e) =>
                setField("frequency", e.target.value as Subscription["frequency"])
              }
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Next Renewal</label>
          <input
            type="date"
            className="nx-input"
            value={form.nextRenewal}
            onChange={(e) => setField("nextRenewal", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Notes (optional)</label>
          <input
            type="text"
            className="nx-input"
            value={form.notes ?? ""}
            onChange={(e) => setField("notes", e.target.value)}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button className="btn-ghost flex-1 btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 btn-sm" onClick={handleSave}>Save</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Investment Sidebar ───────────────────────────────────────────────────────

function InvestmentSidebar({
  investments,
  pieData,
  subscriptions,
  stats,
}: {
  investments: Investment[];
  pieData: { name: string; value: number; pct: number }[];
  subscriptions: Subscription[];
  stats: { totalValue: number; totalInvested: number; totalPnl: number; totalPnlPct: number };
}) {
  const bw = useBWMode();
  const topPerformers = [...investments]
    .filter((inv) => investmentValue(inv) > 0)
    .sort((a, b) => investmentPnlPct(b) - investmentPnlPct(a))
    .slice(0, 5);

  const worstPerformer = [...investments]
    .filter((inv) => investmentValue(inv) > 0)
    .sort((a, b) => investmentPnlPct(a) - investmentPnlPct(b))[0];

  const etfValue = investments.filter((i) => i.type === "etf").reduce((s, i) => s + investmentValue(i), 0);
  const stockValue = investments.filter((i) => i.type === "stock").reduce((s, i) => s + investmentValue(i), 0);
  const totalPortVal = etfValue + stockValue || 1;
  const etfPct = (etfValue / totalPortVal) * 100;
  const stockPct = (stockValue / totalPortVal) * 100;

  const upcoming = [...subscriptions]
    .filter((s) => {
      if (s.cancelled) return false;
      const d = daysUntil(s.nextRenewal);
      return d >= 0 && d <= 30;
    })
    .sort((a, b) => daysUntil(a.nextRenewal) - daysUntil(b.nextRenewal))
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-4 xl:sticky xl:top-6">
      {/* ── Allocation Ring ── */}
      {pieData.length > 0 && (() => {
        const R = 42, cx = 55, cy = 55;
        const circ = 2 * Math.PI * R;
        const GAP = 2;
        let runPct = 0;
        const segments = pieData.map((item, i) => {
          const frac = item.pct / 100;
          const dash = Math.max(0, frac * circ - GAP);
          const offset = -(runPct * circ);
          runPct += frac;
          return { ...item, dash, offset, color: bwColor(ALLOC_COLORS[i % ALLOC_COLORS.length], bw) };
        });
        return (
          <div className="card p-4 flex flex-col gap-3">
            <h3 className="text-[10px] font-bold text-tx-3 uppercase tracking-wider">Allocation</h3>
            <div className="flex items-center gap-3">
              {/* SVG ring with centre label */}
              <div className="relative shrink-0">
                <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="11" />
                  {segments.map((seg) => (
                    <circle
                      key={seg.name}
                      cx={cx} cy={cy} r={R}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="11"
                      strokeDasharray={`${seg.dash} ${circ}`}
                      strokeDashoffset={seg.offset}
                      strokeLinecap="butt"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[11px] font-black text-tx-1 tabular-nums leading-tight">
                    {fmtGBP(stats.totalValue)}
                  </span>
                  <span className="text-[10px] text-tx-3 uppercase tracking-widest mt-0.5">portfolio</span>
                </div>
              </div>
              {/* Legend */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                {segments.map((seg) => (
                  <div key={seg.name} className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ background: seg.color }} />
                    <span className="text-[10px] text-tx-3 font-mono truncate">{seg.name}</span>
                    <span className="text-[10px] text-tx-3 ml-auto tabular-nums">{seg.pct.toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Portfolio Composition ── */}
      {(etfValue > 0 || stockValue > 0) && (
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Layers size={13} className="text-accent" />
            <h3 className="text-xs font-semibold text-tx-1 uppercase tracking-wider">Composition</h3>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { label: "ETF", value: etfValue, pct: etfPct, color: "#0eb89a" },
              { label: "Stock", value: stockValue, pct: stockPct, color: "#f59e0b" },
            ].map(({ label, value, pct: p, color }) => (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-tx-3">{label}</span>
                  <span className="text-tx-2 font-medium tabular-nums">{fmtGBP(value)} · {p.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${p}%`, background: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Top Performers ── */}
      {topPerformers.length > 0 && (
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Trophy size={13} className="text-warn" />
            <h3 className="text-xs font-semibold text-tx-1 uppercase tracking-wider">Top Performers</h3>
          </div>
          <div className="flex flex-col gap-1.5">
            {topPerformers.map((inv, i) => {
              const pnlP = investmentPnlPct(inv);
              const pnl = investmentPnl(inv);
              const isPos = pnlP >= 0;
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors"
                  style={{ background: "rgba(var(--surface-rgb),0.04)" }}
                >
                  <span
                    className="text-[10px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0"
                    style={{
                      background: i === 0 ? "rgba(245,158,11,0.15)" : "rgba(var(--surface-rgb),0.07)",
                      color: i === 0 ? "#f59e0b" : "var(--tx-3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-accent flex-1">{inv.ticker}</span>
                  <div className="flex items-center gap-0.5">
                    {isPos ? (
                      <ArrowUpRight size={10} className="text-profit" />
                    ) : (
                      <ArrowDownRight size={10} className="text-loss" />
                    )}
                    <span className={cn("text-[10px] font-semibold tabular-nums", isPos ? "text-profit" : "text-loss")}>
                      {pnlP.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
            {worstPerformer && investmentPnlPct(worstPerformer) < 0 && !topPerformers.includes(worstPerformer) && (
              <>
                <div className="border-t border-white/[0.05] my-0.5" />
                <div
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.04)" }}
                >
                  <Flame size={10} className="text-loss shrink-0" />
                  <span className="font-mono text-[11px] font-semibold text-tx-2 flex-1">{worstPerformer.ticker}</span>
                  <span className="text-[10px] font-semibold text-loss tabular-nums">
                    {investmentPnlPct(worstPerformer).toFixed(2)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Upcoming Renewals ── */}
      {upcoming.length > 0 && (
        <div className="card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={13} className="text-accent" />
            <h3 className="text-xs font-semibold text-tx-1 uppercase tracking-wider">Upcoming Renewals</h3>
          </div>
          <div className="flex flex-col gap-2">
            {upcoming.map((sub) => {
              const days = daysUntil(sub.nextRenewal);
              const isSoon = days <= 7;
              return (
                <div key={sub.id} className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-bold"
                    style={{
                      background: isSoon ? "rgba(245,158,11,0.1)" : "rgba(14,184,154,0.08)",
                      color: isSoon ? "#f59e0b" : "#0eb89a",
                    }}
                  >
                    {days === 0 ? "!" : `${days}d`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-tx-1 truncate">{sub.name}</p>
                    <p className="text-[10px] text-tx-4">
                      {fmtGBP(sub.amount)}/{sub.frequency === "monthly" ? "mo" : sub.frequency === "yearly" ? "yr" : "wk"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── P&L Summary ── */}
      <div
        className="card p-4 flex flex-col gap-2"
        style={{
          background: stats.totalPnl >= 0
            ? "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, transparent 60%)"
            : "linear-gradient(135deg, rgba(239,68,68,0.06) 0%, transparent 60%)",
          borderColor: stats.totalPnl >= 0 ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        }}
      >
        <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium">Total Return</p>
        <p className={cn("text-2xl font-bold tabular-nums", stats.totalPnl >= 0 ? "text-profit" : "text-loss")}>
          {stats.totalPnl >= 0 ? "+" : ""}{fmtGBP(stats.totalPnl)}
        </p>
        <div className="flex items-center justify-between text-xs">
          <span className="text-tx-4">on {fmtGBP(stats.totalInvested)} invested</span>
          <span className={cn("font-semibold", stats.totalPnlPct >= 0 ? "text-profit" : "text-loss")}>
            {stats.totalPnlPct >= 0 ? "+" : ""}{stats.totalPnlPct.toFixed(2)}%
          </span>
        </div>
        <div className="progress-track mt-1">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(100, Math.abs(stats.totalPnlPct) * 5)}%`,
              background: stats.totalPnl >= 0 ? "#22c55e" : "#ef4444",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const { data, update } = useAppData();
  const investments: Investment[] = data.investments ?? [];
  const t212 = data.t212;
  const wealthTargets: WealthTarget[] = data.wealthTargets ?? [];
  const subscriptions: Subscription[] = data.subscriptions ?? [];

  // API key from store (user sets it via UI, falls back to env for dev)
  const apiKey = data.userSettings?.t212ApiKey || (import.meta.env.VITE_T212_API_KEY as string | undefined);

  // ── T212 sync state ───────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(!!apiKey);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");

  // ── UI state ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [showAddInv, setShowAddInv] = useState(false);
  const [editInv, setEditInv] = useState<Investment | null>(null);
  const [deleteInvId, setDeleteInvId] = useState<string | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editTargetVal, setEditTargetVal] = useState("");

  function saveApiKey() {
    const key = apiKeyDraft.trim();
    if (!key) return;
    update((prev) => ({
      ...prev,
      userSettings: { ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }), t212ApiKey: key },
    }));
    setShowApiKeyInput(false);
    setApiKeyDraft("");
  }

  function removeApiKey() {
    update((prev) => ({
      ...prev,
      userSettings: { ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }), t212ApiKey: undefined },
    }));
    setConnected(false);
  }

  // ── Wealth target modal state ──────────────────────────────────────────────
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
    const t = wealthTargets.find((x) => x.id === id);
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
  const [showAddSub, setShowAddSub] = useState(false);
  const [editSub, setEditSub] = useState<Subscription | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);

  // ── Page theme + filter state ─────────────────────────────────────────────
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.investments, isBW);
  const [filters, setFilters] = useState({ performance: "all", sort: "value" });

  // ── T212 sync ─────────────────────────────────────────────────────────────
  const syncT212 = useCallback(async () => {
    if (!apiKey) {
      setSyncError("No T212 API key found. Set VITE_T212_API_KEY in your .env file.");
      setConnected(false);
      return;
    }

    setSyncing(true);
    setSyncError(null);

    try {
      const headers = { Authorization: apiKey };

      const [posRes, cashRes] = await Promise.all([
        fetch(`${T212_BASE}/equity/portfolio`, { headers }),
        fetch(`${T212_BASE}/equity/account/cash`, { headers }),
      ]);

      const failedStatus = !posRes.ok ? posRes.status : cashRes.status;
      if (!posRes.ok || !cashRes.ok) {
        if (failedStatus === 401) {
          throw new Error(
            "API key rejected (401) — regenerate your T212 API key at app.trading212.com → Settings → API, update VITE_T212_API_KEY in .env, then restart the app."
          );
        }
        throw new Error(
          `T212 API error: ${posRes.ok ? "" : `portfolio ${posRes.status}`} ${cashRes.ok ? "" : `cash ${cashRes.status}`}`.trim()
        );
      }

      const positions: T212Position[] = await posRes.json();
      const cash: T212Cash = await cashRes.json();

      // Convert T212 positions to Investment format
      const t212Investments: Investment[] = positions.map((pos) => ({
        id: `t212_${pos.ticker}`,
        ticker: pos.ticker,
        name: pos.ticker,
        type: "stock" as const,
        units: pos.quantity,
        buy: pos.averagePrice,
        cur: pos.currentPrice,
      }));

      update((prev) => ({
        ...prev,
        t212: {
          last_sync: Date.now(),
          free_cash: cash.free,
          total_value: cash.total,
          invested: cash.invested,
          ppl: cash.ppl,
          result: cash.result,
        },
        // Merge: keep manual investments, replace t212 sourced ones
        investments: [
          ...prev.investments.filter((inv) => !inv.id.startsWith("t212_")),
          ...t212Investments,
        ],
      }));

      setConnected(true);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
      setConnected(false);
    } finally {
      setSyncing(false);
    }
  }, [apiKey, update]);

  // Auto-sync on mount if API key exists
  useEffect(() => {
    if (apiKey && t212.last_sync === 0) {
      syncT212();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Portfolio stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const manualValue = investments
      .filter((inv) => !inv.id.startsWith("t212_"))
      .reduce((s, inv) => s + investmentValue(inv), 0);
    const manualCost = investments
      .filter((inv) => !inv.id.startsWith("t212_"))
      .reduce((s, inv) => s + investmentCost(inv), 0);

    const totalValue = t212.total_value + manualValue;
    const totalInvested = t212.invested + manualCost;
    const totalPnl = totalValue - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return { totalValue, totalInvested, totalPnl, totalPnlPct };
  }, [investments, t212]);

  // ── Filtered + sorted holdings ────────────────────────────────────────────
  const filteredInvestments = useMemo(() => {
    const q = search.toLowerCase();
    return investments
      .filter(
        (inv) =>
          inv.ticker.toLowerCase().includes(q) ||
          inv.name.toLowerCase().includes(q)
      )
      .filter((inv) => {
        if (filters.performance === "gain") return investmentPnl(inv) > 0;
        if (filters.performance === "loss") return investmentPnl(inv) < 0;
        return true;
      })
      .sort((a, b) => investmentPnlPct(b) - investmentPnlPct(a));
  }, [investments, search, filters.performance]);

  // ── Pie chart data ────────────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const totalVal = investments.reduce((s, inv) => s + investmentValue(inv), 0) || 1;
    return investments
      .map((inv) => ({
        name: inv.ticker,
        value: parseFloat(investmentValue(inv).toFixed(2)),
        pct: pct(investmentValue(inv), totalVal),
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // top 8
  }, [investments]);

  // ── Investment CRUD ───────────────────────────────────────────────────────
  function handleAddInvestment(form: Omit<Investment, "id">) {
    update((prev) => ({
      ...prev,
      investments: [...prev.investments, { ...form, id: generateId() }],
    }));
  }

  function handleEditInvestment(id: string, form: Omit<Investment, "id">) {
    update((prev) => ({
      ...prev,
      investments: prev.investments.map((inv) =>
        inv.id === id ? { ...inv, ...form } : inv
      ),
    }));
  }

  function handleDeleteInvestment(id: string) {
    update((prev) => ({
      ...prev,
      investments: prev.investments.filter((inv) => inv.id !== id),
    }));
    setDeleteInvId(null);
  }

  // ── Wealth target CRUD ────────────────────────────────────────────────────
  function saveTargetSaved(id: string) {
    const val = parseFloat(editTargetVal);
    if (isNaN(val) || val < 0) return;
    update((prev) => ({
      ...prev,
      wealthTargets: prev.wealthTargets.map((wt) =>
        wt.id === id ? { ...wt, saved: val } : wt
      ),
    }));
    setEditTargetId(null);
  }

  // ── Subscription CRUD ─────────────────────────────────────────────────────
  function handleAddSub(form: Omit<Subscription, "id">) {
    update((prev) => ({
      ...prev,
      subscriptions: [...prev.subscriptions, { ...form, id: generateId() }],
    }));
  }

  function handleEditSub(id: string, form: Omit<Subscription, "id">) {
    update((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) =>
        s.id === id ? { ...s, ...form } : s
      ),
    }));
  }

  function handleDeleteSub(id: string) {
    update((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.filter((s) => s.id !== id),
    }));
    setDeleteSubId(null);
  }

  function handleCancelSub(id: string) {
    update((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) =>
        s.id === id ? { ...s, cancelled: true, cancelledAt: new Date().toISOString().split("T")[0] } : s
      ),
    }));
  }

  function handleReactivateSub(id: string) {
    update((prev) => ({
      ...prev,
      subscriptions: prev.subscriptions.map((s) =>
        s.id === id ? { ...s, cancelled: false, cancelledAt: undefined } : s
      ),
    }));
  }

  const activeSubs = subscriptions.filter((s) => !s.cancelled);
  const cancelledSubs = subscriptions.filter((s) => s.cancelled);
  const totalMonthlySubs = activeSubs.reduce((s, sub) => s + monthlySubCost(sub), 0);
  const annualSubCost = activeSubs.reduce((sum, s) => sum + monthlySubCost(s) * 12, 0);

  const lastSyncText =
    t212.last_sync > 0
      ? `Last sync: ${new Date(t212.last_sync).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : "Never synced";

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Investments</div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h1 className="page-title">Investment Portfolio</h1>
            {/* T212 status pill */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{
                background: connected ? "rgba(34,197,94,0.08)" : "rgba(100,116,139,0.08)",
                border: `1px solid ${connected ? "rgba(34,197,94,0.2)" : "rgba(100,116,139,0.15)"}`,
                color: connected ? "#22c55e" : "#64748b",
              }}
            >
              {connected ? <Wifi size={9} /> : <WifiOff size={9} />}
              T212 {connected ? "live" : "offline"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-tx-4 hidden sm:block">{lastSyncText}</span>
            <button className="btn-ghost btn-sm" onClick={syncT212} disabled={syncing}>
              <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync"}
            </button>
            <button className="btn-primary btn-sm" onClick={() => setShowAddInv(true)}>
              <Plus size={14} />
              Add Holding
            </button>
          </div>
        </div>
      </div>

      {/* Sync error — compact banner */}
      {/* ── T212 API Key Banner ── */}
      {!apiKey && !showApiKeyInput && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-xs -mt-2"
          style={{ background: bwColor("rgba(99,102,241,0.06)", isBW), border: `1px solid ${bwColor("rgba(99,102,241,0.18)", isBW)}` }}
        >
          <div className="flex items-center gap-2.5">
            <WifiOff size={13} className="text-tx-3 shrink-0" />
            <span className="text-tx-2">Connect your Trading 212 account to sync positions automatically.</span>
          </div>
          <button
            className="btn-ghost btn-sm shrink-0"
            style={{ color: bwColor("#818cf8", isBW) }}
            onClick={() => setShowApiKeyInput(true)}
          >
            Connect T212
          </button>
        </div>
      )}

      {/* ── API Key Input ── */}
      {showApiKeyInput && (
        <div
          className="flex flex-col gap-3 px-4 py-3.5 rounded-xl -mt-2"
          style={{ background: bwColor("rgba(99,102,241,0.06)", isBW), border: `1px solid ${bwColor("rgba(99,102,241,0.18)", isBW)}` }}
        >
          <p className="text-[11px] font-semibold text-tx-2">
            Enter your T212 API key — generate one at <span className="text-tx-1">app.trading212.com → Settings → API</span>
          </p>
          <div className="flex gap-2">
            <input
              className="nx-input flex-1 text-xs font-mono"
              placeholder="Paste API key here..."
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveApiKey()}
            />
            <button className="btn-primary btn-sm shrink-0" onClick={saveApiKey} disabled={!apiKeyDraft.trim()}>
              Save
            </button>
            <button className="btn-ghost btn-sm shrink-0" onClick={() => { setShowApiKeyInput(false); setApiKeyDraft(""); }}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Connected status + disconnect ── */}
      {apiKey && (
        <div
          className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs -mt-2"
          style={{ background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.12)" }}
        >
          <div className="flex items-center gap-2">
            <Wifi size={11} className="text-profit shrink-0" />
            <span className="text-tx-3">T212 API key saved</span>
          </div>
          <button
            className="text-[10px] text-tx-4 hover:text-loss transition-colors"
            onClick={removeApiKey}
          >
            Disconnect
          </button>
        </div>
      )}

      {syncError && (
        <div
          className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl text-xs"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
        >
          <AlertCircle size={13} className="text-loss mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold text-loss">T212 sync failed — </span>
            <span className="text-tx-3 leading-snug">
              {syncError.includes("401")
                ? "API key rejected. Disconnect and re-enter a valid key from app.trading212.com → Settings → API."
                : syncError}
            </span>
          </div>
        </div>
      )}

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Total Value", value: fmtGBP(stats.totalValue), sub: "T212 + manual",
            color: bwColor("#1dd4b4", isBW), bg: bwColor("rgba(14,184,154,0.06)", isBW), border: bwColor("rgba(14,184,154,0.18)", isBW),
            icon: <BarChart3 size={13} style={{ color: bwColor("#1dd4b4", isBW), opacity: 0.7 }} />,
          },
          {
            label: "Cost Basis", value: fmtGBP(stats.totalInvested), sub: "Amount invested",
            color: bwColor("#3b82f6", isBW), bg: bwColor("rgba(59,130,246,0.06)", isBW), border: bwColor("rgba(59,130,246,0.18)", isBW),
            icon: <Layers size={13} style={{ color: bwColor("#3b82f6", isBW), opacity: 0.7 }} />,
          },
          {
            label: "Unrealised P&L",
            value: `${stats.totalPnl >= 0 ? "+" : ""}${fmtGBP(stats.totalPnl)}`,
            sub: `${stats.totalPnlPct >= 0 ? "+" : ""}${stats.totalPnlPct.toFixed(2)}% return`,
            color: stats.totalPnl >= 0 ? "#22c55e" : "#ef4444",
            bg: stats.totalPnl >= 0 ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
            border: stats.totalPnl >= 0 ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
            icon: stats.totalPnl >= 0
              ? <TrendingUp size={13} style={{ color: "#22c55e", opacity: 0.7 }} />
              : <TrendingDown size={13} style={{ color: "#ef4444", opacity: 0.7 }} />,
          },
          {
            label: "Free Cash", value: fmtGBP(t212.free_cash ?? 0), sub: "Available in T212",
            color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.18)",
            icon: <Flame size={13} style={{ color: "#f59e0b", opacity: 0.7 }} />,
          },
        ].map(({ label, value, sub, color, bg, border, icon }) => (
          <div
            key={label}
            className="card p-4 flex flex-col gap-1.5"
            style={{ background: `linear-gradient(135deg, ${bg} 0%, transparent 100%)`, borderColor: border }}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-tx-4">{label}</p>
              {icon}
            </div>
            <p className="text-lg font-black tabular-nums leading-none" style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-tx-4">{sub}</p>}
          </div>
        ))}
      </div>

      {/* ── 2-Column Layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_272px] gap-5 items-start">

        {/* ── MAIN COLUMN ── */}
        <div className="flex flex-col gap-5">

          {/* Holdings Table */}
          <div className="card p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-tx-1">Holdings</h2>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-3" />
                <input
                  className="nx-input pl-8 py-1.5 text-xs w-48"
                  placeholder="Search ticker or name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
              {filteredInvestments.length === 0 && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-center text-sm text-tx-3">
                  No holdings found
                </div>
              )}
              {filteredInvestments.map((inv, idx) => {
                const pnl = investmentPnl(inv);
                const pnlP = investmentPnlPct(inv);
                const isProfit = pnl >= 0;
                const accentColor = isProfit ? "#22c55e" : "#ef4444";
                const maxAbsPct = Math.max(...filteredInvestments.map((i) => Math.abs(investmentPnlPct(i))), 1);
                const barW = Math.min(100, (Math.abs(pnlP) / maxAbsPct) * 100);
                const rank = idx + 1;
                const rankColors = [bwColor("#f59e0b", isBW), bwColor("#94a3b8", isBW), bwColor("#c2763a", isBW)];

                return (
                  <div
                    key={inv.id}
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: "rgba(var(--border-rgb),0.08)",
                      background: isProfit ? "rgba(34,197,94,0.025)" : "rgba(239,68,68,0.025)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {rank <= 3 && filteredInvestments.length >= 3 && (
                            <span
                              className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-black leading-none shrink-0"
                              style={{ background: `${rankColors[rank - 1]}22`, color: rankColors[rank - 1], border: `1px solid ${rankColors[rank - 1]}44` }}
                            >
                              {rank}
                            </span>
                          )}
                          <span className="font-mono font-bold text-sm" style={{ color: accentColor }}>
                            {inv.ticker}
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold",
                            inv.type === "etf" ? "bg-accent/10 text-accent" : "bg-warn/10 text-warn"
                          )}>
                            {inv.type}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-tx-2 break-words">{inv.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button className="p-1.5 text-tx-3 hover:text-tx-1 transition-colors" onClick={() => setEditInv(inv)}>
                          <Edit2 size={12} />
                        </button>
                        <button className="p-1.5 text-tx-3 hover:text-loss transition-colors" onClick={() => setDeleteInvId(inv.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-tx-4">Units</p>
                        <p className="mt-1 text-tx-1 tabular-nums">{inv.units.toFixed(4)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-tx-4">Value</p>
                        <p className="mt-1 font-semibold text-tx-1 tabular-nums">{fmtGBP(investmentValue(inv))}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-tx-4">Avg Cost</p>
                        <p className="mt-1 text-tx-3 tabular-nums">{fmtGBP(inv.buy)}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-tx-4">Current</p>
                        <p className="mt-1 text-tx-1 tabular-nums">{fmtGBP(inv.cur)}</p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-xl border border-white/[0.05] bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-tx-4">P&amp;L</span>
                        <span className="font-semibold tabular-nums" style={{ color: accentColor }}>
                          {isProfit ? "+" : ""}{fmtGBP(pnl)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-3 text-xs">
                        <span className="text-tx-4">P&amp;L %</span>
                        <span className="font-semibold tabular-nums" style={{ color: accentColor }}>
                          {isProfit ? "+" : ""}{pnlP.toFixed(2)}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barW}%`, background: `linear-gradient(90deg, ${accentColor}99, ${accentColor})` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto -mx-4 md:mx-0 md:block">
              <table className="min-w-[600px] w-full text-xs px-4 md:px-0">
                <thead>
                  <tr className="border-b" style={{ borderColor: "rgba(14,184,154,0.06)" }}>
                    {["Ticker", "Name", "Type", "Units", "Avg Cost", "Current", "Value", "P&L", "P&L%", ""].map((h) => (
                      <th key={h} className="text-left py-2 px-2 text-tx-4 uppercase tracking-wide font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredInvestments.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-6 text-tx-3">No holdings found</td>
                    </tr>
                  )}
                  {filteredInvestments.map((inv, idx) => {
                    const pnl = investmentPnl(inv);
                    const pnlP = investmentPnlPct(inv);
                    const isProfit = pnl >= 0;
                    const accentColor = isProfit ? "#22c55e" : "#ef4444";
                    const maxAbsPct = Math.max(...filteredInvestments.map((i) => Math.abs(investmentPnlPct(i))), 1);
                    const barW = Math.min(100, (Math.abs(pnlP) / maxAbsPct) * 100);
                    const rank = idx + 1; // sorted by pnlPct desc
                    const rankColors = [bwColor("#f59e0b", isBW), bwColor("#94a3b8", isBW), bwColor("#c2763a", isBW)];
                    return (
                      <tr
                        key={inv.id}
                        className="border-b transition-all duration-150 group"
                        style={{
                          borderColor: "rgba(var(--border-rgb),0.06)",
                          background: isProfit ? "rgba(34,197,94,0.025)" : "rgba(239,68,68,0.025)",
                        }}
                      >
                        {/* colored left accent via first-cell border */}
                        <td className="py-2.5 px-2 font-mono font-bold"
                          style={{ borderLeft: `2.5px solid ${accentColor}50`, color: accentColor === "#22c55e" ? "#34d399" : "#f87171" }}>
                          <div className="flex items-center gap-1.5">
                            {rank <= 3 && filteredInvestments.length >= 3 && (
                              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[10px] font-black leading-none flex-shrink-0"
                                style={{ background: `${rankColors[rank - 1]}22`, color: rankColors[rank - 1], border: `1px solid ${rankColors[rank - 1]}44` }}>
                                {rank}
                              </span>
                            )}
                            {inv.ticker}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-tx-2 max-w-[140px] truncate" title={inv.name}>{inv.name}</td>
                        <td className="py-2.5 px-2">
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold",
                            inv.type === "etf" ? "bg-accent/10 text-accent" : "bg-warn/10 text-warn"
                          )}>
                            {inv.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-tx-2 tabular-nums">{inv.units.toFixed(4)}</td>
                        <td className="py-2.5 px-2 text-tx-3 tabular-nums">{fmtGBP(inv.buy)}</td>
                        <td className="py-2.5 px-2 text-tx-1 tabular-nums font-medium">{fmtGBP(inv.cur)}</td>
                        <td className="py-2.5 px-2 tabular-nums font-semibold text-tx-1">{fmtGBP(investmentValue(inv))}</td>
                        <td className="py-2.5 px-2 tabular-nums font-semibold"
                          style={{ color: accentColor }}>
                          {isProfit ? "+" : ""}{fmtGBP(pnl)}
                        </td>
                        <td className="py-2.5 px-2 min-w-[80px]">
                          <div className="flex flex-col gap-1">
                            <span className="tabular-nums font-semibold text-[11px]"
                              style={{ color: accentColor }}>
                              {isProfit ? "+" : ""}{pnlP.toFixed(2)}%
                            </span>
                            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${barW}%`, background: `linear-gradient(90deg, ${accentColor}99, ${accentColor})` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button className="p-1 text-tx-3 hover:text-tx-1 transition-colors" onClick={() => setEditInv(inv)}>
                              <Edit2 size={11} />
                            </button>
                            <button className="p-1 text-tx-3 hover:text-loss transition-colors" onClick={() => setDeleteInvId(inv.id)}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Wealth Targets ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-accent" />
                <h2 className="font-semibold text-tx-1">Wealth Targets</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={openAddTarget}>
                <Plus size={13} /> Add
              </button>
            </div>
            {wealthTargets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <Target size={28} className="opacity-30 text-tx-3" />
                <p className="text-[11px] text-tx-4 text-center">No targets yet. Click <strong className="text-tx-3">Add</strong> to create your first goal.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {wealthTargets.map((wt) => {
                  const progressPct = Math.min(100, pct(wt.saved, wt.target));
                  const remaining = Math.max(0, wt.target - wt.saved);
                  const monthsToTarget = wt.monthly > 0 ? Math.ceil(remaining / wt.monthly) : null;
                  const ringSize = 64, ringR = 26, ringCx = 32, ringCy = 32;
                  const ringCirc = 2 * Math.PI * ringR;
                  const ringDash = (Math.min(progressPct, 100) / 100) * ringCirc;
                  const ringColor = progressPct >= 100 ? "#4ade80" : progressPct >= 66 ? "#f59e0b" : progressPct >= 33 ? "#14b8a6" : "#6366f1";
                  const ringId = `wtGrad_${wt.id}`;
                  return (
                    <div
                      key={wt.id}
                      className="rounded-xl p-4 flex flex-col gap-3 group"
                      style={{ background: "rgba(14,184,154,0.03)", border: "1px solid rgba(14,184,154,0.08)" }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{wt.emoji}</span>
                          <div>
                            <div className="text-sm font-semibold text-tx-1">{wt.name}</div>
                            {wt.desc && <div className="text-xs text-tx-3">{wt.desc}</div>}
                          </div>
                        </div>
                        <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 rounded-lg text-tx-4 hover:text-tx-1 hover:bg-white/[0.06] transition-colors"
                            onClick={() => openEditTarget(wt.id)}
                            aria-label="Edit target"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            className="p-1.5 rounded-lg text-tx-4 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            onClick={() => deleteTarget(wt.id)}
                            aria-label="Delete target"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      {/* Ring + amounts */}
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ transform: "rotate(-90deg)" }}>
                            <defs>
                              <linearGradient id={ringId} x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={ringColor} stopOpacity="0.5" />
                                <stop offset="100%" stopColor={ringColor} />
                              </linearGradient>
                            </defs>
                            <circle cx={ringCx} cy={ringCy} r={ringR} fill="none" stroke="rgba(var(--surface-rgb),0.09)" strokeWidth="6" />
                            <circle cx={ringCx} cy={ringCy} r={ringR} fill="none" stroke={`url(#${ringId})`} strokeWidth="6"
                              strokeDasharray={`${ringDash} ${ringCirc}`} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            {progressPct >= 100 ? (
                              <span className="text-[16px] leading-none">🎉</span>
                            ) : (
                              <>
                                <span className="text-[12px] font-black leading-none tabular-nums" style={{ color: ringColor }}>{progressPct.toFixed(0)}%</span>
                                <span className="text-[7px] text-tx-4 uppercase mt-0.5">saved</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-bold text-tx-1 tabular-nums">{fmtGBP(wt.saved)}</span>
                            <span className="text-[10px] text-tx-4">/ {fmtGBP(wt.target)}</span>
                          </div>
                          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${ringColor}99, ${ringColor})` }} />
                          </div>
                          <div className="flex justify-between mt-1 text-[10px]">
                            <span className="text-tx-4">
                              {wt.monthly > 0 && <span className="text-tx-3">{fmtGBP(wt.monthly)}/mo</span>}
                            </span>
                            {monthsToTarget !== null && progressPct < 100 && (
                              <span className="text-tx-3">ETA: <span className="text-tx-2 font-medium">{monthsToTarget < 12 ? `${monthsToTarget}mo` : `${Math.floor(monthsToTarget / 12)}y ${monthsToTarget % 12}mo`}</span></span>
                            )}
                            {progressPct >= 100 && <span className="font-bold text-profit">Complete!</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Subscriptions ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-accent" />
                <h2 className="font-semibold text-tx-1">Subscriptions</h2>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: bwColor("rgba(14,184,154,0.08)", isBW), color: bwColor("#1dd4b4", isBW), border: `1px solid ${bwColor("rgba(14,184,154,0.15)", isBW)}` }}
                >
                  {fmtGBP(totalMonthlySubs)}/mo
                </span>
              </div>
              <button className="btn-primary btn-sm" onClick={() => setShowAddSub(true)}>
                <Plus size={12} /> Add
              </button>
            </div>
            {activeSubs.length > 0 && (
              <div
                className="flex items-center justify-between px-3 py-2 rounded-lg mb-3"
                style={{ background: "rgba(14,184,154,0.05)", border: "1px solid rgba(14,184,154,0.1)" }}
              >
                <span className="text-xs text-tx-3">Annual cost</span>
                <span className="text-sm font-semibold tabular-nums text-tx-1">{fmtGBP(annualSubCost)} / yr</span>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {subscriptions.length === 0 && (
                <p className="text-xs text-tx-3 text-center py-4">No subscriptions added.</p>
              )}
              {/* Active subscriptions */}
              {activeSubs.map((sub) => {
                const monthlyCost = monthlySubCost(sub);
                const days = daysUntil(sub.nextRenewal);
                const isUrgent = days >= 0 && days <= 7;
                const isUpcoming = days >= 0 && days <= 14 && !isUrgent;
                const shareOfTotal = totalMonthlySubs > 0 ? (monthlyCost / totalMonthlySubs) * 100 : 0;
                const urgentColor = isUrgent ? "#ef4444" : isUpcoming ? "#f59e0b" : undefined;
                return (
                  <div
                    key={sub.id}
                    className="group flex flex-col gap-2 px-4 py-3 rounded-xl transition-colors"
                    style={{
                      background: isUrgent ? "rgba(239,68,68,0.04)" : "rgba(14,184,154,0.03)",
                      border: `1px solid ${isUrgent ? "rgba(239,68,68,0.15)" : isUpcoming ? "rgba(245,158,11,0.15)" : "rgba(14,184,154,0.07)"}`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-tx-1">{sub.name}</span>
                          {isUrgent && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                              style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                              {days === 0 ? "Today" : `${days}d`}
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                              {days}d
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-tx-3">
                          <span style={{ color: urgentColor }}>Renews {fmtShortDate(sub.nextRenewal)}</span>
                          {sub.notes && <><span>·</span><span className="truncate max-w-[120px]">{sub.notes}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-tx-1 tabular-nums">{fmtGBP(monthlyCost)}/mo</div>
                          {sub.frequency !== "monthly" && (
                            <div className="text-xs text-tx-3">{fmtGBP(sub.amount)}/{sub.frequency === "yearly" ? "yr" : "wk"}</div>
                          )}
                        </div>
                        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button className="p-1.5 text-tx-3 hover:text-tx-1 transition-colors" title="Edit" onClick={() => setEditSub(sub)}><Edit2 size={12} /></button>
                          <button className="p-1.5 text-tx-3 hover:text-warn transition-colors" title="Stop subscription" onClick={() => handleCancelSub(sub.id)}><PauseCircle size={12} /></button>
                          <button className="p-1.5 text-tx-3 hover:text-loss transition-colors" title="Delete" onClick={() => setDeleteSubId(sub.id)}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                    {/* Cost share bar */}
                    <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(var(--surface-rgb),0.08)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${shareOfTotal}%`,
                          background: isUrgent ? "#ef444466" : isUpcoming ? "#f59e0b66" : "rgba(14,184,154,0.5)",
                        }} />
                    </div>
                  </div>
                );
              })}

              {/* Cancelled subscriptions */}
              {cancelledSubs.length > 0 && (
                <div className="mt-2">
                  <p className="text-[10px] font-semibold text-tx-4 uppercase tracking-wider mb-2 px-1">Stopped</p>
                  <div className="flex flex-col gap-1.5">
                    {cancelledSubs.map((sub) => (
                      <div
                        key={sub.id}
                        className="group flex items-center justify-between px-4 py-2.5 rounded-xl opacity-50"
                        style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-sm font-medium text-tx-3 line-through">{sub.name}</span>
                          <span className="text-xs text-tx-4">
                            Stopped {sub.cancelledAt ? fmtShortDate(sub.cancelledAt) : ""}
                            {sub.notes && <> · {sub.notes}</>}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-tx-4 tabular-nums">{fmtGBP(monthlySubCost(sub))}/mo</span>
                          <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <button className="p-1.5 text-tx-4 hover:text-profit transition-colors" title="Reactivate" onClick={() => handleReactivateSub(sub.id)}><PlayCircle size={12} /></button>
                            <button className="p-1.5 text-tx-4 hover:text-loss transition-colors" title="Delete" onClick={() => setDeleteSubId(sub.id)}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {activeSubs.length > 0 && (
              <div className="mt-3 pt-3 border-t flex justify-between text-sm" style={{ borderColor: "rgba(14,184,154,0.06)" }}>
                <span className="text-tx-3">Total monthly cost</span>
                <span className="font-semibold text-tx-1">{fmtGBP(totalMonthlySubs)}</span>
              </div>
            )}
          </div>

        </div>{/* end main column */}

        {/* ── RIGHT SIDEBAR ── */}
        <InvestmentSidebar
          investments={investments}
          pieData={pieData}
          subscriptions={subscriptions}
          stats={stats}
        />

      </div>{/* end 2-col grid */}

      {/* ── Modals ── */}

      {/* Add investment */}
      <InvestmentFormModal
        open={showAddInv}
        onClose={() => setShowAddInv(false)}
        onSave={handleAddInvestment}
        title="Add Holding"
      />

      {/* Edit investment */}
      {editInv && (
        <InvestmentFormModal
          key={editInv.id}
          open={!!editInv}
          onClose={() => setEditInv(null)}
          onSave={(form) => {
            handleEditInvestment(editInv.id, form);
            setEditInv(null);
          }}
          initial={{
            ticker: editInv.ticker,
            name: editInv.name,
            type: editInv.type,
            units: editInv.units,
            buy: editInv.buy,
            cur: editInv.cur,
          }}
          title={`Edit — ${editInv.ticker}`}
        />
      )}

      {/* Delete investment confirm */}
      {deleteInvId && (
        <Modal
          open={!!deleteInvId}
          onClose={() => setDeleteInvId(null)}
          title="Remove Holding"
          size="sm"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-tx-2">
              Are you sure you want to remove this holding?
            </p>
            <div className="flex gap-2">
              <button
                className="btn-ghost flex-1 btn-sm"
                onClick={() => setDeleteInvId(null)}
              >
                Cancel
              </button>
              <button
                className="btn-danger flex-1 btn-sm"
                onClick={() => handleDeleteInvestment(deleteInvId)}
              >
                Remove
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add subscription */}
      <SubscriptionFormModal
        open={showAddSub}
        onClose={() => setShowAddSub(false)}
        onSave={handleAddSub}
        title="Add Subscription"
      />

      {/* Edit subscription */}
      {editSub && (
        <SubscriptionFormModal
          key={editSub.id}
          open={!!editSub}
          onClose={() => setEditSub(null)}
          onSave={(form) => {
            handleEditSub(editSub.id, form);
            setEditSub(null);
          }}
          initial={{
            name: editSub.name,
            amount: editSub.amount,
            frequency: editSub.frequency,
            startDate: editSub.startDate,
            nextRenewal: editSub.nextRenewal,
            notes: editSub.notes,
          }}
          title={`Edit — ${editSub.name}`}
        />
      )}

      {/* Delete subscription confirm */}
      {deleteSubId && (
        <Modal
          open={!!deleteSubId}
          onClose={() => setDeleteSubId(null)}
          title="Delete Subscription"
          size="sm"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-tx-2">
              Are you sure you want to delete this subscription?
            </p>
            <div className="flex gap-2">
              <button
                className="btn-ghost flex-1 btn-sm"
                onClick={() => setDeleteSubId(null)}
              >
                Cancel
              </button>
              <button
                className="btn-danger flex-1 btn-sm"
                onClick={() => handleDeleteSub(deleteSubId)}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add / Edit wealth target */}
      <Modal
        open={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        title={editingTargetId ? "Edit Target" : "Add Wealth Target"}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {/* Emoji + Name */}
          <div className="flex gap-2">
            <input
              className="nx-input w-16 text-center text-xl px-2"
              value={targetForm.emoji}
              onChange={(e) => setTargetForm((f) => ({ ...f, emoji: e.target.value }))}
              placeholder="e.g. HM"
            />
            <input
              className="nx-input flex-1"
              placeholder="Goal name"
              value={targetForm.name}
              onChange={(e) => setTargetForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          {/* Description */}
          <input
            className="nx-input"
            placeholder="Description (optional)"
            value={targetForm.desc}
            onChange={(e) => setTargetForm((f) => ({ ...f, desc: e.target.value }))}
          />
          {/* Target + Saved */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-tx-4 mb-1.5 block">Target (£)</label>
              <input
                type="number" min="0" step="0.01" className="nx-input"
                placeholder="10000"
                value={targetForm.target}
                onChange={(e) => setTargetForm((f) => ({ ...f, target: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-[11px] text-tx-4 mb-1.5 block">Saved so far (£)</label>
              <input
                type="number" min="0" step="0.01" className="nx-input"
                placeholder="0"
                value={targetForm.saved}
                onChange={(e) => setTargetForm((f) => ({ ...f, saved: e.target.value }))}
              />
            </div>
          </div>
          {/* Monthly contribution */}
          <div>
            <label className="text-[11px] text-tx-4 mb-1.5 block">Monthly contribution (£)</label>
            <input
              type="number" min="0" step="0.01" className="nx-input"
              placeholder="0"
              value={targetForm.monthly}
              onChange={(e) => setTargetForm((f) => ({ ...f, monthly: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn btn-ghost flex-1" onClick={() => setTargetModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary flex-1" onClick={saveTarget} disabled={!targetForm.name.trim()}>
              {editingTargetId ? "Save" : "Add Target"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
