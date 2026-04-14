import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from 'sonner';
import { PAGE_THEMES } from "@/lib/theme";
import { useLocation } from "react-router-dom";
import {
  Plus,
  Shield,
  Target,
  AlertTriangle,
  Edit2,
  Trash2,
  Banknote,
  CheckCircle2,
  DollarSign,
  Activity,
  Award,
  Trophy,
  Briefcase,

} from "lucide-react";
import type { AppData } from "@/types";
import { useAppData } from "@/lib/store";
import { getQuickActionState } from "@/lib/quickActions";
import { getViewIntentState } from "@/lib/viewIntents";
import { formatAccountOptionLabel, isActiveAccount } from "@/lib/accountStatus";
import { reconcileLinkedPayoutAccounts } from "@/lib/payouts";
import {
  buildProgramTypeLabel,
  applyPropAccountLifecycle,
  getDefaultProgramKey,
  getDefaultProgramSize,
  getProgramOptions,
  getProgramRule,
  getProgramRuleByKeySize,
  getPropAccountSnapshot,
  inferProgramKey,
  parseAccountSize,
  type PropPhase,
  type PropProgramKey,
} from "@/lib/propRules";
import { fmtGBP, fmtUSD, fmtDate, toNum, cn, generateId, todayLocalIsoDate } from "@/lib/utils";
import { useBWMode, bwColor, bwPageTheme } from "@/lib/useBWMode";
import Modal from "@/components/Modal";
import StatCard from "@/components/StatCard";
import DatePicker from "@/components/DatePicker";
import { useRegisterPageView } from "@/components/PageViewContext";
import CustomSelect from "@/components/CustomSelect";
import type { Account, AccountStatus, Withdrawal } from "@/types";
import { FirmAnalyticsChart } from "@/components/prop/FirmAnalyticsChart";
import { TradingInsightsSidebar } from "@/components/prop/TradingInsightsSidebar";
import { AccountCard } from "@/components/prop/AccountCard";
import { EditChallengeModal } from "@/components/prop/EditChallengeModal";
import { loadCustomFirms, saveCustomFirm, deleteCustomFirm } from "@/lib/journal";

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const FIRMS_BASE = [
  "Lucid Trading",
  "Tradeify",
  "Topstep",
  "FundingTicks",
  "MyFundedFX",
  "Take Profit Trader",
  "Maven Trading",
] as const;

type FilterTab = "all" | "funded" | "challenge" | "breached";

const isFundedStatus = (s: string) => s.toLowerCase().trim() === "funded";
const isChallengeStatus = (s: string) => s.toLowerCase().trim() === "challenge";
const isBreachedStatus = (s: string) => s.toLowerCase().trim() === "breached";

function getPhaseForStatus(status: AccountStatus, fallback: PropPhase = "challenge"): PropPhase {
  if (isFundedStatus(status)) return "funded";
  if (isChallengeStatus(status)) return "challenge";
  return fallback;
}

const emptyAccountForm = (phase: PropPhase = "challenge") => {
  const firm = FIRMS_BASE[0] as string;
  const planKey = getDefaultProgramKey(firm, phase);
  const planSize = planKey ? getDefaultProgramSize(planKey) : null;
  const rules = planKey && planSize ? getProgramRuleByKeySize(planKey, planSize) : null;
  const baseBalance = rules?.balanceMode === "pnl" ? 0 : (planSize ?? 0);

  return {
    firm,
    planKey: planKey ?? "",
    planSize: planSize ? String(planSize) : "",
    type: planKey && planSize ? buildProgramTypeLabel(planKey, planSize) : "",
    name: "",
    status: (phase === "funded" ? "funded" : "challenge") as AccountStatus,
    balance: rules ? String(baseBalance) : "",
    initialBalance: rules ? String(baseBalance) : "",
    peakBalance: rules ? String(baseBalance) : "",
    sodBalance: "",
    mll: rules ? String(baseBalance - rules.drawdown) : "",
    profitTarget: rules?.profitTarget ? String(rules.profitTarget) : "",
    notes: "",
    customFirm: "",
    fundedAt: "",
    challengeStartDate: "",
    breachedDate: "",
    winningDays: "",
    balanceSnapshots: [] as { date: string; balance: number }[],
  };
};

const OTHER_FIRM_VALUE = "__other__";

const emptyPayoutForm = (firm?: string, accountId?: string) => {
  const resolvedFirm = firm ?? (FIRMS_BASE[0] as string);
  const isKnownFirm = FIRMS_BASE.includes(resolvedFirm as (typeof FIRMS_BASE)[number]);

  return {
    firm: isKnownFirm ? resolvedFirm : OTHER_FIRM_VALUE,
    customFirm: isKnownFirm ? "" : resolvedFirm,
    date: todayLocalIsoDate(),
    gross: "",
    accountId: accountId ?? "",
    notes: "",
  };
};

/* ------------------------------------------------------------------ */
/*  Firm Analytics Chart                                               */
/* ------------------------------------------------------------------ */

const FIRM_COLOR: Record<string, string> = {
  "Lucid Trading":      "#5b8bbf",
  "Tradeify":           "#9b8ec2",
  "Topstep":            "#c49060",
  "FundingTicks":       "#5aadaa",
  "MyFundedFX":         "#fbbf24",
  "Take Profit Trader": "#c070a0",
  "Maven Trading":      "#4a9a7a",
};
const getFirmColor = (firm: string) => FIRM_COLOR[firm] ?? "#6b7280";

