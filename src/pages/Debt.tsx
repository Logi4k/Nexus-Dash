import { useState, useMemo } from "react";
import { PAGE_THEMES } from "@/lib/theme";
import {
  CreditCard,
  Plus,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  History,
  AlertTriangle,
  Calendar,
  TrendingDown,
  Zap,
  Snowflake,
  ArrowRight,
  Clock,
  BadgePoundSterling,
  Target,
} from "lucide-react";
import { useAppData } from "@/lib/store";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import {
  fmtGBP,
  fmtDate,
  toNum,
  pct,
  cn,
  daysUntil,
  monthlyInterest,
  generateId,
} from "@/lib/utils";
import Modal from "@/components/Modal";
import type { Debt, DebtPayment } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCardAccent(name: string): { color: string; network: string; bg: string } {
  const n = name.toLowerCase();
  if (n.includes("barclaycard") || n.includes("barclay")) {
    return { color: "#3b82f6", network: "VISA", bg: "rgba(59,130,246,0.08)" };
  }
  if (n.includes("american express") || n.includes("amex")) {
    return { color: "#f0d878", network: "AMEX", bg: "rgba(240,216,120,0.08)" };
  }
  if (n.includes("mastercard") || n.includes("master")) {
    return { color: "#f97316", network: "MC", bg: "rgba(249,115,22,0.08)" };
  }
  if (n.includes("hsbc")) {
    return { color: "#ef4444", network: "VISA", bg: "rgba(239,68,68,0.08)" };
  }
  return { color: "#a78bfa", network: "VISA", bg: "rgba(167,139,250,0.08)" };
}

function utilizationColor(u: number) {
  if (u < 30) return { bar: "bg-profit", text: "text-profit", badge: "bg-profit/10 text-profit border-profit/20" };
  if (u < 70) return { bar: "bg-warn", text: "text-warn", badge: "bg-warn/10 text-warn border-warn/20" };
  return { bar: "bg-loss", text: "text-loss", badge: "bg-loss/10 text-loss border-loss/20" };
}

function calcPayoff(balance: number, rate: number, monthly: number) {
  const mi = monthlyInterest(balance, rate);
  if (monthly <= mi || balance <= 0) return null;
  const r = rate / 1200;
  if (r === 0) {
    const months = Math.ceil(balance / monthly);
    return { months, totalInterest: 0 };
  }
  const months = -Math.log(1 - (r * balance) / monthly) / Math.log(1 + r);
  const totalPaid = Math.ceil(months) * monthly;
  const totalInterest = Math.max(0, totalPaid - balance);
  return { months: Math.ceil(months), totalInterest };
}

function fmtMonths(m: number) {
  if (m < 12) return `${m}mo`;
  return `${Math.floor(m / 12)}y ${m % 12}mo`;
}

function emptyDebtForm(): Omit<Debt, "id" | "payments"> {
  return {
    name: "",
    creditLimit: 0,
    currentBalance: 0,
    rate: 0,
    monthly: 0,
    nextPayment: new Date().toISOString().slice(0, 10),
    network: "",
    lastFour: "",
  };
}

// ─── Log Payment Modal ────────────────────────────────────────────────────────

