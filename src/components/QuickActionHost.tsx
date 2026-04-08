import { useEffect, useMemo, useState } from "react";
import { Briefcase, NotebookPen, Receipt, Wallet, Zap } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import DatePicker from "@/components/DatePicker";
import TimePicker from "@/components/TimePicker";
import CustomSelect from "@/components/CustomSelect";
import { formatAccountOptionLabel, isActiveAccount } from "@/lib/accountStatus";
import { reconcileLinkedPayoutAccounts } from "@/lib/payouts";
import { normalizeAccountWithPropRules } from "@/lib/propRules";
import { useAppData } from "@/lib/store";
import { inferTradeAccountPhase } from "@/lib/tradePhases";
import { FUTURES_CONTRACTS, generateId, getEasternTimeZoneAbbreviation, toNum } from "@/lib/utils";
import type { Account, AccountStatus, AppData, Expense, TradeEntry, Withdrawal } from "@/types";
import type { QuickAction } from "@/lib/quickActions";

const INSTRUMENTS = ["ES", "NQ", "YM", "RTY", "CL", "GC", "MES", "MNQ", "MYM", "MCL", "MGC", "Other"];
const SESSIONS = ["Asia", "London", "New York", "London Close", "Other"];
const EXPENSE_CATS = ["account", "subscription", "other"] as const;
const FIRMS = [
  "Lucid Trading",
  "Tradeify",
  "Topstep",
  "FundingTicks",
  "MyFundedFX",
  "Take Profit Trader",
  "Maven Trading",
] as const;

const FIRM_FEES: Record<string, Record<string, number>> = {
  lucid: {
    ES: 1.75, MES: 0.5,
    NQ: 1.75, MNQ: 0.5,
    YM: 1.75, MYM: 0.5,
    RTY: 1.75, M2K: 0.5,
    CL: 2.0, MCL: 0.5,
    GC: 2.3, MGC: 0.8,
    DEFAULT: 1.75,
  },
  tradeify: {
    ES: 2.84, MES: 0.87,
    NQ: 2.84, MNQ: 0.87,
    YM: 2.84, MYM: 0.87,
    RTY: 2.84, M2K: 0.87,
    CL: 2.84, MCL: 1.02,
    GC: 1.02, MGC: 1.02,
    DEFAULT: 1.74,
  },
};

const POINT_VALUE: Record<string, number> = Object.fromEntries(
  FUTURES_CONTRACTS.map((contract) => [contract.symbol, contract.pointValue])
);

type TradeFormState = {
  date: string;
  time: string;
  instrument: string;
  direction: "long" | "short";
  entryPrice: string;
  exitPrice: string;
  contracts: string;
  pnl: string;
  fees: string;
  setup: string;
  session: string;
  notes: string;
  firm: "" | "lucid" | "tradeify";
  accountId?: string;
};

type ExpenseFormState = {
  date: string;
  cat: "" | (typeof EXPENSE_CATS)[number];
  firm: string;
  customFirm: string;
  amount: string;
};

type AccountFormState = {
  firm: string;
  type: string;
  name: string;
  status: AccountStatus;
  balance: string;
  initialBalance: string;
  mll: string;
};