export default function PropAccounts() {
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const location = useLocation();
  const handledLocationAction = useRef<string | null>(null);
  const handledViewIntent = useRef<string | null>(null);

  const [tab, setTab] = useState<FilterTab>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [addQty, setAddQty] = useState<number | "">(1);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);

  useEffect(() => {
    const quickAction = getQuickActionState(location.state);
    const requestKey = quickAction?.quickActionId ?? null;

    if (!quickAction?.action) {
      handledLocationAction.current = null;
      return;
    }
    if (handledLocationAction.current === requestKey) return;

    if (quickAction.action === "addAccount") {
      handledLocationAction.current = requestKey;
      setEditAccount(null);
      setForm(emptyAccountForm());
      setWinningDaysManuallyEdited(false);
      setAddOpen(true);
    } else if (quickAction.action === "logPayout") {
      handledLocationAction.current = requestKey;
      setEditPayoutId(null);
      setPayoutForm(emptyPayoutForm());
      setPayoutOpen(true);
    }
  }, [location.state]);

  const [form, setForm] = useState(emptyAccountForm());
  const [payoutForm, setPayoutForm] = useState(emptyPayoutForm());
  const [customFirms, setCustomFirms] = useState<string[]>(loadCustomFirms);
  const [mllManuallyEdited, setMllManuallyEdited] = useState(false);
  const [winningDaysManuallyEdited, setWinningDaysManuallyEdited] = useState(false);
  const [sortBy, setSortBy] = useState<"status" | "balance-desc" | "balance-asc" | "firm">("status");
  const [editPayoutId, setEditPayoutId] = useState<string | null>(null);
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null);
  const [editChallengeId, setEditChallengeId] = useState<string | null>(null);
  const [deleteChallengeConfirm, setDeleteChallengeConfirm] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  /* ---- Page theme + filter state ---- */
  const isBW = useBWMode();
  const theme = bwPageTheme(PAGE_THEMES.prop, isBW);
  const [filters, setFilters] = useState({ status: "all", sort: "balance" });
  const currentView = useMemo(
    () => ({
      route: "/prop",
      title: "Prop accounts view",
      description: "Account status and sorting filters",
      state: {
        filters,
      },
    }),
    [filters]
  );
  useRegisterPageView(currentView);
  const propContext = useMemo(
    () => ({
      withdrawals: data.withdrawals,
      tradeJournal: data.tradeJournal,
    }),
    [data.tradeJournal, data.withdrawals]
  );

  const fallbackPhase = editAccount?.phaseHint ?? "challenge";
  const formPhase = getPhaseForStatus(form.status, fallbackPhase);
  const availablePlans = getProgramOptions(form.firm, formPhase);
  const firmHasPlans = availablePlans.length > 0;
  const activePlanKey = availablePlans.some((plan) => plan.key === form.planKey)
    ? (form.planKey as PropProgramKey)
    : (availablePlans[0]?.key ?? "");
  const availablePlanSizes = availablePlans.find((plan) => plan.key === activePlanKey)?.sizes ?? [];

  useEffect(() => {
    const lifecycle = applyPropAccountLifecycle(data.accounts, data.passedChallenges ?? [], propContext);
    if (!lifecycle.changed) return;

    update((prev) => ({
      ...prev,
      accounts: lifecycle.accounts,
      passedChallenges: lifecycle.passedChallenges,
    }));
  }, [data.accounts, data.passedChallenges, propContext, update]);

  useEffect(() => {
    const viewIntent = getViewIntentState(location.state);
    const requestKey = viewIntent?.id ?? null;

    if (!viewIntent || viewIntent.route !== "/prop") {
      handledViewIntent.current = null;
      return;
    }
    if (handledViewIntent.current === requestKey) return;

    const nextFilters =
      viewIntent.state.filters &&
      typeof viewIntent.state.filters === "object" &&
      !Array.isArray(viewIntent.state.filters)
        ? (viewIntent.state.filters as Partial<typeof filters>)
        : null;

    if (nextFilters) {
      setFilters((prev) => ({
        status: typeof nextFilters.status === "string" ? nextFilters.status : prev.status,
        sort: typeof nextFilters.sort === "string" ? nextFilters.sort : prev.sort,
      }));
    }

    handledViewIntent.current = requestKey;
  }, [location.state]);

  function applyProgramSelection(nextPlanKey: PropProgramKey, nextSize?: number, nextStatus?: AccountStatus) {
    const phase = getPhaseForStatus(nextStatus ?? form.status, formPhase);
    const nextPlans = getProgramOptions(form.firm, phase);
    const fallbackPlan = nextPlans.find((plan) => plan.key === nextPlanKey) ? nextPlanKey : (nextPlans[0]?.key ?? nextPlanKey);
    const planSizes = nextPlans.find((plan) => plan.key === fallbackPlan)?.sizes ?? [];
    const resolvedSize = nextSize && planSizes.includes(nextSize) ? nextSize : planSizes[0];
    const rules = resolvedSize ? getProgramRuleByKeySize(fallbackPlan, resolvedSize) : null;
    const baseBalance = rules?.balanceMode === "pnl" ? 0 : (resolvedSize ?? 0);

    setForm((prev) => ({
      ...prev,
      status: nextStatus ?? prev.status,
      planKey: fallbackPlan,
      planSize: resolvedSize ? String(resolvedSize) : "",
      type: resolvedSize ? buildProgramTypeLabel(fallbackPlan, resolvedSize) : prev.type,
      initialBalance: rules ? String(baseBalance) : prev.initialBalance,
      balance: !editAccount && rules ? String(baseBalance) : prev.balance,
      peakBalance: !editAccount && rules ? String(baseBalance) : prev.peakBalance,
      mll: rules ? String(baseBalance - rules.drawdown) : prev.mll,
      profitTarget: rules?.profitTarget ? String(rules.profitTarget) : "",
    }));
  }

  function handlePlanKeyChange(planKey: string) {
    setMllManuallyEdited(false);
    applyProgramSelection(planKey as PropProgramKey, form.planSize ? Number(form.planSize) : undefined);
  }

  function handlePlanSizeChange(sizeStr: string) {
    setMllManuallyEdited(false);
    const nextSize = Number(sizeStr);
    applyProgramSelection(activePlanKey, nextSize);
  }

  function handleStatusChange(nextStatus: AccountStatus) {
    if (!firmHasPlans) {
      setForm((prev) => ({ ...prev, status: nextStatus }));
      return;
    }

    const nextPhase = getPhaseForStatus(nextStatus, formPhase);
    const nextPlans = getProgramOptions(form.firm, nextPhase);
    const nextPlan = nextPlans.find((plan) => plan.key === form.planKey)?.key ?? nextPlans[0]?.key;
    applyProgramSelection(nextPlan ?? activePlanKey, form.planSize ? Number(form.planSize) : undefined, nextStatus);
  }

  function handleFirmChange(firm: string) {
    if (firm === "__other__") {
      setForm((prev) => ({
        ...prev,
        firm,
        customFirm: "",
        planKey: "",
        planSize: "",
        type: "",
        profitTarget: "",
      }));
      return;
    }

    const nextPlans = getProgramOptions(firm, formPhase);
    const nextPlan = nextPlans[0]?.key ?? "";
    const nextSize = nextPlans[0]?.sizes[0];
    const rules = nextPlan && nextSize ? getProgramRuleByKeySize(nextPlan, nextSize) : null;
    const baseBalance = rules?.balanceMode === "pnl" ? 0 : (nextSize ?? 0);
    setForm((prev) => ({
      ...prev,
      firm,
      customFirm: "",
      planKey: nextPlan,
      planSize: nextSize ? String(nextSize) : "",
      type: nextPlan && nextSize ? buildProgramTypeLabel(nextPlan, nextSize) : prev.type,
      initialBalance: rules ? String(baseBalance) : prev.initialBalance,
      balance: !editAccount && rules ? String(baseBalance) : prev.balance,
      peakBalance: !editAccount && rules ? String(baseBalance) : prev.peakBalance,
      mll: rules ? String(baseBalance - rules.drawdown) : prev.mll,
      profitTarget: rules?.profitTarget ? String(rules.profitTarget) : "",
    }));
  }

  /* ---- Counts ---- */
  const counts = useMemo(() => {
    const a = data.accounts;
    return {
      all:      a.length,
      funded:   a.filter((x) => isFundedStatus(x.status)).length,
      challenge: a.filter((x) => isChallengeStatus(x.status)).length,
      breached: a.filter((x) => isBreachedStatus(x.status)).length,
    };
  }, [data.accounts]);

  /* ---- Net P&L ---- */
  const netPnL = useMemo(() => {
    const totalWithdrawals = data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
    const totalExpenses    = data.expenses.reduce((s, e) => s + toNum(e.amount), 0);
    return totalWithdrawals - totalExpenses;
  }, [data.withdrawals, data.expenses]);

  /* ---- Filtered + sorted accounts ---- */
  const filtered = useMemo(() => {
    let base = data.accounts;
    if (tab === "funded")    base = data.accounts.filter((a) => isFundedStatus(a.status));
    else if (tab === "challenge") base = data.accounts.filter((a) => isChallengeStatus(a.status));
    else if (tab === "breached")  base = data.accounts.filter((a) => isBreachedStatus(a.status));

    // Apply FilterBar status filter
    if (filters.status !== "all") {
      base = base.filter((a) => a.status.toLowerCase() === filters.status);
    }

    const arr = [...base];
    const statusOrder = (s: string) => isFundedStatus(s) ? 0 : isChallengeStatus(s) ? 1 : 2;
    switch (sortBy) {
      case "status":
        return arr.sort((a, b) => {
          const d = statusOrder(a.status) - statusOrder(b.status);
          return d !== 0 ? d : toNum(b.balance) - toNum(a.balance);
        });
      case "balance-desc": return arr.sort((a, b) => toNum(b.balance) - toNum(a.balance));
      case "balance-asc":  return arr.sort((a, b) => toNum(a.balance) - toNum(b.balance));
      case "firm":         return arr.sort((a, b) => a.firm.localeCompare(b.firm) || b.balance - a.balance);
      default: return arr;
    }
  }, [data.accounts, tab, sortBy, filters.status]);

  /* ---- Withdrawals total ---- */
  const totalWithdrawals = useMemo(
    () => data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0),
    [data.withdrawals]
  );

  const payoutAccountOptions = useMemo(
    () =>
      [...data.accounts]
        .sort((a, b) => {
          const activityDelta = Number(isActiveAccount(b)) - Number(isActiveAccount(a));
          if (activityDelta !== 0) return activityDelta;
          return (a.name || a.type).localeCompare(b.name || b.type) || a.firm.localeCompare(b.firm);
        })
        .map((account) => ({
          value: account.id,
          label: formatAccountOptionLabel(account, { includeFirm: false }),
          firm: account.firm,
          active: isActiveAccount(account),
        })),
    [data.accounts]
  );

  const payoutAccountLabels = useMemo(
    () =>
      new Map(
        data.accounts.map((account) => [
          account.id,
          formatAccountOptionLabel(account, { includeFirm: false }),
        ])
      ),
    [data.accounts]
  );

  /* ---- Save account ---- */
  const handleSaveAccount = () => {
    if (!form.balance) return;
    const firmName = form.firm === "__other__" ? form.customFirm.trim() : form.firm;
    if (!firmName) return;
    const bal = parseFloat(form.balance);
    const selectedPlanKey = firmHasPlans && activePlanKey ? activePlanKey : null;
    const selectedSize = form.planSize ? Number(form.planSize) : parseAccountSize(form.type);
    const finalType = selectedPlanKey && selectedSize ? buildProgramTypeLabel(selectedPlanKey, selectedSize) : form.type;
    const initBal = form.initialBalance ? parseFloat(form.initialBalance) : selectedSize ?? bal;
    const sodBal = form.sodBalance ? parseFloat(form.sodBalance) : bal;
    const previousPhase = editAccount ? getPhaseForStatus(editAccount.status, editAccount.phaseHint ?? "challenge") : null;
    let phaseHint = getPhaseForStatus(form.status, fallbackPhase);
    let finalStatus: AccountStatus = form.status;
    let peakBalance = Math.max(
      bal,
      initBal,
      editAccount?.peakBalance ?? 0,
      form.peakBalance ? parseFloat(form.peakBalance) : 0
    );
    // If user explicitly un-breaches an account, reset peak to current balance
    // so the recalculated MLL floor (peak - drawdown) won't auto re-breach
    if (editAccount && isBreachedStatus(editAccount.status) && !isBreachedStatus(finalStatus)) {
      peakBalance = bal;
    }
    const finalPhase = getPhaseForStatus(finalStatus, phaseHint);
    const manualFundedAt = form.fundedAt.trim() || undefined;
    const manualChallengeStartDate = form.challengeStartDate.trim() || undefined;
    const manualBreachedDate = form.breachedDate.trim() || undefined;
    const fundedAt = finalPhase === "funded"
      ? (manualFundedAt ?? editAccount?.fundedAt ?? (previousPhase === "funded" ? todayLocalIsoDate() : undefined) ?? todayLocalIsoDate())
      : undefined;
    // Preserve and update balance snapshots
    const existingSnapshots = editAccount?.balanceSnapshots ?? [];
    const lastSnapshot = existingSnapshots[existingSnapshots.length - 1];
    const today = todayLocalIsoDate();
    let balanceSnapshots = [...existingSnapshots];
    // If balance changed from last recorded snapshot, add a new snapshot
    if (!lastSnapshot || lastSnapshot.balance !== bal) {
      balanceSnapshots = [...existingSnapshots, { date: today, balance: bal }];
    }
    // Compute winning days from balance snapshots (days where balance increased vs previous)
    const winningDaysFromBalance = balanceSnapshots.reduce((count: number, snap, i: number) => {
      if (i === 0) return count;
      if (snap.balance > balanceSnapshots[i - 1].balance) return count + 1;
      return count;
    }, 0);

    const baseAccount = (accountId: string): Account => ({
      id: accountId,
      firm: firmName,
      type: finalType,
      name: form.name.trim() || undefined,
      status: finalStatus,
      phaseHint: phaseHint === "breached" ? undefined : phaseHint,
      fundedAt,
      challengeStartDate: manualChallengeStartDate,
      breachedDate: finalStatus === "breached" ? (manualBreachedDate ?? editAccount?.breachedDate ?? todayLocalIsoDate()) : undefined,
      balance: bal,
      initialBalance: initBal,
      peakBalance,
      sodBalance: sodBal,
      mll: form.mll ? parseFloat(form.mll) : editAccount?.mll,
      payoutCycleStartBalance: editAccount?.payoutCycleStartBalance,
      notes: form.notes.trim() || undefined,
      pnlHistory: editAccount?.pnlHistory ?? [],
      pnlEntries: editAccount?.pnlEntries,
      linkedExpenseId: editAccount?.linkedExpenseId,
      winningDays: winningDaysManuallyEdited
        ? parseInt(form.winningDays || "0")
        : (editAccount?.winningDays !== undefined
            ? editAccount.winningDays
            : (winningDaysFromBalance > 0 ? winningDaysFromBalance : undefined)),
      balanceSnapshots,
    });

    const qty = editAccount ? 1 : Math.max(1, Math.min(addQty || 1, 50));
    const newAccountIds = Array.from({ length: qty }, (_, index) =>
      editAccount?.id ?? `${generateId()}-${index}`
    );
    const draftAccounts = editAccount
      ? data.accounts.map((account) => (account.id === editAccount.id ? baseAccount(editAccount.id) : account))
      : [...newAccountIds.map((accountId) => baseAccount(accountId)), ...data.accounts];
    const lifecycle = applyPropAccountLifecycle(draftAccounts, data.passedChallenges ?? [], propContext);
    let primarySavedAccount = lifecycle.accounts.find((account) => account.id === newAccountIds[0]) ?? null;

    // If user manually edited MLL (or auto-computed it via balance/peak change), preserve it.
    // The lifecycle recomputes mllFloor from peak - drawdown, overriding manual edits — so we
    // restore the user's value after lifecycle has run. This applies to both program and custom firm accounts.
    if (editAccount && primarySavedAccount && mllManuallyEdited) {
      const manualMll = parseFloat(form.mll);
      if (!isNaN(manualMll)) {
        primarySavedAccount = { ...primarySavedAccount, mll: manualMll };
        lifecycle.accounts = lifecycle.accounts.map((account) =>
          account.id === editAccount.id ? primarySavedAccount! : account
        );
      }
    }

    update((prev) => ({
      ...prev,
      accounts: lifecycle.accounts,
      passedChallenges: lifecycle.passedChallenges,
    }));

    if (!editAccount) {
      toast.success(qty > 1 ? `${qty} accounts added` : "Account added");
      // Persist custom firm
      if (form.firm === "__other__" && form.customFirm.trim()) { saveCustomFirm(form.customFirm.trim()); setCustomFirms(loadCustomFirms()); }
    } else {
      toast.success("Account updated");
    }

    if (
      primarySavedAccount &&
      finalPhase === "challenge" &&
      getPhaseForStatus(primarySavedAccount.status, primarySavedAccount.phaseHint ?? "challenge") === "funded"
    ) {
      toast.success("Challenge target hit. The account was promoted to funded and reset for the new phase.");
    }

    if (
      primarySavedAccount &&
      finalStatus !== "breached" &&
      primarySavedAccount.status === "breached"
    ) {
      toast("This account is now marked as breached based on the live floor.");
    }

    setAddOpen(false);
    setAddQty(1);
    setEditAccount(null);
    setForm(emptyAccountForm());
    setWinningDaysManuallyEdited(false);
  };


  /* ---- Open edit ---- */
  const handleOpenEdit = (account: Account) => {
    setEditAccount(account);
    setMllManuallyEdited(false);
    setWinningDaysManuallyEdited(false);
    const inferredKey = inferProgramKey(account);
    const inferredSize = parseAccountSize(account.type);
    const rules = getProgramRule(account);
    setForm({
      firm:           account.firm,
      planKey:        inferredKey ?? "",
      planSize:       inferredSize ? String(inferredSize) : "",
      type:           account.type,
      name:           account.name ?? "",
      status:         account.status,
      balance:        String(account.balance),
      initialBalance: account.initialBalance ? String(account.initialBalance) : "",
      peakBalance:    account.peakBalance ? String(account.peakBalance) : "",
      sodBalance:     account.sodBalance ? String(account.sodBalance) : "",
      mll:            account.mll ? String(account.mll) : "",
      profitTarget:   rules?.profitTarget ? String(rules.profitTarget) : "",
      notes:          account.notes ?? "",
      customFirm:     "",
      fundedAt:       account.fundedAt ?? "",
      challengeStartDate: account.challengeStartDate ?? "",
      breachedDate:   account.breachedDate ?? "",
      winningDays:    account.winningDays !== undefined ? String(account.winningDays) : "",
      balanceSnapshots: account.balanceSnapshots ?? [],
    });
    setAddOpen(true);
  };

  /* ---- Delete account ---- */
  const handleDelete = (id: string) => {
    const deleted = data.accounts.find((a) => a.id === id);
    if (!deleted) return;
    update((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }));
    toast('Account deleted', {
      action: { label: 'Undo', onClick: () => update((prev) => ({ ...prev, accounts: [...prev.accounts, deleted] })) },
      duration: 5000,
    });
  };

  /* ---- Edit passed challenge ---- */
  const handleSaveChallenge = (patch: Partial<import("@/types").PassedChallenge>) => {
    if (!editChallengeId) return;
    update((prev) => {
      const current = (prev.passedChallenges ?? []).find((challenge) => challenge.id === editChallengeId);
      if (!current) return prev;

      const nextChallenge = { ...current, ...patch };
      const oldPassDate = current.passedDate;
      const nextPassDate = nextChallenge.passedDate;
      const oldFundedStart = oldPassDate ? new Date(`${oldPassDate}T00:00:00Z`) : null;
      const nextFundedStart = nextPassDate ? new Date(`${nextPassDate}T00:00:00Z`) : null;

      if (oldFundedStart) oldFundedStart.setUTCDate(oldFundedStart.getUTCDate() + 1);
      if (nextFundedStart) nextFundedStart.setUTCDate(nextFundedStart.getUTCDate() + 1);

      const oldFundedIso = oldFundedStart?.toISOString().slice(0, 10);
      const nextFundedIso = nextFundedStart?.toISOString().slice(0, 10);

      return {
        ...prev,
        passedChallenges: (prev.passedChallenges ?? []).map((challenge) =>
          challenge.id === editChallengeId ? nextChallenge : challenge
        ),
        accounts: prev.accounts.map((account) => {
          if (account.id !== current.accountId || !isFundedStatus(account.status)) return account;
          if (account.fundedAt && oldFundedIso && account.fundedAt !== oldFundedIso) return account;
          return {
            ...account,
            fundedAt: nextFundedIso ?? account.fundedAt,
          };
        }),
      };
    });
    setEditChallengeId(null);
  };

  /* ---- Delete passed challenge ---- */
  const handleDeleteChallenge = (id: string) => {
    const deleted = (data.passedChallenges ?? []).find((c) => c.id === id);
    if (!deleted) return;
    update((prev) => ({
      ...prev,
      passedChallenges: (prev.passedChallenges ?? []).filter((c) => c.id !== id),
    }));
    setDeleteChallengeConfirm(null);
    toast('Challenge deleted', {
      action: { label: 'Undo', onClick: () => update((prev) => ({ ...prev, passedChallenges: [...(prev.passedChallenges ?? []), deleted] })) },
      duration: 5000,
    });
  };

  /* ---- Save payout (add or edit) — also deducts from linked account balance ---- */
  const handleSavePayout = () => {
    if (!payoutForm.gross) return;
    const grossAmt = parseFloat(payoutForm.gross);
    const firmName = payoutForm.firm === OTHER_FIRM_VALUE ? payoutForm.customFirm.trim() : payoutForm.firm;
    if (!firmName) return;
    const nextWithdrawalPatch = {
      date: payoutForm.date,
      firm: firmName,
      gross: grossAmt,
      accountId: payoutForm.accountId || undefined,
      notes: payoutForm.notes.trim() || undefined,
    };

    if (editPayoutId) {
      update((prev) => {
        const oldWithdrawal = prev.withdrawals.find((withdrawal) => withdrawal.id === editPayoutId);
        if (!oldWithdrawal) return prev;

        const draftWithdrawal: Withdrawal = {
          ...oldWithdrawal,
          ...nextWithdrawalPatch,
        };

        const draftWithdrawals = prev.withdrawals.map((withdrawal) =>
          withdrawal.id === editPayoutId ? draftWithdrawal : withdrawal
        );
        const provisionalAccounts = reconcileLinkedPayoutAccounts(prev.accounts, oldWithdrawal, draftWithdrawal, {
          withdrawals: draftWithdrawals,
          tradeJournal: prev.tradeJournal,
        });
        const linkedAccount = draftWithdrawal.accountId
          ? provisionalAccounts.find((account) => account.id === draftWithdrawal.accountId)
          : undefined;
        const updatedWithdrawal: Withdrawal = {
          ...draftWithdrawal,
          postBalance: linkedAccount?.balance,
        };
        const finalWithdrawals = prev.withdrawals.map((withdrawal) =>
          withdrawal.id === editPayoutId ? updatedWithdrawal : withdrawal
        );

        return {
          ...prev,
          withdrawals: finalWithdrawals,
          accounts: reconcileLinkedPayoutAccounts(prev.accounts, oldWithdrawal, updatedWithdrawal, {
            withdrawals: finalWithdrawals,
            tradeJournal: prev.tradeJournal,
          }),
        };
      });
      toast.success("Payout updated");
    } else {
      const draftWithdrawal: Withdrawal = {
        id: generateId(),
        date: payoutForm.date,
        firm: firmName,
        gross: grossAmt,
        accountId: payoutForm.accountId || undefined,
        notes: payoutForm.notes.trim() || undefined,
      };
      update((prev) => {
        const provisionalWithdrawals = [draftWithdrawal, ...prev.withdrawals];
        const provisionalAccounts = reconcileLinkedPayoutAccounts(prev.accounts, null, draftWithdrawal, {
          withdrawals: provisionalWithdrawals,
          tradeJournal: prev.tradeJournal,
        });
        const linkedAccount = draftWithdrawal.accountId
          ? provisionalAccounts.find((account) => account.id === draftWithdrawal.accountId)
          : undefined;
        const withdrawal: Withdrawal = {
          ...draftWithdrawal,
          postBalance: linkedAccount?.balance,
        };
        const withdrawals = [withdrawal, ...prev.withdrawals];

        return {
          ...prev,
          withdrawals,
          accounts: reconcileLinkedPayoutAccounts(prev.accounts, null, withdrawal, {
            withdrawals,
            tradeJournal: prev.tradeJournal,
          }),
        };
      });
      toast.success('Payout logged');
      // Persist custom firm
      if (payoutForm.firm === OTHER_FIRM_VALUE && payoutForm.customFirm.trim()) { saveCustomFirm(payoutForm.customFirm.trim()); setCustomFirms(loadCustomFirms()); }
    }
    setPayoutOpen(false);
    setEditPayoutId(null);
    setPayoutForm(emptyPayoutForm());
  };

  /* ---- Delete payout ---- */
  const handleDeletePayout = (id: string) => {
    const deleted = data.withdrawals.find((w) => w.id === id);
    if (!deleted) return;
    update((prev) => {
      const withdrawals = prev.withdrawals.filter((w) => w.id !== id);
      return {
        ...prev,
        withdrawals,
        accounts: reconcileLinkedPayoutAccounts(prev.accounts, deleted, null, {
          withdrawals,
          tradeJournal: prev.tradeJournal,
        }),
      };
    });
    setDeletingPayoutId(null);
    toast('Payout deleted', {
      action: {
        label: 'Undo',
        onClick: () =>
          update((prev) => {
            const withdrawals = [deleted, ...prev.withdrawals];
            return {
              ...prev,
              withdrawals,
              accounts: reconcileLinkedPayoutAccounts(prev.accounts, null, deleted, {
                withdrawals,
                tradeJournal: prev.tradeJournal,
              }),
            };
          }),
      },
      duration: 5000,
    });
  };

  const openPayout = (firm?: string, accountId?: string) => {
    setEditPayoutId(null);
    setPayoutForm(emptyPayoutForm(firm, accountId));
    setPayoutOpen(true);
  };

  const openEditPayout = (w: Withdrawal) => {
    setEditPayoutId(w.id);
    setPayoutForm({
      ...emptyPayoutForm(w.firm, w.accountId),
      date: w.date,
      gross: String(w.gross),
      notes: w.notes ?? "",
    });
    setPayoutOpen(true);
  };

  /* ---- Tab config ---- */
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all",       label: "All",       count: counts.all       },
    { key: "funded",    label: "Funded",    count: counts.funded    },
    { key: "challenge", label: "Challenge", count: counts.challenge  },
    { key: "breached",  label: "Breached",  count: counts.breached  },
  ];

  /* ---- Preview rules for selected plan in modal ---- */
  const modalRules = useMemo(() => {
    if (!firmHasPlans || !activePlanKey || !form.planSize) return null;
    return getProgramRuleByKeySize(activePlanKey, Number(form.planSize));
  }, [firmHasPlans, form.firm, activePlanKey, form.planSize]);
  const modalSnapshot = useMemo(() => {
    if (!firmHasPlans) return null;
    const balance = form.balance ? parseFloat(form.balance) : 0;
    const fallbackSize = form.planSize ? Number(form.planSize) : parseAccountSize(form.type) ?? 0;
    const initialBalance = form.initialBalance ? parseFloat(form.initialBalance) : fallbackSize;
    const peakBalance = Math.max(
      balance,
      initialBalance,
      form.peakBalance ? parseFloat(form.peakBalance) : 0
    );
    const resolvedType = activePlanKey && fallbackSize
      ? buildProgramTypeLabel(activePlanKey, fallbackSize)
      : form.type;

    return getPropAccountSnapshot({
      id: editAccount?.id ?? "__modal-preview__",
      firm: form.firm,
      type: resolvedType,
      status: form.status,
      phaseHint: getPhaseForStatus(form.status, fallbackPhase) as "funded" | "challenge" | undefined,
      balance,
      initialBalance,
      peakBalance,
      payoutCycleStartBalance: editAccount?.payoutCycleStartBalance,
    }, propContext);
  }, [
    activePlanKey,
    editAccount?.id,
    editAccount?.payoutCycleStartBalance,
    fallbackPhase,
    firmHasPlans,
    form.balance,
    form.firm,
    form.initialBalance,
    form.peakBalance,
    form.planSize,
    form.status,
    form.type,
    propContext,
  ]);

  const compareAccounts = useMemo(
    () => compareIds.map((id) => data.accounts.find((account) => account.id === id)).filter(Boolean) as typeof data.accounts,
    [compareIds, data.accounts]
  );

  const compareSnapshots = useMemo(
    () => compareAccounts.map((account) => ({ account, snapshot: getPropAccountSnapshot(account, propContext) })),
    [compareAccounts, propContext]
  );

  const comparisonRows = useMemo(() => {
    if (compareSnapshots.length < 2) return [];
    return [
      {
        label: "Balance",
        values: compareSnapshots.map(({ account }) => fmtUSD(toNum(account.balance))),
      },
      {
        label: "Drawdown buffer",
        values: compareSnapshots.map(({ snapshot }) => fmtUSD(snapshot?.distanceToMll ?? 0)),
      },
      {
        label: "Progress / buffer",
        values: compareSnapshots.map(({ snapshot }) =>
          snapshot?.phase === "challenge"
            ? `${snapshot.progressPct?.toFixed(0) ?? "0"}% to pass`
            : `${snapshot?.drawdownRemainingPct?.toFixed(0) ?? "0"}% buffer`
        ),
      },
      {
        label: "Next payout",
        values: compareSnapshots.map(({ snapshot }) =>
          snapshot?.latestPayoutDate ? fmtDate(snapshot.latestPayoutDate) : "No payout yet"
        ),
      },
    ];
  }, [compareSnapshots]);

  function toggleCompareAccount(accountId: string) {
    setCompareIds((prev) => {
      if (prev.includes(accountId)) return prev.filter((id) => id !== accountId);
      if (prev.length >= 2) return [...prev.slice(1), accountId];
      return [...prev, accountId];
    });
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="text-[11px] font-semibold mb-1" style={{ color: theme.accent, letterSpacing: "0.04em" }}>Prop</div>
        <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-start lg:justify-between">
          <h1 className="page-title">Prop Accounts</h1>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto">
            <button className="btn-success btn w-full lg:w-auto" onClick={() => openPayout()}>
              <Banknote size={14} />
              Record Payout
            </button>
            <button
              className="btn-primary btn w-full lg:w-auto"
              onClick={() => {
                setEditAccount(null);
                setForm(emptyAccountForm());
                setAddOpen(true);
              }}
            >
              <Plus size={14} />
              Add Account
            </button>
          </div>
        </div>
      </div>

      {/* Summary stat cards */}
      {(() => {
        const fundedCapital = data.accounts
          .filter((a) => isFundedStatus(a.status))
          .reduce((s, a) => s + (parseFloat(String(a.balance)) || 0), 0);
        const totalPayouts = data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
        return (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
            <StatCard label="Active Funded"    value={counts.funded}    prefix="" suffix="" decimals={0} icon={<Shield size={15} className="text-profit" />}      accentColor="#22c55e" delay={0}   />
            <StatCard label="Active Challenges" value={counts.challenge} prefix="" suffix="" decimals={0} icon={<Target size={15} className="text-warn" />}         accentColor="#f59e0b" delay={60}  />
            <StatCard label="Total Breached"   value={counts.breached}  prefix="" suffix="" decimals={0} icon={<AlertTriangle size={15} className="text-loss" />}   accentColor="#ef4444" delay={120} />
            <StatCard label="Funded Capital"   value={fundedCapital}                                     icon={<DollarSign size={15} className="text-profit" />}    accentColor="#22c55e" delay={150} />
            <StatCard label="Total Payouts"    value={totalPayouts}                                      icon={<Award size={15} className={netPnL >= 0 ? "text-profit" : "text-loss"} />} accentColor={netPnL >= 0 ? "#22c55e" : "#ef4444"} delay={180} />
          </div>
        );
      })()}

      {/* Two-column layout: main content + insights sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-5 items-start">

        {/* ── Left: Analytics + Accounts + History ── */}
        <div className="flex flex-col gap-5">

          {/* Firm Analytics */}
          <FirmAnalyticsChart expenses={data.expenses} withdrawals={data.withdrawals} />

          {compareAccounts.length > 0 && (
            <div className="card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-tx-4">Comparison mode</div>
                  <div className="mt-1 text-sm font-semibold text-tx-1">
                    {compareAccounts.length < 2
                      ? "Select one more account to compare side by side."
                      : "Compare account health, payout timing, and risk buffers."}
                  </div>
                </div>
                <button className="btn-ghost btn-sm" onClick={() => setCompareIds([])}>
                  Clear compare
                </button>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {compareSnapshots.map(({ account, snapshot }) => (
                  <div key={account.id} className="rounded-2xl border border-border-subtle bg-bg-hover px-4 py-4">
                    <div className="text-sm font-semibold text-tx-1">{account.name || account.type}</div>
                    <div className="mt-1 text-xs text-tx-4">{account.firm}</div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-tx-4">Phase</div>
                        <div className="mt-1 font-semibold text-tx-1">{snapshot?.phase === "funded" ? "Funded" : "Challenge"}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.12em] text-tx-4">Balance</div>
                        <div className="mt-1 font-semibold text-tx-1">{fmtUSD(toNum(account.balance))}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {comparisonRows.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-border-subtle">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] bg-bg-hover px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-tx-4">
                    <span>Metric</span>
                    <span className="truncate">{compareAccounts[0]?.name || compareAccounts[0]?.type}</span>
                    <span className="truncate">{compareAccounts[1]?.name || compareAccounts[1]?.type}</span>
                  </div>
                  {comparisonRows.map((row) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] border-t border-border-subtle px-4 py-3 text-sm"
                    >
                      <span className="text-tx-3">{row.label}</span>
                      <span className="font-medium text-tx-1">{row.values[0]}</span>
                      <span className="font-medium text-tx-1">{row.values[1] ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filter tabs + sort controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {tabs.map(({ key, label, count }) => (
                <button key={key} onClick={() => setTab(key)} className={cn("tab-pill", tab === key && "active")}>
                  {label}{" "}
                  <span className={cn("ml-1 text-[10px]", tab === key ? "opacity-70" : "opacity-40")}>({count})</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <CustomSelect
                value={sortBy}
                onChange={(v) => setSortBy(v as typeof sortBy)}
                options={[
                  { value: "status",       label: "Sort: Status"    },
                  { value: "balance-desc", label: "Sort: Bal ↓"     },
                  { value: "balance-asc",  label: "Sort: Bal ↑"     },
                  { value: "firm",         label: "Sort: Firm"      },
                ]}
                placeholder="Sort"
              />
              <span className="text-tx-4 text-[10px]">{filtered.length} accounts</span>
            </div>
          </div>

          <div
            className="overflow-hidden rounded-2xl border"
            style={{ background: theme.dim, borderColor: theme.border }}
          >
            <div
              className="hidden gap-3 border-b px-4 py-3 lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto]"
              style={{ borderColor: theme.border }}
            >
              {["Account", "Balance", "Target / MLL", "Progress / Risk", "Actions"].map((label) => (
                <span key={label} className="text-[10px] uppercase tracking-[0.16em] text-tx-4">
                  {label}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-2 p-2.5 sm:gap-3 sm:p-3">
            {filtered.map((account, i) => (
              <div key={account.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i * 30, 180)}ms`, animationFillMode: "both" }}>
                <AccountCard
                  account={account}
                  snapshotContext={propContext}
                  onEdit={() => handleOpenEdit(account)}
                  onDelete={() => handleDelete(account.id)}
                  onPayout={() => openPayout(account.firm, account.id)}
                  onToggleCompare={() => toggleCompareAccount(account.id)}
                  compareSelected={compareIds.includes(account.id)}
                  compareDisabled={compareIds.length >= 2 && !compareIds.includes(account.id)}
                  onUnbreach={(phase) => {
                    update((prev) => ({
                      ...prev,
                      accounts: prev.accounts.map((a) =>
                        a.id === account.id ? { ...a, status: phase, breachedAt: undefined } : a
                      ),
                    }));
                  }}
                />
              </div>
            ))}
            {filtered.length === 0 && data.accounts.length === 0 && (
              <div className="col-span-full task-empty">
                <div className="task-empty-copy">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-tx-4">
                    <Briefcase size={12} />
                    Prop Workspace
                  </div>
                  <div>
                    <p className="text-base font-semibold text-tx-1">Add the first challenge or funded account.</p>
                    <p className="mt-1 text-sm text-tx-3">
                      Nexus will track pass targets, trailing MLL, breach status, and payout history once the account is live.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      "Auto-calculate MLL and targets",
                      "See funded and challenge health together",
                      "Link payouts back to the exact account",
                    ].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border px-2.5 py-1 text-[11px] text-tx-3"
                        style={{ background: "rgba(var(--surface-rgb),0.04)", borderColor: theme.border }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="task-empty-actions mt-4">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => {
                      setEditAccount(null);
                      setForm(emptyAccountForm());
                      setAddOpen(true);
                    }}
                  >
                    <Plus size={14} /> Add Account
                  </button>
                </div>
              </div>
            )}
            {filtered.length === 0 && data.accounts.length > 0 && (
              <div className="task-empty">
                <div className="task-empty-copy">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-tx-4">
                    <Shield size={12} />
                    Filter View
                  </div>
                  <div>
                    <p className="text-base font-semibold text-tx-1">No accounts match this view.</p>
                    <p className="mt-1 text-sm text-tx-3">
                      Switch back to All to review every account, then narrow down again if needed.
                    </p>
                  </div>
                </div>
                <div className="task-empty-actions mt-4">
                  <button className="btn-ghost btn-sm" onClick={() => setTab("all")}>
                    Show All Accounts
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Payout History */}
          {data.withdrawals.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-tx-3 text-[10px] uppercase tracking-wider font-medium">Payout History</div>
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-tx-4" />
                  <span className="text-[11px] font-bold text-profit tabular-nums">+{fmtGBP(totalWithdrawals)}</span>
                  <span className="text-tx-4 text-[10px]">{data.withdrawals.length} payouts</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 md:hidden">
                {(() => {
                  const sorted = [...data.withdrawals].sort((a, b) => b.date.localeCompare(a.date));
                  const maxPayout = Math.max(...sorted.map((w) => toNum(w.gross)));
                  const chronological = [...sorted].reverse();
                  const runningMap: Record<string, number> = {};
                  let running = 0;
                  for (const w of chronological) {
                    running += toNum(w.gross);
                    runningMap[w.id] = running;
                  }
                  return sorted.map((w, idx) => {
                    const wFirmCol = bwColor(getFirmColor(w.firm), isBW);
                    const amount = toNum(w.gross);
                    const isTop = amount === maxPayout;
                    const isFirst = idx === sorted.length - 1;
                    const runningTotal = runningMap[w.id] ?? 0;
                    const linkedAccountLabel = w.accountId ? payoutAccountLabels.get(w.accountId) : null;
                    return (
                      <div
                        key={w.id}
                        className="rounded-2xl border p-4"
                        style={{
                          background: isTop ? "rgba(34,197,94,0.04)" : theme.dim,
                          borderColor: isTop ? "rgba(34,197,94,0.12)" : theme.border,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-xs text-tx-2">
                              {isTop && <span className="text-[10px]">Top</span>}
                              {isFirst && !isTop && <span className="text-[10px]">First</span>}
                              <span className="font-mono tabular-nums">{fmtDate(w.date)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wFirmCol }} />
                              <span className="text-sm font-medium text-tx-1 break-words">{w.firm}</span>
                            </div>
                            {linkedAccountLabel && (
                              <div className="mt-1 text-[11px] text-tx-3 break-words">
                                {linkedAccountLabel}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {deletingPayoutId === w.id ? (
                              <>
                                <button
                                  onClick={() => handleDeletePayout(w.id)}
                                  className="rounded bg-loss/15 px-2 py-1 text-[10px] font-semibold text-loss transition-colors hover:bg-loss/25"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeletingPayoutId(null)}
                                  className="rounded px-2 py-1 text-[10px] font-semibold text-tx-3 transition-colors hover:text-tx-1"
                                  style={{ background: "rgba(var(--surface-rgb),0.06)" }}
                                >
                                  No
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEditPayout(w)}
                                  className="rounded p-1.5 text-tx-3 transition-colors hover:text-tx-1"
                                  style={{ background: "transparent" }}
                                  title="Edit payout"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => setDeletingPayoutId(w.id)}
                                  className="rounded p-1.5 text-tx-3 transition-colors hover:bg-loss/10 hover:text-loss"
                                  title="Delete payout"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border p-2.5" style={{ background: "rgba(var(--surface-rgb),0.04)", borderColor: "rgba(var(--border-rgb),0.08)" }}>
                            <p className="text-[10px] uppercase tracking-wide text-tx-4">Amount</p>
                            <p className="mt-1 font-bold font-mono tabular-nums text-profit">+{fmtGBP(amount)}</p>
                          </div>
                          <div className="rounded-xl border p-2.5" style={{ background: "rgba(var(--surface-rgb),0.04)", borderColor: "rgba(var(--border-rgb),0.08)" }}>
                            <p className="text-[10px] uppercase tracking-wide text-tx-4">Running</p>
                            <p className="mt-1 font-mono tabular-nums text-tx-3">{fmtGBP(runningTotal)}</p>
                          </div>
                          <div className="col-span-2 rounded-xl border p-2.5" style={{ background: "rgba(var(--surface-rgb),0.04)", borderColor: "rgba(var(--border-rgb),0.08)" }}>
                            <p className="text-[10px] uppercase tracking-wide text-tx-4">Notes</p>
                            <p className="mt-1 text-tx-3 break-words">{w.notes ?? "-"}</p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: theme.border }}>
                      <th className="text-left text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Date</th>
                      <th className="text-left text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Firm</th>
                      <th className="text-right text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Amount</th>
                      <th className="text-right text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Running</th>
                      <th className="text-left text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 pr-4">Notes</th>
                      <th className="text-right text-tx-3 text-[11px] uppercase tracking-wider font-medium pb-2 w-20">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "rgba(var(--border-rgb),0.06)" }}>
                    {(() => {
                      const sorted = [...data.withdrawals].sort((a, b) => b.date.localeCompare(a.date));
                      const maxPayout = Math.max(...sorted.map((w) => toNum(w.gross)));
                      // Compute running totals from oldest → newest, then reverse for display
                      const chronological = [...sorted].reverse();
                      const runningMap: Record<string, number> = {};
                      let running = 0;
                      for (const w of chronological) {
                        running += toNum(w.gross);
                        runningMap[w.id] = running;
                      }
                      return sorted.map((w, idx) => {
                        const wFirmCol = bwColor(getFirmColor(w.firm), isBW);
                        const amount = toNum(w.gross);
                        const isTop = amount === maxPayout;
                        const isFirst = idx === sorted.length - 1;
                        const runningTotal = runningMap[w.id] ?? 0;
                        const linkedAccountLabel = w.accountId ? payoutAccountLabels.get(w.accountId) : null;
                        return (
                          <tr key={w.id} className="group transition-colors"
                            style={{ background: isTop ? "rgba(34,197,94,0.04)" : undefined }}>
                            <td className="py-2.5 pr-4 text-tx-2 font-mono tabular-nums text-xs">
                              <div className="flex items-center gap-1.5">
                                {isTop && <span className="text-[10px]">🏆</span>}
                                {isFirst && !isTop && <span className="text-[10px]">🥇</span>}
                                {fmtDate(w.date)}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wFirmCol }} />
                                  <span className="text-tx-1 font-medium text-xs">{w.firm}</span>
                                </div>
                                {linkedAccountLabel && (
                                  <div className="mt-1 text-[11px] text-tx-3">{linkedAccountLabel}</div>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 font-bold font-mono tabular-nums text-right"
                              style={{ color: isTop ? "#4ade80" : "#22c55e" }}>
                              +{fmtGBP(amount)}
                            </td>
                            <td className="py-2.5 pr-4 text-[11px] font-mono tabular-nums text-right text-tx-3">
                              {fmtGBP(runningTotal)}
                            </td>
                            <td className="py-2.5 pr-4 text-tx-3 text-xs">{w.notes ?? "—"}</td>
                            <td className="py-2.5 text-right">
                              {deletingPayoutId === w.id ? (
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleDeletePayout(w.id)}
                                    className="rounded bg-loss/15 px-2 py-0.5 text-[10px] font-semibold text-loss transition-colors hover:bg-loss/25"
                                  >Confirm</button>
                                  <button
                                    onClick={() => setDeletingPayoutId(null)}
                                    className="rounded px-2 py-0.5 text-[10px] font-semibold text-tx-3 transition-colors hover:text-tx-1"
                                    style={{ background: "rgba(var(--surface-rgb),0.06)" }}
                                  >No</button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-0.5 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                                  <button
                                    onClick={() => openEditPayout(w)}
                                    className="rounded p-1.5 text-tx-3 transition-colors hover:text-tx-1"
                                    title="Edit payout"
                                  ><Edit2 size={11} /></button>
                                  <button
                                    onClick={() => setDeletingPayoutId(w.id)}
                                    className="rounded p-1.5 text-tx-3 transition-colors hover:bg-loss/10 hover:text-loss"
                                    title="Delete payout"
                                  ><Trash2 size={11} /></button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="border-t" style={{ borderColor: theme.border }}>
                      <td colSpan={2} className="pt-3 text-tx-3 text-xs font-medium">Total</td>
                      <td className="pt-3 text-right text-profit font-bold font-mono tabular-nums">+{fmtGBP(totalWithdrawals)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
          {/* Passed Challenge History */}
          {(data.passedChallenges ?? []).length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-tx-4 text-[10px] uppercase tracking-widest font-medium">Challenge Journey</div>
                  <div className="text-tx-1 text-sm font-semibold mt-0.5">Passed Challenges</div>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-warn" />
                  <span className="text-[11px] font-bold text-warn tabular-nums">{data.passedChallenges!.length} passed</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {[...(data.passedChallenges ?? [])].sort((a, b) => b.passedDate.localeCompare(a.passedDate)).map((c) => {
                  const firmCol = bwColor(getFirmColor(c.firm), isBW);
                  const profit  = c.finalBalance - c.initialBalance;
                  const isDeleting = deleteChallengeConfirm === c.id;
                  return (
                    <div key={c.id} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                      style={{ background: `${firmCol}08`, border: `1px solid ${isDeleting ? "#ef444430" : `${firmCol}18`}` }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: `${firmCol}20` }}>
                        <CheckCircle2 size={13} style={{ color: firmCol }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-tx-1">{c.firm}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: `${firmCol}15`, color: firmCol, border: `1px solid ${firmCol}28` }}>
                            {c.type}
                          </span>
                          {c.name && <span className="text-[10px] text-tx-3">{c.name}</span>}
                        </div>
                        <div className="text-[10px] text-tx-3 mt-0.5">Passed {fmtDate(c.passedDate)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-bold font-mono tabular-nums text-profit">
                          +{fmtUSD(profit)}
                        </div>
                        <div className="text-[10px] text-tx-3 font-mono">of {fmtUSD(c.profitTarget)} target</div>
                      </div>
                      {/* Actions */}
                      {isDeleting ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleDeleteChallenge(c.id)}
                            className="rounded px-2 py-1 text-[10px] font-semibold transition-colors"
                            style={{ background: "rgba(239,68,68,0.15)", color: "var(--color-loss)" }}
                          >Delete</button>
                          <button
                            onClick={() => setDeleteChallengeConfirm(null)}
                            className="rounded px-2 py-1 text-[10px] font-semibold text-tx-3 transition-colors hover:text-tx-1"
                            style={{ background: "rgba(var(--surface-rgb),0.07)" }}
                          >Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditChallengeId(c.id)}
                            className="rounded p-1.5 text-tx-3 transition-colors hover:text-tx-1"
                            title="Edit"
                          ><Edit2 size={11} /></button>
                          <button
                            onClick={() => setDeleteChallengeConfirm(c.id)}
                            className="rounded p-1.5 text-tx-4 transition-colors hover:bg-loss/10 hover:text-loss"
                            title="Delete"
                          ><Trash2 size={11} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Right: Trading Insights Sidebar ── */}
        <div className="xl:sticky xl:top-6">
          <TradingInsightsSidebar
            expenses={data.expenses}
            withdrawals={data.withdrawals}
            accounts={data.accounts}
            passedChallenges={data.passedChallenges ?? []}
          />
        </div>

      </div>

      {/* ── Add / Edit Account Modal ─────────────────────────────────── */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); setEditAccount(null); setAddQty(1); }}
        title={editAccount ? "Edit Account" : "Add Account"}
        size="md"
      >
        <div className="space-y-3">
          {(
            <div className="space-y-3">
              {/* Firm + Status */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Firm</label>
                  <CustomSelect
                    value={form.firm}
                    onChange={handleFirmChange}
                    options={[...FIRMS_BASE.map((f) => ({ value: f, label: f })), ...customFirms.map((f) => ({ value: f, label: f })), { value: "__other__", label: "Other..." }]}
                    placeholder="Select firm…"
                    allowCustom
                    customOptionValue="__other__"
                    customValue={form.customFirm}
                    onCustomValueChange={(v) => setForm((p) => ({ ...p, customFirm: v }))}
                    customLabel="Enter firm name…"
                    onSaveCustom={(name) => { saveCustomFirm(name); setCustomFirms(loadCustomFirms()); setForm((p) => ({ ...p, firm: name, customFirm: "" })); }}
                    onDeleteOption={(name) => { deleteCustomFirm(name); setCustomFirms(loadCustomFirms()); }}
                    canDelete={(name) => !FIRMS_BASE.includes(name as typeof FIRMS_BASE[number]) && name !== "__other__"}
                  />
                </div>
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Status</label>
                  <CustomSelect
                    value={form.status}
                    onChange={(v) => handleStatusChange(v as AccountStatus)}
                    options={[
                      { value: "challenge", label: "Challenge" },
                      { value: "funded", label: "Funded" },
                      { value: "breached", label: "Breached" },
                    ]}
                    placeholder="Select status…"
                  />
                </div>
              </div>

              {/* Plan selects (Lucid / Tradeify only) */}
              {firmHasPlans ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-tx-3 text-xs block mb-1">Plan</label>
                    <CustomSelect
                      value={activePlanKey}
                      onChange={(v) => handlePlanKeyChange(v)}
                      options={availablePlans.map((p) => ({ value: p.key, label: p.label }))}
                      placeholder="Select plan…"
                    />
                  </div>
                  <div>
                    <label className="text-tx-3 text-xs block mb-1">Account Size</label>
                    <CustomSelect
                      value={form.planSize}
                      onChange={(v) => handlePlanSizeChange(v)}
                      options={availablePlanSizes.map((sz) => ({ value: String(sz), label: `$${(sz / 1000).toFixed(0)}K` }))}
                      placeholder="Select size…"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Account Type</label>
                  <input className="nx-input" placeholder="e.g. 50K Flex" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
                </div>
              )}

              {/* Balance */}
              <div>
                <label className="text-tx-3 text-xs block mb-1">Current Balance ($)</label>
                <input className="nx-input" type="number" placeholder="50000" value={form.balance} onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))} />
              </div>

              <div>
                <label className="text-tx-3 text-xs block mb-1">Highest Balance Recorded ($)</label>
                <input
                  className="nx-input"
                  type="number"
                  placeholder="Used for trailing MLL"
                  value={form.peakBalance ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, peakBalance: e.target.value }))}
                />
              </div>

              {/* MLL & Profit Target */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Current MLL Floor ($)</label>
                  <input
                    className="nx-input"
                    type="number"
                    placeholder="24000"
                    value={firmHasPlans ? String(modalSnapshot?.mllFloor ?? "") : form.mll}
                    readOnly={firmHasPlans}
                    onChange={(e) => setForm((p) => ({ ...p, mll: e.target.value }))}
                  />
                </div>
                {form.status !== "funded" && (
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Profit Target ($)</label>
                  <input
                    className="nx-input"
                    type="number"
                    placeholder="1250"
                    value={form.profitTarget}
                    readOnly={firmHasPlans}
                    onChange={(e) => setForm((p) => ({ ...p, profitTarget: e.target.value }))}
                  />
                </div>
                )}
              </div>

              {/* Account Dates */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Challenge Started</label>
                  <DatePicker
                    value={form.challengeStartDate ?? ""}
                    onChange={(date) => setForm((p) => ({ ...p, challengeStartDate: date }))}
                  />
                </div>
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Funded Date</label>
                  <DatePicker
                    value={form.fundedAt ?? ""}
                    onChange={(date) => setForm((p) => ({ ...p, fundedAt: date }))}
                  />
                </div>
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Breached Date</label>
                  <DatePicker
                    value={form.breachedDate ?? ""}
                    onChange={(date) => setForm((p) => ({ ...p, breachedDate: date }))}
                  />
                </div>
              </div>

              {modalSnapshot && !isNaN(modalSnapshot.distanceToMll) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border px-3 py-2 text-[11px] text-tx-3" style={{ background: "rgba(var(--surface-rgb),0.04)", borderColor: theme.border }}>
                    <div className="uppercase tracking-[0.14em] text-[10px] text-tx-4">Drawdown Left</div>
                    <div className="mt-1 text-sm font-semibold text-tx-1">{fmtUSD(modalSnapshot.distanceToMll)}</div>
                  </div>
                  <div className="rounded-xl border px-3 py-2 text-[11px] text-tx-3" style={{ background: "rgba(var(--surface-rgb),0.04)", borderColor: theme.border }}>
                    <div className="uppercase tracking-[0.14em] text-[10px] text-tx-4">Floor State</div>
                    <div className="mt-1 text-sm font-semibold text-tx-1">
                      {modalSnapshot.locked ? `Locked at ${fmtUSD(modalSnapshot.lockFloor)}` : `Trailing from peak ${fmtUSD(modalSnapshot.peakBalance)}`}
                    </div>
                  </div>
                </div>
              )}

              {modalRules && (
                <div className="rounded-xl border px-3 py-2.5 text-[11px] text-tx-3" style={{ background: "rgba(var(--surface-rgb),0.04)", borderColor: theme.border }}>
                  <div className="flex items-center justify-between gap-3">
                    <span>{modalRules.label} {(modalRules.size / 1000).toFixed(0)}K</span>
                    <span>{fmtUSD(modalRules.drawdown)} drawdown</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <span>Locks at {fmtUSD(modalRules.lockFloor)}</span>
                    <span>{modalRules.profitTarget !== null ? `${fmtUSD(modalRules.profitTarget)} target` : "Funded rule set"}</span>
                  </div>
                </div>
              )}

              {!editAccount && (
                <div>
                  <label className="text-tx-3 text-xs block mb-1">Quantity <span className="opacity-50 text-[10px]">(add multiple at once)</span></label>
                  <input
                    className="nx-input"
                    type="number"
                    min={1}
                    max={50}
                    value={addQty}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") { setAddQty(""); return; }
                      const n = parseInt(v);
                      if (!isNaN(n)) setAddQty(Math.min(50, n));
                    }}
                  />
                </div>
              )}

              <div className="modal-action-bar">
                <button className="btn-primary btn flex-1" onClick={handleSaveAccount}>
                  {editAccount ? "Update Account" : typeof addQty === "number" && addQty > 1 ? `Add ${addQty} Accounts` : "Add Account"}
                </button>
                <button className="btn-ghost btn" onClick={() => { setAddOpen(false); setEditAccount(null); setAddQty(1); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Record / Edit Payout Modal ─────────────────────────────── */}
      <Modal
        open={payoutOpen}
        onClose={() => { setPayoutOpen(false); setEditPayoutId(null); setPayoutForm(emptyPayoutForm()); }}
        title={editPayoutId ? "Edit Payout" : "Record Payout"}
        size="sm"
      >
        <div className="space-y-3">
          <div>
            <label className="text-tx-3 text-xs block mb-1">Firm</label>
            <CustomSelect
              value={payoutForm.firm}
              onChange={(v) => setPayoutForm((p) => ({ ...p, firm: v, customFirm: v === OTHER_FIRM_VALUE ? p.customFirm : "" }))}
              options={[...FIRMS_BASE.map((f) => ({ value: f, label: f })), ...customFirms.map((f) => ({ value: f, label: f })), { value: OTHER_FIRM_VALUE, label: "Other..." }]}
              placeholder="Select firm…"
              allowCustom
              customOptionValue={OTHER_FIRM_VALUE}
              customValue={payoutForm.customFirm}
              onCustomValueChange={(v) => setPayoutForm((p) => ({ ...p, customFirm: v }))}
              customLabel="Enter firm name…"
              onSaveCustom={(name) => { saveCustomFirm(name); setCustomFirms(loadCustomFirms()); setPayoutForm((p) => ({ ...p, firm: name, customFirm: "" })); }}
              onDeleteOption={(name) => { deleteCustomFirm(name); setCustomFirms(loadCustomFirms()); }}
              canDelete={(name) => !FIRMS_BASE.includes(name as typeof FIRMS_BASE[number]) && name !== OTHER_FIRM_VALUE}
            />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Linked Account</label>
            <select
              className="nx-select"
              value={payoutForm.accountId}
              onChange={(e) => {
                const nextAccount = payoutAccountOptions.find((option) => option.value === e.target.value);
                setPayoutForm((prev) => ({
                  ...prev,
                  accountId: e.target.value,
                  firm: nextAccount?.firm ?? prev.firm,
                  customFirm: nextAccount?.firm ? "" : prev.customFirm,
                }));
              }}
            >
              <option value="">No linked account</option>
              {payoutAccountOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}{option.active ? "" : " - Inactive"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Date</label>
            <DatePicker value={payoutForm.date} onChange={(date) => setPayoutForm((p) => ({ ...p, date }))} />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">
              Gross Amount (£)
              {payoutForm.accountId && <span className="text-[10px] text-tx-3 ml-1.5">— will deduct from account balance</span>}
            </label>
            <input className="nx-input" type="number" placeholder="0.00" value={payoutForm.gross} onChange={(e) => setPayoutForm((p) => ({ ...p, gross: e.target.value }))} />
          </div>
          <div>
            <label className="text-tx-3 text-xs block mb-1">Notes</label>
            <textarea
              className="nx-input min-h-[60px] resize-y text-sm"
              placeholder="Optional"
              rows={2}
              value={payoutForm.notes}
              onChange={(e) => setPayoutForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="modal-action-bar">
            <button className="btn-success btn flex-1" onClick={handleSavePayout} disabled={!payoutForm.gross || (payoutForm.firm === OTHER_FIRM_VALUE && !payoutForm.customFirm.trim())}>
              <Banknote size={14} />
              {editPayoutId ? "Update Payout" : "Save Payout"}
            </button>
            <button className="btn-ghost btn" onClick={() => { setPayoutOpen(false); setEditPayoutId(null); setPayoutForm(emptyPayoutForm()); }}>Cancel</button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Passed Challenge Modal ─────────────────────────────── */}
      {editChallengeId && (() => {
        const ch = (data.passedChallenges ?? []).find((c) => c.id === editChallengeId);
        if (!ch) return null;
        return (
          <EditChallengeModal
            challenge={ch}
            onClose={() => setEditChallengeId(null)}
            onSave={handleSaveChallenge}
          />
        );
      })()}
    </div>
  );
}