function LogPaymentModal({
  debt, open, onClose, onSave,
}: { debt: Debt; open: boolean; onClose: () => void; onSave: (p: DebtPayment) => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  function handleSave() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    onSave({ id: generateId(), date, amount: amt, notes });
    setDate(new Date().toISOString().slice(0, 10));
    setAmount("");
    setNotes("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Log Payment - ${debt.name}`} size="sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Date</label>
          <input type="date" className="nx-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Amount (GBP)</label>
          <input type="number" className="nx-input" placeholder="0.00" value={amount}
            onChange={(e) => setAmount(e.target.value)} min="0" step="0.01" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Notes (optional)</label>
          <input type="text" className="nx-input" placeholder="e.g. Minimum payment" value={notes}
            onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <button className="btn-ghost flex-1 btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-success flex-1 btn-sm" onClick={handleSave}>Log Payment</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Add / Edit Debt Modal ────────────────────────────────────────────────────

function DebtFormModal({
  open, onClose, onSave, initial, title,
}: {
  open: boolean; onClose: () => void; onSave: (d: Omit<Debt, "id" | "payments">) => void;
  initial?: Omit<Debt, "id" | "payments">; title: string;
}) {
  const [form, setForm] = useState<Omit<Debt, "id" | "payments">>(initial ?? emptyDebtForm());
  const key = initial ? JSON.stringify(initial) : "new";

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }
  function handleSave() {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      creditLimit: toNum(form.creditLimit),
      currentBalance: toNum(form.currentBalance),
      rate: toNum(form.rate),
      monthly: toNum(form.monthly),
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md" key={key}>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Card Name</label>
          <input className="nx-input" placeholder="e.g. Barclaycard Avios" value={form.name}
            onChange={(e) => setField("name", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Credit Limit (GBP)</label>
          <input type="number" className="nx-input" value={form.creditLimit || ""}
            onChange={(e) => setField("creditLimit", parseFloat(e.target.value) || 0)} min="0" step="0.01" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Current Balance (GBP)</label>
          <input type="number" className="nx-input" value={form.currentBalance || ""}
            onChange={(e) => setField("currentBalance", parseFloat(e.target.value) || 0)} min="0" step="0.01" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">APR (%)</label>
          <input type="number" className="nx-input" value={form.rate || ""}
            onChange={(e) => setField("rate", parseFloat(e.target.value) || 0)} min="0" step="0.1" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Monthly Payment (GBP)</label>
          <input type="number" className="nx-input" value={form.monthly || ""}
            onChange={(e) => setField("monthly", parseFloat(e.target.value) || 0)} min="0" step="0.01" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Next Payment Date</label>
          <input type="date" className="nx-input" value={form.nextPayment}
            onChange={(e) => setField("nextPayment", e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Last Four Digits</label>
          <input type="text" className="nx-input" placeholder="1234" maxLength={4}
            value={form.lastFour ?? ""} onChange={(e) => setField("lastFour", e.target.value)} />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-xs text-tx-3">Network (optional)</label>
          <select className="nx-select" value={form.network ?? ""}
            onChange={(e) => setField("network", e.target.value)}>
            <option value="">Auto-detect from name</option>
            <option value="VISA">VISA</option>
            <option value="AMEX">AMEX</option>
            <option value="Mastercard">Mastercard</option>
          </select>
        </div>
        <div className="col-span-2 flex gap-2 pt-1">
          <button className="btn-ghost flex-1 btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 btn-sm" onClick={handleSave}>Save Card</button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Compact Debt Card ────────────────────────────────────────────────────────

function DebtRow({
  debt,
  expanded,
  onToggle,
  onLogPayment,
  onEdit,
  onDelete,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  debt: Debt;
  expanded: boolean;
  onToggle: () => void;
  onLogPayment: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleteConfirm: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}) {
  const bw = useBWMode();
  const rawAccent = getCardAccent(debt.name);
  const accent = { color: bwColor(rawAccent.color, bw), network: rawAccent.network, bg: bwColor(rawAccent.bg, bw) };
  const utilPct = pct(debt.currentBalance, debt.creditLimit);
  const colors = utilizationColor(utilPct);
  const mi = monthlyInterest(debt.currentBalance, debt.rate);
  const days = daysUntil(debt.nextPayment);
  const network = debt.network || accent.network;

  const totalPaid = (debt.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const originalBalance = debt.currentBalance + totalPaid;
  const paidOffPct = originalBalance > 0 ? (totalPaid / originalBalance) * 100 : 0;

  return (
    <div className="card overflow-hidden">
      {/* Compact header row */}
      <div className="flex items-center gap-3 p-4">
        {/* Network badge */}
        <div
          className="w-10 h-7 rounded-md flex items-center justify-center text-[10px] font-bold tracking-wider shrink-0"
          style={{ background: accent.bg, color: accent.color, border: `1px solid ${accent.color}30` }}
        >
          {network}
        </div>

        {/* Name + card number */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-tx-1 truncate">{debt.name}</span>
            {debt.lastFour && (
              <span className="text-[10px] text-tx-4 font-mono shrink-0">••{debt.lastFour}</span>
            )}
          </div>
          {/* Utilization mini-bar */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-white/[0.07] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
                style={{ width: `${Math.min(utilPct, 100)}%` }}
              />
            </div>
            <span className={cn("text-[10px] font-semibold shrink-0", colors.text)}>
              {utilPct.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Key stats */}
        <div className="hidden sm:flex items-center gap-5 shrink-0">
          <div className="text-center">
            <div className="text-[10px] text-tx-4 uppercase">Balance</div>
            <div className="text-sm font-bold text-loss tabular-nums">{fmtGBP(debt.currentBalance)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-tx-4 uppercase">APR</div>
            <div className="text-sm font-semibold text-tx-1 tabular-nums">{debt.rate}%</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-tx-4 uppercase">Mo. Interest</div>
            <div className="text-sm font-semibold text-warn tabular-nums">{fmtGBP(mi)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-tx-4 uppercase">Due</div>
            <div className={cn(
              "text-sm font-semibold tabular-nums",
              days < 0 ? "text-loss" : days <= 7 ? "text-warn" : "text-tx-1"
            )}>
              {days < 0 ? `${Math.abs(days)}d late` : days === 0 ? "Today" : `${days}d`}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {deleteConfirm ? (
            <>
              <button onClick={onDeleteConfirm} className="text-[10px] px-2 py-1 rounded bg-loss/15 text-loss hover:bg-loss/25 transition-all font-semibold">Delete</button>
              <button onClick={onDeleteCancel} className="text-[10px] px-2 py-1 rounded bg-white/[0.05] text-tx-3 hover:text-tx-1 transition-all">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={onLogPayment} className="btn-success btn-sm text-[11px] px-2.5 py-1">Pay</button>
              <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/[0.07] text-tx-3 hover:text-tx-1 transition-all">
                <Edit2 size={12} />
              </button>
              <button onClick={onDelete} className="p-1.5 rounded hover:bg-loss/10 text-tx-4 hover:text-loss transition-all">
                <Trash2 size={12} />
              </button>
              <button onClick={onToggle} className="p-1.5 rounded hover:bg-white/[0.07] text-tx-4 transition-all">
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Payoff progress bar */}
      {totalPaid > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-tx-4">Paid off</span>
            <span className="text-[10px] font-semibold text-tx-3">{Math.min(paidOffPct, 100).toFixed(0)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-1 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(paidOffPct, 100)}%`, background: paidOffPct >= 75 ? "#22c55e" : paidOffPct >= 40 ? "#f59e0b" : "#ef4444" }}
            />
          </div>
        </div>
      )}

      {/* Mobile stats row */}
      <div className="sm:hidden flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 border-t border-white/[0.05] pt-2">
        <span className="text-xs text-tx-4">Balance: <span className="text-loss font-semibold">{fmtGBP(debt.currentBalance)}</span></span>
        <span className="text-xs text-tx-4">APR: <span className="text-tx-1 font-semibold">{debt.rate}%</span></span>
        <span className="text-xs text-tx-4">Due: <span className={cn("font-semibold", days < 0 ? "text-loss" : days <= 7 ? "text-warn" : "text-tx-1")}>{days < 0 ? `${Math.abs(days)}d late` : `${days}d`}</span></span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/[0.05] p-4">
          {/* Utilization + limits */}
          <div className="flex justify-between text-xs text-tx-3 mb-2">
            <span>{fmtGBP(debt.currentBalance)} balance · {fmtGBP(debt.creditLimit - debt.currentBalance)} available</span>
            <span>Next payment: {fmtDate(debt.nextPayment)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden mb-4">
            <div
              className={cn("h-full rounded-full transition-all duration-700", colors.bar)}
              style={{ width: `${Math.min(utilPct, 100)}%` }}
            />
          </div>

          {/* Payment history */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-tx-3 flex items-center gap-1"><History size={11} />Payment History ({(debt.payments ?? []).length})</span>
          </div>
          {(debt.payments ?? []).length === 0 ? (
            <p className="text-xs text-tx-4 text-center py-3">No payments logged yet</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {(debt.payments ?? []).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-tx-2">{fmtDate(p.date)}</span>
                    {p.notes && <span className="text-tx-4 text-[10px]">{p.notes}</span>}
                  </div>
                  <span className="font-semibold text-profit">-{fmtGBP(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Strategy Comparison ──────────────────────────────────────────────────────

function StrategyPanel({ debts }: { debts: Debt[] }) {
  const isBW = useBWMode();
  const [extraMonthly, setExtraMonthly] = useState(50);

  const totalMinimum = debts.reduce((s, d) => s + d.monthly, 0);
  const totalInterest0 = useMemo(() =>
    debts.reduce((s, d) => {
      const r = calcPayoff(d.currentBalance, d.rate, d.monthly);
      return s + (r?.totalInterest ?? 0);
    }, 0), [debts]);

  // Avalanche: pay extra towards highest APR first
  const avalanche = useMemo(() => {
    if (debts.length === 0) return { months: 0, interestSaved: 0 };
    const sorted = [...debts].sort((a, b) => b.rate - a.rate);
    let total = 0;
    sorted.forEach((d, i) => {
      const extra = i === 0 ? extraMonthly : 0;
      const r = calcPayoff(d.currentBalance, d.rate, d.monthly + extra);
      total += r?.totalInterest ?? 0;
    });
    return { months: Math.max(...sorted.map((d) => calcPayoff(d.currentBalance, d.rate, d.monthly + (sorted[0].id === d.id ? extraMonthly : 0))?.months ?? 0)), interestSaved: totalInterest0 - total };
  }, [debts, extraMonthly, totalInterest0]);

  // Snowball: pay extra towards lowest balance first
  const snowball = useMemo(() => {
    if (debts.length === 0) return { months: 0, interestSaved: 0 };
    const sorted = [...debts].sort((a, b) => a.currentBalance - b.currentBalance);
    let total = 0;
    sorted.forEach((d, i) => {
      const extra = i === 0 ? extraMonthly : 0;
      const r = calcPayoff(d.currentBalance, d.rate, d.monthly + extra);
      total += r?.totalInterest ?? 0;
    });
    return { months: Math.max(...sorted.map((d) => calcPayoff(d.currentBalance, d.rate, d.monthly + (sorted[0].id === d.id ? extraMonthly : 0))?.months ?? 0)), interestSaved: totalInterest0 - total };
  }, [debts, extraMonthly, totalInterest0]);

  if (debts.length === 0) return null;

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Target size={15} className="text-accent" />
        <h3 className="font-semibold text-tx-1 text-sm">Payoff Strategies</h3>
      </div>

      {/* Extra monthly input */}
      <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07]">
        <span className="text-xs text-tx-3">Extra monthly budget <span className="text-tx-4">(on top of minimums)</span></span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-tx-3 shrink-0">£</span>
          <input
            type="number"
            className="nx-input text-sm py-1"
            style={{ flex: 1, minWidth: 0 }}
            value={extraMonthly}
            onChange={(e) => setExtraMonthly(parseFloat(e.target.value) || 0)}
            min="0"
            step="10"
          />
        </div>
      </div>

      {/* Strategy cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Avalanche */}
        <div className="rounded-xl p-4 border flex flex-col gap-3 bg-amber-500/[0.04] border-amber-500/15">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Zap size={12} className="text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-300">Avalanche</p>
              <p className="text-[10px] text-tx-4">Highest APR first</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-tx-4">Interest saved</span>
              <span className="text-profit font-semibold">{fmtGBP(Math.max(0, avalanche.interestSaved))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tx-4">Total interest</span>
              <span className="text-warn tabular-nums">{fmtGBP(totalInterest0)}</span>
            </div>
          </div>
          <div className="text-[10px] text-tx-4 pt-1 border-t border-white/[0.05]">
            ✓ Best for minimising total interest paid
          </div>
        </div>

        {/* Snowball */}
        <div className="rounded-xl p-4 border flex flex-col gap-3 bg-blue-500/[0.04] border-blue-500/15">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Snowflake size={12} className="text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-300">Snowball</p>
              <p className="text-[10px] text-tx-4">Lowest balance first</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-tx-4">Interest saved</span>
              <span className="text-profit font-semibold">{fmtGBP(Math.max(0, snowball.interestSaved))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-tx-4">First payoff</span>
              <span className="text-blue-300 font-semibold">
                {fmtMonths([...debts].sort((a, b) => a.currentBalance - b.currentBalance).map((d) => calcPayoff(d.currentBalance, d.rate, d.monthly + extraMonthly)?.months ?? 999)[0] ?? 0)}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-tx-4 pt-1 border-t border-white/[0.05]">
            ✓ Builds momentum by clearing cards fast
          </div>
        </div>
      </div>

      {/* Payoff order */}
      <div>
        <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-2">Payoff Order (Avalanche)</p>
        {[...debts]
          .sort((a, b) => b.rate - a.rate)
          .map((d, i) => {
            const r = calcPayoff(d.currentBalance, d.rate, d.monthly + (i === 0 ? extraMonthly : 0));
            const rawAcc = getCardAccent(d.name);
            const accent = { color: bwColor(rawAcc.color, isBW), network: rawAcc.network, bg: bwColor(rawAcc.bg, isBW) };
            return (
              <div key={d.id} className="flex items-center gap-2 py-1.5 border-b border-white/[0.04] last:border-0">
                <span className="text-[10px] text-tx-4 w-4 shrink-0">{i + 1}.</span>
                <div
                  className="w-8 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0"
                  style={{ background: accent.bg, color: accent.color }}
                >
                  {d.network || accent.network}
                </div>
                <span className="text-xs text-tx-2 flex-1 truncate">{d.name}</span>
                <span className="text-xs font-mono text-warn shrink-0">{d.rate}%</span>
                <ArrowRight size={10} className="text-tx-4 shrink-0" />
                <span className="text-xs text-tx-3 shrink-0">{r ? fmtMonths(r.months) : "∞"}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DebtPage() {
  const { data, update } = useAppData();
  const debts: Debt[] = data.debts ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logPaymentDebt, setLogPaymentDebt] = useState<Debt | null>(null);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.debt, isBW);
  const bwAccent = (name: string) => {
    const raw = getCardAccent(name);
    return { color: bwColor(raw.color, isBW), network: raw.network, bg: bwColor(raw.bg, isBW) };
  };
  const stats = useMemo(() => {
    const totalDebt     = debts.reduce((s, d) => s + d.currentBalance, 0);
    const totalLimit    = debts.reduce((s, d) => s + d.creditLimit, 0);
    const overallUtil   = pct(totalDebt, totalLimit);
    const totalInterest = debts.reduce((s, d) => s + monthlyInterest(d.currentBalance, d.rate), 0);
    const totalPayoff   = debts.reduce((s, d) => {
      const r = calcPayoff(d.currentBalance, d.rate, d.monthly);
      return s + (r?.totalInterest ?? 0);
    }, 0);
    const soonest = debts.filter((d) => daysUntil(d.nextPayment) >= 0)
      .sort((a, b) => daysUntil(a.nextPayment) - daysUntil(b.nextPayment))[0];
    // Paydown progress (from payment history)
    const totalPaid = debts.reduce((s, d) => s + (d.payments ?? []).reduce((ps, p) => ps + p.amount, 0), 0);
    const originalTotal = totalDebt + totalPaid;
    const paydownPct = originalTotal > 0 ? (totalPaid / originalTotal) * 100 : 0;
    // Debt freedom projection
    const payoffMonths = debts.map((d) => calcPayoff(d.currentBalance, d.rate, d.monthly)?.months ?? 0);
    const debtFreedomMonths = payoffMonths.length > 0 ? Math.max(...payoffMonths) : 0;
    const debtFreedomDate = (() => {
      if (debtFreedomMonths <= 0 || debts.length === 0) return null;
      const dt = new Date();
      dt.setMonth(dt.getMonth() + Math.ceil(debtFreedomMonths));
      return dt.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    })();
    return { totalDebt, totalLimit, overallUtil, totalInterest, totalPayoff, soonest, totalPaid, paydownPct, originalTotal, debtFreedomMonths, debtFreedomDate };
  }, [debts]);

  function handleLogPayment(debtId: string, payment: DebtPayment) {
    update((prev) => ({
      ...prev,
      debts: prev.debts.map((d) =>
        d.id === debtId
          ? { ...d, currentBalance: Math.max(0, d.currentBalance - payment.amount), payments: [payment, ...(d.payments ?? [])] }
          : d
      ),
    }));
  }

  function handleAddDebt(form: Omit<Debt, "id" | "payments">) {
    const newDebt: Debt = { ...form, id: generateId(), payments: [] };
    update((prev) => ({ ...prev, debts: [...prev.debts, newDebt] }));
  }

  function handleEditDebt(debtId: string, form: Omit<Debt, "id" | "payments">) {
    update((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === debtId ? { ...d, ...form } : d)),
    }));
  }

  function handleDeleteDebt(id: string) {
    update((prev) => ({ ...prev, debts: prev.debts.filter((d) => d.id !== id) }));
    setDeleteConfirm(null);
  }

  const utilColors = utilizationColor(stats.overallUtil);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Debt</div>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="page-title">Debt Tracker</h1>
          <button className="btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
            <Plus size={14} />
            Add Card
          </button>
        </div>
      </div>

      {/* ── Two column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

        {/* ── LEFT: Cards list + projections ── */}
        <div className="flex flex-col gap-4">

          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Debt",   value: fmtGBP(stats.totalDebt),     cls: "text-loss", borderColor: "#ef4444" },
              { label: "Credit Limit", value: fmtGBP(stats.totalLimit),     cls: "text-tx-1", borderColor: "rgba(255,255,255,0.15)" },
              {
                label: "Utilization",
                value: `${stats.overallUtil.toFixed(1)}%`,
                cls: utilColors.text,
                borderColor: stats.overallUtil >= 70 ? "#ef4444" : stats.overallUtil >= 30 ? "#f59e0b" : "#22c55e",
                sub: stats.overallUtil > 30 ? "Above 30%" : "Healthy",
              },
              { label: "Mo. Interest", value: fmtGBP(stats.totalInterest), cls: "text-warn", borderColor: "#f59e0b", sub: "Cost of carrying" },
            ].map((s) => (
              <div
                key={s.label}
                className="card p-3.5 flex flex-col gap-1"
                style={{ borderLeft: `2px solid ${s.borderColor}` }}
              >
                <span className="text-[10px] uppercase tracking-wider text-tx-3">{s.label}</span>
                <span className={cn("text-lg font-bold tabular-nums", s.cls)}>{s.value}</span>
                {s.sub && <span className="text-[10px] text-tx-4">{s.sub}</span>}
              </div>
            ))}
          </div>

          {/* Cards list */}
          {debts.length === 0 ? (
            <div className="card p-10 text-center flex flex-col items-center gap-3">
              <CreditCard size={32} className="text-tx-4" />
              <p className="text-tx-3 text-sm">No credit cards added yet.</p>
              <button className="btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                <Plus size={14} /> Add Your First Card
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {debts.map((debt) => (
                <DebtRow
                  key={debt.id}
                  debt={debt}
                  expanded={expandedId === debt.id}
                  onToggle={() => setExpandedId(expandedId === debt.id ? null : debt.id)}
                  onLogPayment={() => setLogPaymentDebt(debt)}
                  onEdit={() => setEditDebt(debt)}
                  onDelete={() => setDeleteConfirm(debt.id)}
                  deleteConfirm={deleteConfirm === debt.id}
                  onDeleteConfirm={() => handleDeleteDebt(debt.id)}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                />
              ))}
            </div>
          )}

          {/* Payoff projections table */}
          {debts.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown size={15} className="text-accent" />
                <h2 className="font-semibold text-tx-1 text-sm">Debt Freedom Projections</h2>
                <span className="text-xs text-tx-3">Based on minimum payments</span>
              </div>
              <div className="flex flex-col gap-3 md:hidden">
                {debts.map((d) => {
                  const r = calcPayoff(d.currentBalance, d.rate, d.monthly);
                  const acc = bwAccent(d.name);
                  return (
                    <div key={d.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className="w-8 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0"
                            style={{ background: acc.bg, color: acc.color }}
                          >
                            {d.network || acc.network}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-tx-1 truncate">{d.name}</p>
                            <p className="text-[11px] text-tx-4">{d.rate}% APR</p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-tx-2 shrink-0">{r ? fmtMonths(r.months) : "Never"}</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-tx-4">Balance</p>
                          <p className="mt-1 font-semibold text-loss tabular-nums">{fmtGBP(d.currentBalance)}</p>
                        </div>
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-tx-4">Monthly</p>
                          <p className="mt-1 font-semibold text-tx-1 tabular-nums">{fmtGBP(d.monthly)}</p>
                        </div>
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-tx-4">Interest</p>
                          <p className="mt-1 font-semibold text-warn tabular-nums">{r ? fmtGBP(r.totalInterest) : "Never"}</p>
                        </div>
                        <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-2.5">
                          <p className="text-[10px] uppercase tracking-wide text-tx-4">Payoff</p>
                          <p className="mt-1 font-semibold text-tx-1 tabular-nums">{r ? fmtMonths(r.months) : "Never"}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-tx-4">Total Debt</p>
                      <p className="mt-1 font-bold text-loss tabular-nums">{fmtGBP(stats.totalDebt)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-tx-4">Monthly</p>
                      <p className="mt-1 font-bold text-tx-1 tabular-nums">{fmtGBP(debts.reduce((s, d) => s + d.monthly, 0))}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] uppercase tracking-wide text-tx-4">Total Interest</p>
                      <p className="mt-1 font-bold text-warn tabular-nums">{fmtGBP(stats.totalPayoff)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden w-full overflow-x-auto md:block">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Card", "Balance", "APR", "Monthly", "Total Interest", "Payoff"].map((h) => (
                        <th key={h} className="text-left text-tx-4 uppercase tracking-wider font-medium pb-2 pr-4 last:pr-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {debts.map((d) => {
                      const r = calcPayoff(d.currentBalance, d.rate, d.monthly);
                      const acc = bwAccent(d.name);
                      return (
                        <tr key={d.id} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-5 rounded text-[10px] font-bold flex items-center justify-center shrink-0"
                                style={{ background: acc.bg, color: acc.color }}>
                                {d.network || acc.network}
                              </div>
                              <span className="text-tx-2 font-medium truncate max-w-[120px]">{d.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-loss font-semibold tabular-nums">{fmtGBP(d.currentBalance)}</td>
                          <td className="py-2.5 pr-4 text-tx-2 tabular-nums">{d.rate}%</td>
                          <td className="py-2.5 pr-4 text-tx-2 tabular-nums">{fmtGBP(d.monthly)}</td>
                          <td className="py-2.5 pr-4">
                            {r ? (
                              <span className="text-warn tabular-nums">{fmtGBP(r.totalInterest)}</span>
                            ) : (
                              <span className="flex items-center gap-1 text-loss">
                                <AlertTriangle size={10} /> ∞
                              </span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <span className="text-tx-1 font-medium tabular-nums">{r ? fmtMonths(r.months) : "Never"}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total row */}
                    <tr className="border-t border-white/[0.08]">
                      <td className="py-2.5 pr-4 text-tx-2 font-semibold">Total</td>
                      <td className="py-2.5 pr-4 text-loss font-bold tabular-nums">{fmtGBP(stats.totalDebt)}</td>
                      <td className="py-2.5 pr-4 text-tx-4">—</td>
                      <td className="py-2.5 pr-4 text-tx-2 font-semibold tabular-nums">{fmtGBP(debts.reduce((s, d) => s + d.monthly, 0))}</td>
                      <td className="py-2.5 pr-4 text-warn font-bold tabular-nums">{fmtGBP(stats.totalPayoff)}</td>
                      <td className="py-2.5 text-tx-4">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Visual Payoff Timeline */}
              {(() => {
                const timelineData = debts
                  .map((d) => ({ ...d, result: calcPayoff(d.currentBalance, d.rate, d.monthly), accent: bwAccent(d.name) }))
                  .filter((d) => d.result)
                  .sort((a, b) => (a.result?.months ?? 0) - (b.result?.months ?? 0));
                if (timelineData.length === 0) return null;
                const maxMo = Math.max(...timelineData.map((d) => d.result?.months ?? 0));
                return (
                  <div className="mt-5 pt-4 border-t border-white/[0.06]">
                    <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3">Payoff Timeline</p>
                    <div className="flex flex-col gap-3">
                      {timelineData.map((d) => {
                        const months = d.result?.months ?? 0;
                        const widthPct = maxMo > 0 ? (months / maxMo) * 100 : 100;
                        const dt = new Date();
                        dt.setMonth(dt.getMonth() + months);
                        const freeDate = dt.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
                        return (
                          <div key={d.id}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-tx-2 font-medium">{d.name}</span>
                              <span className="text-[10px] font-mono text-tx-3">{fmtMonths(months)} · {freeDate}</span>
                            </div>
                            <div className="h-4 rounded-lg bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2"
                                style={{ width: `${widthPct}%`, background: `linear-gradient(90deg, ${d.accent.color}55, ${d.accent.color})` }}
                              >
                                <span className="text-[10px] text-tx-2 font-bold tabular-nums shrink-0">{fmtGBP(d.currentBalance)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── RIGHT: Strategies + upcoming ── */}
        <div className="flex flex-col gap-4">

          {/* Debt Freedom */}
          {debts.length > 0 && stats.debtFreedomDate && (() => {
            const SIZE = 80, CX = 40, CY = 40, R = 32;
            const circ = 2 * Math.PI * R;
            const dash = (Math.min(stats.paydownPct, 100) / 100) * circ;
            const progressColor = stats.paydownPct >= 75 ? "#22c55e" : stats.paydownPct >= 40 ? "#4ade80" : "#16a34a";
            return (
              <div className="card p-4" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.06) 0%, transparent 100%)", borderColor: "rgba(34,197,94,0.15)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Target size={13} className="text-profit" />
                  <h3 className="font-semibold text-tx-1 text-sm">Debt Freedom</h3>
                </div>
                <div className="flex items-center gap-4">
                  {/* Progress ring */}
                  <div className="relative shrink-0">
                    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: "rotate(-90deg)" }}>
                      <defs>
                        <linearGradient id="debtFreeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={progressColor} stopOpacity="0.5" />
                          <stop offset="100%" stopColor={progressColor} />
                        </linearGradient>
                      </defs>
                      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
                      <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#debtFreeGrad)" strokeWidth="7"
                        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[14px] font-black tabular-nums leading-none text-profit">
                        {stats.paydownPct.toFixed(0)}%
                      </span>
                      <span className="text-[7px] text-tx-4 uppercase mt-0.5">paid</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-black text-profit leading-none">{stats.debtFreedomDate}</p>
                    <p className="text-[10px] text-tx-4 mt-0.5 mb-3">projected debt-free · {fmtMonths(stats.debtFreedomMonths)} away</p>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mb-1.5">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, stats.paydownPct)}%`, background: "linear-gradient(90deg, #16a34a, #22c55e)" }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-tx-3">{fmtGBP(stats.totalPaid)} paid</span>
                      <span className="text-[10px] text-tx-3">{fmtGBP(stats.totalDebt)} left</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* By Card distribution ring */}
          {debts.length > 0 && (() => {
            const total = debts.reduce((s, d) => s + d.currentBalance, 0) || 1;
            const SIZE = 100, CX = 50, CY = 50;
            const R = 38;
            const circ = 2 * Math.PI * R;
            const GAP = 3;
            let runPct = 0;
            const segments = [...debts]
              .sort((a, b) => b.currentBalance - a.currentBalance)
              .map((d) => {
                const acc = bwAccent(d.name);
                const frac = d.currentBalance / total;
                const dash = Math.max(0, frac * circ - GAP);
                const offset = -(runPct * circ);
                runPct += frac;
                return { name: d.name, amount: d.currentBalance, pct: frac * 100, dash, offset, color: acc.color };
              });
            const totalMonthly = debts.reduce((s, d) => s + d.monthly, 0);
            return (
              <div className="card p-4">
                <p className="text-[10px] text-tx-4 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
                  <CreditCard size={10} />By Card
                </p>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: "rotate(-90deg)" }}>
                      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="11" />
                      {segments.map((seg) => (
                        <circle
                          key={seg.name}
                          cx={CX} cy={CY} r={R} fill="none"
                          stroke={seg.color} strokeWidth="11"
                          strokeDasharray={`${seg.dash} ${circ}`}
                          strokeDashoffset={seg.offset}
                          strokeLinecap="butt"
                        />
                      ))}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[11px] font-black text-loss tabular-nums leading-tight">{fmtGBP(total)}</span>
                      <span className="text-[7px] text-tx-4 uppercase tracking-wider mt-0.5">total</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                    {segments.map((seg) => (
                      <div key={seg.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: seg.color }} />
                            <span className="text-[11px] text-tx-2 font-medium truncate max-w-[90px]">{seg.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-tx-3 tabular-nums font-mono">{fmtGBP(seg.amount)}</span>
                            <span className="text-[10px] font-bold tabular-nums" style={{ color: seg.color }}>{seg.pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${seg.pct}%`, background: `linear-gradient(90deg, ${seg.color}80, ${seg.color})` }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="mt-1 pt-2 border-t border-white/[0.05] flex items-center justify-between">
                      <span className="text-[10px] text-tx-4">Monthly commitment</span>
                      <span className="text-[12px] font-bold text-warn tabular-nums font-mono">{fmtGBP(totalMonthly)}<span className="text-tx-4 text-[10px] font-normal">/mo</span></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Upcoming payments */}
          {debts.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} className="text-accent" />
                <h3 className="font-semibold text-tx-1 text-sm">Upcoming Payments</h3>
              </div>
              <div className="flex flex-col gap-2">
                {[...debts]
                  .sort((a, b) => daysUntil(a.nextPayment) - daysUntil(b.nextPayment))
                  .map((d) => {
                    const days = daysUntil(d.nextPayment);
                    const acc = bwAccent(d.name);
                    const isPast = days < 0;
                    const isSoon = days >= 0 && days <= 7;
                    return (
                      <div key={d.id} className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all",
                        isPast ? "bg-loss/[0.05] border-loss/15" :
                        isSoon ? "bg-warn/[0.05] border-warn/15" :
                        "bg-white/[0.03] border-white/[0.07]"
                      )}>
                        <div className="w-9 h-6 rounded text-[10px] font-bold flex items-center justify-center shrink-0"
                          style={{ background: acc.bg, color: acc.color }}>
                          {d.network || acc.network}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-tx-1 truncate">{d.name}</p>
                          <p className="text-[10px] text-tx-4">{fmtDate(d.nextPayment)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-tx-1 tabular-nums">{fmtGBP(d.monthly)}</p>
                          <p className={cn(
                            "text-[10px] font-medium",
                            isPast ? "text-loss" : isSoon ? "text-warn" : "text-tx-4"
                          )}>
                            {isPast ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `${days}d`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Strategies panel */}
          {debts.length > 0 && <StrategyPanel debts={debts} />}

          {/* Interest insight */}
          {debts.length > 0 && stats.totalPayoff > 0 && (
            <div className="card p-4 bg-gradient-to-br from-warn/[0.06] to-transparent border-warn/10">
              <div className="flex items-center gap-2 mb-2">
                <BadgePoundSterling size={14} className="text-warn" />
                <h3 className="font-semibold text-tx-1 text-sm">Interest Insight</h3>
              </div>
              <p className="text-xs text-tx-3 leading-relaxed">
                At minimum payments, you'll pay <span className="text-warn font-semibold">{fmtGBP(stats.totalPayoff)}</span> in interest on top of your {fmtGBP(stats.totalDebt)} debt.
                Adding even <span className="text-profit font-semibold">£50/mo</span> extra can save hundreds.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {logPaymentDebt && (
        <LogPaymentModal
          debt={logPaymentDebt}
          open={!!logPaymentDebt}
          onClose={() => setLogPaymentDebt(null)}
          onSave={(payment) => { handleLogPayment(logPaymentDebt.id, payment); setLogPaymentDebt(null); }}
        />
      )}

      <DebtFormModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleAddDebt}
        title="Add Credit Card"
      />

      {editDebt && (
        <DebtFormModal
          open={!!editDebt}
          onClose={() => setEditDebt(null)}
          onSave={(form) => { handleEditDebt(editDebt.id, form); setEditDebt(null); }}
          initial={editDebt}
          title={`Edit — ${editDebt.name}`}
        />
      )}
    </div>
  );
}