type PayoutFormState = {
  firm: string;
  date: string;
  gross: string;
  accountId: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentTimeHHMM(): string {
  return new Date().toTimeString().slice(0, 5);
}

function getFeePerSide(firm: "" | "lucid" | "tradeify", instrument: string): number {
  if (!firm) return 0;
  const table = FIRM_FEES[firm];
  if (!table) return 0;
  return table[instrument] ?? table.DEFAULT ?? 0;
}

function createTradeDefaults(): TradeFormState {
  return {
    date: todayISO(),
    time: currentTimeHHMM(),
    instrument: "ES",
    direction: "long",
    entryPrice: "",
    exitPrice: "",
    contracts: "1",
    pnl: "",
    fees: "",
    setup: "",
    session: "New York",
    notes: "",
    firm: "",
    accountId: undefined,
  };
}

function createExpenseDefaults(): ExpenseFormState {
  return {
    date: todayISO(),
    cat: "",
    firm: FIRMS[0],
    customFirm: "",
    amount: "",
  };
}

function createAccountDefaults(): AccountFormState {
  return {
    firm: FIRMS[0],
    type: "50K Challenge",
    name: "",
    status: "challenge",
    balance: "50000",
    initialBalance: "50000",
    mll: "",
  };
}

function createPayoutDefaults(dataAccounts: Account[]): PayoutFormState {
  const linkedAccount = dataAccounts.find((account) => isActiveAccount(account));
  return {
    firm: linkedAccount?.firm ?? FIRMS[0],
    date: todayISO(),
    gross: "",
    accountId: linkedAccount?.id ?? "",
  };
}

function ActionButton({
  active,
  colorVar,
  children,
  onClick,
}: {
  active: boolean;
  colorVar: string; // CSS variable name, e.g. "var(--color-profit)"
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
      style={{
        background: active ? `color-mix(in srgb, ${colorVar} 12%, transparent)` : "rgba(var(--surface-rgb),0.05)",
        border: `1px solid ${active ? `color-mix(in srgb, ${colorVar} 40%, transparent)` : "rgba(var(--border-rgb),0.1)"}`,
        color: active ? colorVar : "var(--tx-3)",
      }}
    >
      {children}
    </button>
  );
}

function AddTradeQuickModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const [form, setForm] = useState<TradeFormState>(createTradeDefaults);

  useEffect(() => {
    if (!open) return;
    setForm(createTradeDefaults());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const { firm, entryPrice, exitPrice, contracts, instrument, direction } = form;
    if (!firm || !entryPrice || !exitPrice || !contracts) return;

    const entry = parseFloat(entryPrice);
    const exit = parseFloat(exitPrice);
    const qty = parseInt(contracts, 10);
    if (Number.isNaN(entry) || Number.isNaN(exit) || Number.isNaN(qty) || qty <= 0) return;

    const pointValue = POINT_VALUE[instrument] ?? 1;
    const priceDiff = direction === "long" ? exit - entry : entry - exit;
    const grossPnl = priceDiff * pointValue * qty;
    const totalFees = getFeePerSide(firm, instrument) * 2 * qty;

    setForm((prev) => ({
      ...prev,
      pnl: grossPnl.toFixed(2),
      fees: totalFees.toFixed(2),
    }));
  }, [form.contracts, form.direction, form.entryPrice, form.exitPrice, form.firm, form.instrument, open]);

  const accountOptions = useMemo(
    () =>
      data.accounts
        .filter((account) => isActiveAccount(account))
        .map((account) => ({
          value: account.id,
          label: formatAccountOptionLabel(account, { includeFirm: false }),
        })),
    [data.accounts]
  );
  const accountsById = useMemo(
    () => new Map(data.accounts.map((account) => [account.id, account])),
    [data.accounts]
  );

  function handleSave() {
    if (!form.entryPrice || !form.exitPrice) return;

    const selectedAccount = form.accountId ? accountsById.get(form.accountId) : undefined;
    const accountPhase = form.accountId
      ? inferTradeAccountPhase({ date: form.date }, selectedAccount, data.passedChallenges ?? []) ?? undefined
      : undefined;

    const trade: TradeEntry = {
      id: generateId(),
      date: form.date,
      time: form.time,
      instrument: form.instrument,
      direction: form.direction,
      entryPrice: parseFloat(form.entryPrice) || 0,
      exitPrice: parseFloat(form.exitPrice) || 0,
      contracts: parseInt(form.contracts, 10) || 1,
      pnl: parseFloat(form.pnl) || 0,
      fees: parseFloat(form.fees) || 0,
      setup: form.setup || undefined,
      session: form.session || undefined,
      notes: form.notes || undefined,
      accountId: form.accountId || undefined,
      accountPhase,
    };

    update((prev) => ({
      ...prev,
      tradeJournal: [...(prev.tradeJournal ?? []), trade],
    }));

    toast.success("Trade logged");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Trade" size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Date</label>
            <DatePicker
              value={form.date}
              onChange={(date) => setForm((prev) => ({ ...prev, date }))}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Time ({getEasternTimeZoneAbbreviation(new Date())})</label>
            <TimePicker
              value={form.time}
              onChange={(time) => setForm((prev) => ({ ...prev, time }))}
            />
          </div>
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Instrument</label>
          <CustomSelect
            value={form.instrument}
            onChange={(instrument) => setForm((prev) => ({ ...prev, instrument }))}
            options={INSTRUMENTS.map((v) => ({ value: v, label: v }))}
            placeholder="Select instrument"
            allowCustom
            customLabel="Type instrument (e.g. NQ, MES)…"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Direction</label>
            <div className="flex gap-2">
              <ActionButton
                active={form.direction === "long"}
                colorVar="var(--color-profit)"
                onClick={() => setForm((prev) => ({ ...prev, direction: "long" }))}
              >
                Long
              </ActionButton>
              <ActionButton
                active={form.direction === "short"}
                colorVar="var(--color-loss)"
                onClick={() => setForm((prev) => ({ ...prev, direction: "short" }))}
              >
                Short
              </ActionButton>
            </div>
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Contracts</label>
            <input
              type="number"
              min="1"
              className="nx-input"
              value={form.contracts}
              onChange={(e) => setForm((prev) => ({ ...prev, contracts: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Account</label>
          <CustomSelect
            value={form.accountId ?? ""}
            onChange={(v) => setForm((prev) => ({ ...prev, accountId: v || undefined }))}
            options={accountOptions}
            placeholder="No account"
          />
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1.5 flex items-center gap-1.5">
            <Zap size={10} className="text-warn" />
            Prop Firm
          </label>
          <div className="flex gap-2">
            <ActionButton
              active={form.firm === ""}
              colorVar="var(--color-teal)"
              onClick={() => setForm((prev) => ({ ...prev, firm: "" }))}
            >
              Manual
            </ActionButton>
            <ActionButton
              active={form.firm === "lucid"}
              colorVar="var(--color-purple)"
              onClick={() => setForm((prev) => ({ ...prev, firm: "lucid" }))}
            >
              Lucid
            </ActionButton>
            <ActionButton
              active={form.firm === "tradeify"}
              colorVar="var(--color-blue)"
              onClick={() => setForm((prev) => ({ ...prev, firm: "tradeify" }))}
            >
              Tradeify
            </ActionButton>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Entry</label>
            <input
              type="number"
              step="0.25"
              className="nx-input"
              value={form.entryPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, entryPrice: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Exit</label>
            <input
              type="number"
              step="0.25"
              className="nx-input"
              value={form.exitPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, exitPrice: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">P&L</label>
            <input
              type="number"
              step="0.01"
              className="nx-input"
              value={form.pnl}
              onChange={(e) => setForm((prev) => ({ ...prev, pnl: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Fees</label>
            <input
              type="number"
              step="0.01"
              className="nx-input"
              value={form.fees}
              onChange={(e) => setForm((prev) => ({ ...prev, fees: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Setup</label>
            <input
              type="text"
              className="nx-input"
              placeholder="Break and retest"
              value={form.setup}
              onChange={(e) => setForm((prev) => ({ ...prev, setup: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Session</label>
            <CustomSelect
              value={form.session}
              onChange={(session) => setForm((prev) => ({ ...prev, session }))}
              options={SESSIONS.map((v) => ({ value: v, label: v }))}
              placeholder="Select session"
              allowCustom
              customLabel="Type session…"
            />
          </div>
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Notes</label>
          <textarea
            className="nx-input h-12 resize-none"
            placeholder="Optional"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        <div className="modal-action-bar">
          <button className="btn-primary btn flex-1" onClick={handleSave} disabled={!form.entryPrice || !form.exitPrice}>
            <NotebookPen size={14} />
            Save Trade
          </button>
          <button className="btn-ghost btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddExpenseQuickModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { update } = useAppData();
  const [form, setForm] = useState<ExpenseFormState>(createExpenseDefaults);

  useEffect(() => {
    if (!open) return;
    setForm(createExpenseDefaults());
  }, [open]);

  function handleSave() {
    if (!form.amount || !form.cat) return;

    const firmName = form.firm === "__other__" ? form.customFirm.trim() : form.firm;
    if (!firmName) return;

    const expense: Expense = {
      id: generateId(),
      date: form.date,
      description: firmName,
      cat: form.cat,
      amount: parseFloat(form.amount) || 0,
    };

    update((prev) => ({
      ...prev,
      expenses: [expense, ...prev.expenses],
    }));

    toast.success("Expense added");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Expense" size="sm">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Date</label>
            <DatePicker
              value={form.date}
              onChange={(date) => setForm((prev) => ({ ...prev, date }))}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Category</label>
            <CustomSelect
              value={form.cat}
              onChange={(v) => setForm((prev) => ({ ...prev, cat: v as ExpenseFormState["cat"] }))}
              options={EXPENSE_CATS.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }))}
              placeholder="Select..."
            />
          </div>
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Firm</label>
          <CustomSelect
            value={form.firm}
            onChange={(v) => setForm((prev) => ({ ...prev, firm: v, customFirm: "" }))}
            options={[...FIRMS.map((f) => ({ value: f, label: f })), { value: "__other__", label: "Other..." }]}
            placeholder="Select firm"
          />
          {form.firm === "__other__" && (
            <input
              className="nx-input mt-2"
              placeholder="Firm name"
              value={form.customFirm}
              onChange={(e) => setForm((prev) => ({ ...prev, customFirm: e.target.value }))}
            />
          )}
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Amount (GBP)</label>
          <input
            type="number"
            step="0.01"
            className="nx-input"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
          />
        </div>

        <div className="modal-action-bar">
          <button className="btn-primary btn flex-1" onClick={handleSave} disabled={!form.amount || !form.cat}>
            <Receipt size={14} />
            Save Expense
          </button>
          <button className="btn-ghost btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddAccountQuickModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { update } = useAppData();
  const [form, setForm] = useState<AccountFormState>(createAccountDefaults);

  useEffect(() => {
    if (!open) return;
    setForm(createAccountDefaults());
  }, [open]);

  function handleSave() {
    if (!form.type || !form.balance) return;

    const balance = parseFloat(form.balance) || 0;
    const initialBalance = parseFloat(form.initialBalance) || balance;
    const account: Account = {
      id: generateId(),
      firm: form.firm,
      type: form.type,
      name: form.name.trim() || undefined,
      status: form.status,
      balance,
      initialBalance,
      peakBalance: Math.max(balance, initialBalance),
      mll: form.mll ? parseFloat(form.mll) : undefined,
      pnlHistory: [],
    };

    update((prev) => ({
      ...prev,
      accounts: [normalizeAccountWithPropRules(account, {
        withdrawals: prev.withdrawals,
        tradeJournal: prev.tradeJournal,
      }), ...prev.accounts],
    }));

    toast.success("Account added");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Account" size="sm">
      <div className="space-y-3">
        <div>
          <label className="text-tx-3 text-xs block mb-1">Firm</label>
          <CustomSelect
            value={form.firm}
            onChange={(v) => setForm((prev) => ({ ...prev, firm: v }))}
            options={FIRMS.map((f) => ({ value: f, label: f }))}
            placeholder="Select firm"
          />
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Type / Plan</label>
          <input
            type="text"
            className="nx-input"
            placeholder="50K Challenge"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Nickname</label>
          <input
            type="text"
            className="nx-input"
            placeholder="Optional"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Status</label>
          <CustomSelect
            value={form.status}
            onChange={(v) => setForm((prev) => ({ ...prev, status: v as AccountStatus }))}
            options={[
              { value: "Challenge", label: "Challenge" },
              { value: "Funded", label: "Funded" },
              { value: "Breached", label: "Breached" },
            ]}
            placeholder="Select status"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Current Balance</label>
            <input
              type="number"
              className="nx-input"
              value={form.balance}
              onChange={(e) => setForm((prev) => ({ ...prev, balance: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Initial Balance</label>
            <input
              type="number"
              className="nx-input"
              value={form.initialBalance}
              onChange={(e) => setForm((prev) => ({ ...prev, initialBalance: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Max Loss Limit</label>
          <input
            type="number"
            className="nx-input"
            placeholder="Optional"
            value={form.mll}
            onChange={(e) => setForm((prev) => ({ ...prev, mll: e.target.value }))}
          />
        </div>

        <div className="modal-action-bar">
          <button className="btn-primary btn flex-1" onClick={handleSave} disabled={!form.type || !form.balance}>
            <Briefcase size={14} />
            Save Account
          </button>
          <button className="btn-ghost btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LogPayoutQuickModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const [form, setForm] = useState<PayoutFormState>(() => createPayoutDefaults(data.accounts));

  const accountOptions = useMemo(
    () =>
      data.accounts
        .filter((account) => isActiveAccount(account))
        .map((account) => ({
          value: account.id,
          label: formatAccountOptionLabel(account, { includeFirm: false }),
        })),
    [data.accounts]
  );

  useEffect(() => {
    if (!open) return;
    setForm(createPayoutDefaults(data.accounts));
  }, [data.accounts, open]);

  function handleSave() {
    if (!form.gross) return;

    const grossAmount = parseFloat(form.gross) || 0;
    const draftPayout: Withdrawal = {
      id: generateId(),
      date: form.date,
      firm: form.firm,
      gross: grossAmount,
      accountId: form.accountId || undefined,
    };

    update((prev) => {
      const provisionalWithdrawals = [draftPayout, ...prev.withdrawals];
      const provisionalAccounts = reconcileLinkedPayoutAccounts(prev.accounts, null, draftPayout, {
        withdrawals: provisionalWithdrawals,
        tradeJournal: prev.tradeJournal,
      });
      const linkedAccount = draftPayout.accountId
        ? provisionalAccounts.find((account) => account.id === draftPayout.accountId)
        : undefined;
      const payout: Withdrawal = {
        ...draftPayout,
        postBalance: linkedAccount?.balance,
      };
      const withdrawals = [payout, ...prev.withdrawals];

      return {
        ...prev,
        withdrawals,
        accounts: reconcileLinkedPayoutAccounts(prev.accounts, null, payout, {
          withdrawals,
          tradeJournal: prev.tradeJournal,
        }),
      };
    });

    toast.success("Payout logged");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Log Payout" size="sm">
      <div className="space-y-3">
        <div>
          <label className="text-tx-3 text-xs block mb-1">Firm</label>
          <CustomSelect
            value={form.firm}
            onChange={(v) => setForm((prev) => ({ ...prev, firm: v }))}
            options={FIRMS.map((f) => ({ value: f, label: f }))}
            placeholder="Select firm"
          />
        </div>

        <div>
          <label className="text-tx-3 text-xs block mb-1">Linked Account</label>
          <CustomSelect
            value={form.accountId}
            onChange={(v) => {
              const linked = data.accounts.find((account) => account.id === v);
              setForm((prev) => ({
                ...prev,
                accountId: v,
                firm: linked?.firm ?? prev.firm,
              }));
            }}
            options={accountOptions}
            placeholder="No linked account"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Date</label>
            <DatePicker
              value={form.date}
              onChange={(date) => setForm((prev) => ({ ...prev, date }))}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Gross Amount</label>
            <input
              type="number"
              step="0.01"
              className="nx-input"
              placeholder="0.00"
              value={form.gross}
              onChange={(e) => setForm((prev) => ({ ...prev, gross: e.target.value }))}
            />
          </div>
        </div>

        <div className="modal-action-bar">
          <button className="btn-primary btn flex-1" onClick={handleSave} disabled={!form.gross}>
            <Wallet size={14} />
            Save Payout
          </button>
          <button className="btn-ghost btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function QuickActionHost({
  action,
  onClose,
}: {
  action: QuickAction | null;
  onClose: () => void;
}) {
  return (
    <>
      <AddTradeQuickModal open={action === "addTrade"} onClose={onClose} />
      <AddExpenseQuickModal open={action === "addExpense"} onClose={onClose} />
      <AddAccountQuickModal open={action === "addAccount"} onClose={onClose} />
      <LogPayoutQuickModal open={action === "logPayout"} onClose={onClose} />
    </>
  );
}
