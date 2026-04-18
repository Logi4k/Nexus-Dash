import { useState, useEffect, useRef } from "react";
import {
  User,
  Bell,
  Save,
  Camera,
  Palette,
  Smartphone,
  Download,
  Cloud,
  RefreshCw,
  ArrowDownToLine,
  AlertTriangle,
  LogOut,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import AvatarCropModal from "@/components/AvatarCropModal";
import { forcePullFromCloud, syncNow, useAppData, useSyncStatus } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { deleteAvatar, uploadAvatar } from "@/lib/avatarStorage";
import {
  checkDesktopUpdate,
  formatDesktopUpdaterError,
  installDesktopUpdate,
  isDesktopUpdaterRuntime,
  requestDesktopRestart,
  type DesktopUpdateStatus,
} from "@/lib/desktopUpdater";
import { cn } from "@/lib/utils";
import { DEFAULT_MOBILE_NAV_ITEMS, MOBILE_NAV_OPTIONS, sanitizeMobileNavItems } from "@/lib/mobileNav";
import type { MobileNavItemId } from "@/types";
import type { AppData } from "@/types";

// ── Export helpers ────────────────────────────────────────────────────────────
function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toCSV(rows: Record<string, unknown>[], headers: string[]): string {
  const escape = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return /[,\n"]/.test(s) ? `"${s}"` : s;
  };
  return [
    headers.join(","),
    ...rows.map(row => headers.map(h => escape(row[h])).join(","))
  ].join("\n");
}

function formatSyncTime(timestamp: number | null): string {
  if (!timestamp) return "Not yet";
  return new Date(timestamp).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const AVATAR_COLORS = [
  "#5aadaa", // teal (accent)
  "#5b8bbf", // blue
  "#9b8ec2", // purple
  "#c070a0", // pink
  "#fbbf24", // amber
  "#4a9a7a", // emerald
  "#f87171", // red
  "#c49060", // orange
  "#5aafc0", // cyan
  "#a3e635", // lime
];

const RENEWAL_DAYS_OPTIONS = [
  { label: "1 day before",   value: 1  },
  { label: "3 days before",  value: 3  },
  { label: "5 days before",  value: 5  },
  { label: "1 week before",  value: 7  },
  { label: "2 weeks before", value: 14 },
  { label: "1 month before", value: 30 },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

interface BackupImportPreview {
  data: AppData;
  fileName: string;
  formatVersion: number | null;
  summary: Array<{ label: string; count: number }>;
}

interface BackupEnvelope {
  formatVersion: number;
  exportedAt: string;
  data: AppData;
}

const BACKUP_FORMAT_VERSION = 2;
const LAST_IMPORT_BACKUP_KEY = "nexus_last_import_backup";

function summarizeBackup(data: AppData): Array<{ label: string; count: number }> {
  return [
    { label: "Trades", count: data.tradeJournal?.length ?? 0 },
    { label: "Prop accounts", count: data.accounts?.length ?? 0 },
    { label: "Payouts", count: data.withdrawals?.length ?? 0 },
    { label: "Expenses", count: (data.expenses?.length ?? 0) + (data.genExpenses?.length ?? 0) },
    { label: "Investments", count: data.investments?.length ?? 0 },
    { label: "Subscriptions", count: data.subscriptions?.length ?? 0 },
    { label: "Ideas", count: data.ideaNotes?.length ?? 0 },
    { label: "Topics", count: data.ideaTopics?.length ?? 0 },
    { label: "Debts", count: data.debts?.length ?? 0 },
  ];
}

function isValidBackupShape(parsed: unknown): parsed is AppData {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  const candidate = parsed as Record<string, unknown>;
  const listFields = [
    "tradeJournal",
    "accounts",
    "withdrawals",
    "expenses",
    "genExpenses",
    "investments",
    "subscriptions",
    "ideaNotes",
    "ideaTopics",
    "debts",
  ];
  return listFields.every((field) => candidate[field] === undefined || Array.isArray(candidate[field]));
}

function parseBackupFile(parsed: unknown): { data: AppData; formatVersion: number | null } | null {
  if (isValidBackupShape(parsed)) {
    return { data: parsed, formatVersion: null };
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const candidate = parsed as Partial<BackupEnvelope>;
    if (typeof candidate.formatVersion === "number" && isValidBackupShape(candidate.data)) {
      return { data: candidate.data, formatVersion: candidate.formatVersion };
    }
  }

  return null;
}

export default function SettingsModal({ open, onClose }: Props) {
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const syncStatus = useSyncStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Local draft state — only committed on Save
  const [username, setUsername] = useState(
    () => data.userProfile?.username ?? "Trader"
  );
  const [avatarColor, setAvatarColor] = useState(
    () => data.userProfile?.avatarColor ?? "#5aadaa"
  );
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    () => data.userProfile?.avatarUrl
  );
  const [renewalDays, setRenewalDays] = useState(
    () => data.userSettings?.subscriptionRenewalDays ?? 7
  );
  const [subscriptionAlertsEnabled, setSubscriptionAlertsEnabled] = useState(
    () => data.userSettings?.subscriptionAlertsEnabled ?? true
  );
  const [quarterlyFocus, setQuarterlyFocus] = useState(
    () => data.userSettings?.quarterlyFocus ?? ""
  );
  const [quarterlyMetricTarget, setQuarterlyMetricTarget] = useState(
    () => data.userSettings?.quarterlyMetricTarget ?? ""
  );
  const [theme, setTheme] = useState<"dark" | "bw">(
    () => data.userSettings?.theme ?? "dark"
  );
  const [density, setDensity] = useState<"comfortable" | "compact">(
    () => data.userSettings?.density ?? "comfortable"
  );
  const [mobileNavItems, setMobileNavItems] = useState<MobileNavItemId[]>(
    () => sanitizeMobileNavItems(data.userSettings?.mobileNavItems).length > 0
      ? sanitizeMobileNavItems(data.userSettings?.mobileNavItems)
      : DEFAULT_MOBILE_NAV_ITEMS
  );
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState<DesktopUpdateStatus | null>(null);
  const [desktopUpdateAction, setDesktopUpdateAction] = useState<"idle" | "checking" | "installing" | "restart-ready">("idle");
  const [installedDesktopVersion, setInstalledDesktopVersion] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<BackupImportPreview | null>(null);
  const [lastImportBackupAt, setLastImportBackupAt] = useState<string | null>(null);
  const desktopUpdaterVisible = isDesktopUpdaterRuntime();
  // Re-sync draft state each time the modal opens
  useEffect(() => {
    if (!open) return;
    setUsername(data.userProfile?.username ?? "Trader");
    setAvatarColor(data.userProfile?.avatarColor ?? "#5aadaa");
    setAvatarUrl(data.userProfile?.avatarUrl);
    setRenewalDays(data.userSettings?.subscriptionRenewalDays ?? 7);
    setSubscriptionAlertsEnabled(data.userSettings?.subscriptionAlertsEnabled ?? true);
    setQuarterlyFocus(data.userSettings?.quarterlyFocus ?? "");
    setQuarterlyMetricTarget(data.userSettings?.quarterlyMetricTarget ?? "");
    setTheme(data.userSettings?.theme ?? "dark");
    setDensity(data.userSettings?.density ?? "comfortable");
    setMobileNavItems(
      sanitizeMobileNavItems(data.userSettings?.mobileNavItems).length > 0
        ? sanitizeMobileNavItems(data.userSettings?.mobileNavItems)
        : DEFAULT_MOBILE_NAV_ITEMS
    );
    setImportPreview(null);
    try {
      const raw = localStorage.getItem(LAST_IMPORT_BACKUP_KEY);
      if (!raw) {
        setLastImportBackupAt(null);
        return;
      }
      const parsed = JSON.parse(raw) as { savedAt?: string };
      setLastImportBackupAt(parsed.savedAt ?? null);
    } catch {
      setLastImportBackupAt(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function updateViewport() {
      setIsMobileViewport(window.innerWidth < 768);
    }

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  function toggleMobileNavItem(id: MobileNavItemId) {
    setMobileNavItems((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setCropSource(result);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  async function handleSave() {
    if (isSaving) return;

    setIsSaving(true);

    const previousAvatarUrl = data.userProfile?.avatarUrl;
    let nextAvatarUrl = avatarUrl;

    if (nextAvatarUrl?.startsWith("data:")) {
      const uploadedAvatarUrl = await uploadAvatar(nextAvatarUrl);
      if (!uploadedAvatarUrl) {
        toast.error("Profile photo upload failed. Please try again.");
        setIsSaving(false);
        return;
      }
      nextAvatarUrl = uploadedAvatarUrl;
    }

    update((prev) => ({
      ...prev,
      userProfile: {
        username:    username.trim() || "Trader",
        avatarColor,
        avatarUrl: nextAvatarUrl,
      },
      userSettings: {
        ...(prev.userSettings ?? {}),
        subscriptionRenewalDays: renewalDays,
        subscriptionAlertsEnabled,
        quarterlyFocus: quarterlyFocus.trim() || undefined,
        quarterlyMetricTarget: quarterlyMetricTarget.trim() || undefined,
        theme,
        density,
        mobileNavItems,
      },
    }));

    if (previousAvatarUrl && !nextAvatarUrl) {
      void deleteAvatar().catch((err) => console.error("[settings] Avatar delete failed:", err));
    }

    setIsSaving(false);
    onClose();
  }

  function handleReset() {
    update((prev) => ({
      ...prev,
      userProfile: {
        username: "Trader",
        avatarColor: "#5aadaa",
        avatarUrl: undefined,
      },
      userSettings: {
        ...(prev.userSettings ?? {}),
        subscriptionRenewalDays: 7,
        subscriptionAlertsEnabled: true,
        quarterlyFocus: undefined,
        quarterlyMetricTarget: undefined,
        onboardingChecklistDismissed: false,
        theme: "dark",
        density: "comfortable",
        mobileNavItems: DEFAULT_MOBILE_NAV_ITEMS,
        savedViews: [],
        recentEntries: [],
      },
    }));
    toast.success("Settings reset to defaults");
    onClose();
  }

  function exportAllJSON() {
    const payload: BackupEnvelope = {
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      data,
    };
    const json = JSON.stringify(payload, null, 2);
    downloadFile(json, `nexus-backup-${todayISO()}.json`, "application/json");
  }

  function exportTradesCSV() {
    const headers = ["date","time","instrument","direction","entryPrice","exitPrice","stopLoss","contracts","pnl","fees","setup","session","notes","tags"];
    const rows = (data.tradeJournal ?? []) as unknown as Record<string, unknown>[];
    downloadFile(toCSV(rows, headers), `nexus-trades-${todayISO()}.csv`, "text/csv");
  }

  function exportExpensesCSV() {
    const headers = ["date","description","amount","cat","firm"];
    const rows = (data.expenses ?? []) as unknown as Record<string, unknown>[];
    downloadFile(toCSV(rows, headers), `nexus-expenses-${todayISO()}.csv`, "text/csv");
  }

  async function handleImportBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const backup = parseBackupFile(parsed);

      if (!backup) {
        throw new Error("The selected file is not a valid Nexus backup.");
      }

      setImportPreview({
        data: backup.data,
        fileName: file.name,
        formatVersion: backup.formatVersion,
        summary: summarizeBackup(backup.data),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      e.target.value = "";
    }
  }

  function applyImportPreview() {
    if (!importPreview) return;
    const savedAt = new Date().toISOString();
    try {
      localStorage.setItem(
        LAST_IMPORT_BACKUP_KEY,
        JSON.stringify({
          savedAt,
          data,
        }),
      );
      setLastImportBackupAt(savedAt);
    } catch {
      // ignore backup storage failures; import still proceeds
    }
    update(() => importPreview.data);
    toast.success("Backup imported");
    setImportPreview(null);
    onClose();
  }

  function rollbackLastImport() {
    try {
      const raw = localStorage.getItem(LAST_IMPORT_BACKUP_KEY);
      if (!raw) {
        toast.error("No import rollback snapshot is available.");
        return;
      }
      const parsed = JSON.parse(raw) as { data?: AppData };
      if (!parsed.data || !isValidBackupShape(parsed.data)) {
        toast.error("The stored rollback snapshot is invalid.");
        return;
      }
      const rollbackData = parsed.data;
      update(() => rollbackData);
      localStorage.removeItem(LAST_IMPORT_BACKUP_KEY);
      setLastImportBackupAt(null);
      toast.success("Rolled back the last import.");
      onClose();
    } catch {
      toast.error("Could not restore the last import snapshot.");
    }
  }

  async function handleSyncNow() {
    const result = await syncNow();
    if (result.ok) {
      toast.success("Sync complete");
    } else {
      toast.error(result.message);
    }
  }

  async function handlePullLatest() {
    const ok = await forcePullFromCloud();
    if (ok) {
      toast.success("Pulled latest cloud data");
    } else {
      toast.error("Couldn't pull cloud data right now.");
    }
  }

  async function loadDesktopUpdateStatus(notifyOnError = false) {
    if (!desktopUpdaterVisible) return;

    setDesktopUpdateAction("checking");
    try {
      const status = await checkDesktopUpdate();
      setDesktopUpdateStatus({
        ...status,
        error: formatDesktopUpdaterError(status.error),
      });
      if (notifyOnError && status.error) {
        toast.error(`Update check failed: ${formatDesktopUpdaterError(status.error)}`);
      }
    } catch (error) {
      const message = formatDesktopUpdaterError(error instanceof Error ? error.message : "Update check failed.");
      setDesktopUpdateStatus((prev) => ({
        supported: true,
        configured: prev?.configured ?? false,
        currentVersion: prev?.currentVersion ?? "desktop",
        available: false,
        version: null,
        date: null,
        body: null,
        error: message,
      }));
      if (notifyOnError) {
        toast.error(message);
      }
    } finally {
      setDesktopUpdateAction("idle");
    }
  }

  async function handleInstallDesktopUpdate() {
    setDesktopUpdateAction("installing");
    try {
      const result = await installDesktopUpdate();
      if (!result.installed) {
        toast.message("No newer desktop update is available.");
        await loadDesktopUpdateStatus(false);
        return;
      }

      setInstalledDesktopVersion(result.version ?? null);
      setDesktopUpdateAction("restart-ready");
      toast.success(`Version ${result.version ?? "update"} installed. Restart Nexus to finish.`);
    } catch (error) {
      const message = formatDesktopUpdaterError(
        error instanceof Error ? error.message : "Desktop update install failed."
      );
      toast.error(message);
      setDesktopUpdateAction("idle");
      await loadDesktopUpdateStatus(false);
    }
  }

  async function handleRestartDesktopApp() {
    try {
      await requestDesktopRestart();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Restart failed. Close and reopen Nexus to finish the update.";
      toast.error(message);
    }
  }

  useEffect(() => {
    if (!open || !desktopUpdaterVisible) return;
    void loadDesktopUpdateStatus(false);
  }, [open, desktopUpdaterVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const initials = (username.trim() || "T").slice(0, 2).toUpperCase();
  const syncBadge = syncStatus.lastError
    ? { label: "Needs attention", className: "bg-loss/10 border-loss/20 text-loss" }
    : syncStatus.syncInFlight
      ? { label: "Syncing", className: "text-info" }
      : syncStatus.realtimeState === "connected"
        ? { label: "Live", className: "bg-profit/10 border-profit/20 text-profit" }
        : syncStatus.enabled
          ? { label: "Manual", className: "bg-warn/10 border-warn/20 text-warn" }
          : { label: "Signed out", className: "bg-accent-muted border-border-subtle text-tx-3" };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Settings"
        size={isMobileViewport ? "md" : "xl"}
      >
        {/* Card-based layout — responsive, works on all screen sizes */}
        <div className="space-y-3">

          {/* ── Profile Card ── */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(var(--accent), 0.1)" }}>
                <User size={13} style={{ color: "var(--accent)" }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tx-4">Profile</span>
            </div>

            {/* Avatar + username row */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-shrink-0 group">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-base select-none overflow-hidden cursor-pointer"
                  style={avatarUrl ? {} : {
                    background: avatarColor + "20",
                    border: `2px solid ${avatarColor}50`,
                    color: avatarColor,
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload photo"
                >
                  {avatarUrl
                    ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                    : initials
                  }
                </div>
                <div
                  className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera size={13} className="text-tx-1" />
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-[9px] font-medium mb-1 block text-tx-4">Username</label>
                <input
                  type="text"
                  className="nx-input text-xs"
                  maxLength={24}
                  placeholder="Trader"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Avatar colour swatches (only when no photo) */}
            {!avatarUrl && (
              <div className="mb-3">
                <label className="text-[9px] font-medium mb-2 flex items-center gap-1.5 text-tx-4">
                  Avatar colour
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setAvatarColor(color)}
                      className="w-8 h-8 rounded-xl transition-all flex items-center justify-center flex-shrink-0"
                      style={{
                        background: color,
                        transform: avatarColor === color ? "scale(1.18)" : "scale(1)",
                        boxShadow: avatarColor === color ? `0 0 10px ${color}80` : "none",
                        outline: avatarColor === color ? `2px solid ${color}` : "none",
                        outlineOffset: "2px",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Notifications Card ── */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
                <Bell size={13} style={{ color: "var(--color-warn)" }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tx-4">Notifications</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-tx-2">Subscription renewals</p>
                <p className="text-[10px] mt-0.5 text-tx-3">Alert before a subscription renews</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={subscriptionAlertsEnabled}
                onClick={() => setSubscriptionAlertsEnabled((v) => !v)}
                className={cn(
                  "w-10 h-6 rounded-full relative cursor-pointer transition-all duration-200",
                  subscriptionAlertsEnabled ? "bg-accent" : "bg-[var(--border-rgb)]"
                )}
                style={{ opacity: subscriptionAlertsEnabled ? 1 : 0.5 }}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-transform duration-200",
                    subscriptionAlertsEnabled ? "translate-x-4 bg-bg-elevated" : "translate-x-0.5 bg-[var(--tx-1)]"
                  )}
                />
              </button>
            </div>

            <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgba(var(--border-rgb),0.05)" }}>
              <p className="text-[10px] font-medium mb-2 text-tx-4">Renewal notice</p>
              <div className="flex flex-wrap gap-1.5">
                {RENEWAL_DAYS_OPTIONS.map(({label, value}) => (
                  <button
                    key={value}
                    onClick={() => setRenewalDays(value)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all border",
                      renewalDays === value
                        ? "bg-accent-muted border-border-accent text-tx-1"
                        : "bg-transparent text-tx-4"
                    )}
                    style={renewalDays !== value ? { border: "1px solid rgba(var(--border-rgb),0.07)" } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Quarterly focus ── */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(14,184,154,0.12)" }}>
                <Target size={13} style={{ color: "var(--color-accent)" }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tx-4">Quarterly focus</span>
            </div>
            <p className="text-[10px] text-tx-4 mb-3">
              Shown on your dashboard as a lightweight north star (not financial advice).
            </p>
            <label className="text-[9px] font-medium mb-1.5 block text-tx-4">This quarter I am focused on</label>
            <input
              className="nx-input w-full text-xs mb-3"
              placeholder="e.g. Risk-first evals, fewer revenge trades"
              value={quarterlyFocus}
              onChange={(e) => setQuarterlyFocus(e.target.value)}
            />
            <label className="text-[9px] font-medium mb-1.5 block text-tx-4">Target metric (optional)</label>
            <input
              className="nx-input w-full text-xs"
              placeholder="e.g. 3 funded payouts, journal 20+ days"
              value={quarterlyMetricTarget}
              onChange={(e) => setQuarterlyMetricTarget(e.target.value)}
            />
          </div>

          {/* ── Appearance Card ── */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--color-purple-bg)" }}>
                <Palette size={13} style={{ color: "var(--color-purple)" }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tx-4">Appearance</span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-tx-2">Theme</p>
                <p className="text-[10px] mt-0.5 text-tx-3">Dark workspace or high-contrast paper mode</p>
              </div>
              <div className="flex items-center rounded-xl p-0.5" style={{ background: "rgba(var(--surface-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                {(["dark","bw"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setTheme(v)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
                      theme === v
                        ? "bg-accent-muted border border-border-accent text-tx-1"
                        : "text-tx-3 border border-transparent"
                    )}
                  >
                    {v === "dark" ? "Dark" : "Paper"}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="mt-4 pt-4 flex items-center justify-between"
              style={{ borderTop: "1px solid rgba(var(--border-rgb),0.05)" }}
            >
              <div>
                <p className="text-xs font-medium text-tx-2">Density</p>
                <p className="text-[10px] mt-0.5 text-tx-3">Choose a roomy or compact workspace</p>
              </div>
              <div className="flex items-center rounded-xl p-0.5" style={{ background: "rgba(var(--surface-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                {(["comfortable","compact"] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setDensity(v)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all",
                      density === v
                        ? "bg-accent-muted border border-border-accent text-tx-1"
                        : "text-tx-3 border border-transparent"
                    )}
                  >
                    {v === "comfortable" ? "Comfort" : "Compact"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sync Card ── */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(var(--color-profit-rgb), 0.12)" }}>
                <Cloud size={13} style={{ color: "var(--color-profit)" }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tx-4">Sync</span>
              <span
                className={cn(
                  "ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full",
                  syncBadge.className.includes("profit")
                    ? "bg-profit/10 border border-profit/20 text-profit"
                    : syncBadge.className.includes("warn")
                      ? "bg-warn/10 border border-warn/20 text-warn"
                      : "text-tx-4"
                )}
                style={!syncBadge.className.includes("profit") && !syncBadge.className.includes("warn") ? { background: "rgba(var(--surface-rgb),0.06)", border: "1px solid rgba(var(--border-rgb),0.08)" } : undefined}
              >
                {syncBadge.label}
              </span>
            </div>

            <p className="text-[10px] mb-3 text-tx-4">
              {syncStatus.realtimeState === "connected"
                ? "Realtime channel is connected."
                : syncStatus.enabled
                  ? "Manual sync available if realtime drops."
                  : "Sign in required for cloud sync."}
            </p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                <p className="text-[8px] uppercase tracking-[0.12em] text-tx-3">Last sync</p>
                <p className="text-xs font-semibold mt-1">{formatSyncTime(syncStatus.syncedAt)}</p>
              </div>
              <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(var(--surface-rgb),0.03)", border: "1px solid rgba(var(--border-rgb),0.06)" }}>
                <p className="text-[8px] uppercase tracking-[0.12em] text-tx-3">Last save</p>
                <p className="text-xs font-semibold mt-1">{formatSyncTime(syncStatus.localSavedAt)}</p>
              </div>
            </div>

            {syncStatus.lastError && (
              <div className="rounded-xl px-3 py-2 mb-3 flex items-start gap-2" style={{ background: "var(--color-loss-bg)", border: "1px solid var(--color-loss-border)" }}>
                <AlertTriangle size={11} style={{ color: "var(--color-loss)" }} className="mt-0.5 shrink-0" />
                <p className="text-[10px] leading-relaxed" style={{ color: "var(--color-loss)" }}>{syncStatus.lastError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSyncNow}
                disabled={!syncStatus.enabled || syncStatus.syncInFlight}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all"
                style={{ background: "rgba(107,155,191,0.15)", border: "1px solid rgba(107,155,191,0.25)", color: "var(--tx-1)" }}
              >
                <RefreshCw size={11} className={syncStatus.syncInFlight ? "animate-spin" : ""} />
                {syncStatus.syncInFlight ? "Syncing..." : "Sync now"}
              </button>
              <button
                onClick={handlePullLatest}
                disabled={!syncStatus.enabled || syncStatus.syncInFlight}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all text-tx-2"
                style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
              >
                <ArrowDownToLine size={11} />
                Pull
              </button>
            </div>

            {/* Sign Out button */}
            {syncStatus.enabled ? (
              <button
                onClick={async () => {
                  if (confirm("Sign out? Local data will remain on this device.")) {
                    await supabase?.auth.signOut();
                    localStorage.removeItem("nexus.offlineMode");
                    window.location.reload();
                  }
                }}
                className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all text-tx-3 hover:text-tx-1"
                style={{ background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
              >
                <LogOut size={11} />
                Sign out
              </button>
            ) : (
              <button
                onClick={() => {
                  localStorage.removeItem("nexus.offlineMode");
                  window.location.reload();
                }}
                className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all"
                style={{ background: "rgba(107,155,191,0.15)", border: "1px solid rgba(107,155,191,0.25)", color: "var(--tx-1)" }}
              >
                <LogOut size={11} />
                Sign in
              </button>
            )}
          </div>

          {/* ── Desktop Updates ── */}
          {desktopUpdaterVisible && (
            <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--color-purple-bg)" }}>
                  <ArrowDownToLine size={13} style={{ color: "var(--color-purple)" }} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tx-4">Desktop Updates</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-tx-2">OTA updater</p>
                    <p className="text-[8px] text-tx-4 mt-0.5">
                      Current version {desktopUpdateStatus?.currentVersion ?? "loading..."}
                      {desktopUpdateStatus?.available && desktopUpdateStatus.version
                        ? ` · update ${desktopUpdateStatus.version} ready`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-semibold px-2 py-0.5 rounded-full border",
                      desktopUpdateStatus?.error
                        ? "bg-loss/10 border-loss/20 text-loss"
                        : !desktopUpdateStatus?.configured
                        ? "bg-warn/10 border-warn/20 text-warn"
                        : desktopUpdateStatus.available
                          ? "bg-profit/10 border-profit/20 text-profit"
                          : "bg-accent-muted border-border-subtle text-tx-3"
                    )}
                  >
                    {desktopUpdateStatus?.error
                      ? "Check failed"
                      : !desktopUpdateStatus?.configured
                      ? "Not configured"
                      : desktopUpdateStatus.available
                        ? "Update ready"
                        : "Up to date"}
                  </span>
                </div>

                {!desktopUpdateStatus?.configured ? (
                  <div className="rounded-md px-2 py-1.5 border border-warn/20 bg-warn/10">
                    <p className="text-[9px] leading-relaxed text-warn">
                      Set <span className="font-semibold">TAURI_UPDATER_PUBKEY</span> and <span className="font-semibold">TAURI_UPDATER_ENDPOINTS</span> before building the desktop release to enable OTA updates.
                    </p>
                  </div>
                ) : null}

                {desktopUpdateStatus?.body ? (
                  <div className="rounded-md px-2 py-1.5 border border-border-subtle bg-bg-hover/40">
                    <p className="text-[8px] uppercase tracking-[0.14em] text-tx-4 mb-0.5">Release Notes</p>
                    <p className="text-[9px] leading-relaxed text-tx-3 whitespace-pre-wrap">
                      {desktopUpdateStatus.body}
                    </p>
                  </div>
                ) : null}

                {desktopUpdateStatus?.error ? (
                  <div className="rounded-md px-2 py-1.5 border border-loss/20 bg-loss/10">
                    <p className="text-[9px] leading-relaxed text-loss">
                      {desktopUpdateStatus.error}
                    </p>
                  </div>
                ) : null}

                {desktopUpdateAction === "restart-ready" ? (
                  <div className="rounded-md px-2 py-1.5 border border-profit/20 bg-profit/10">
                    <p className="text-[9px] leading-relaxed text-profit">
                      Version {installedDesktopVersion ?? "update"} is installed. Restart Nexus to finish.
                    </p>
                  </div>
                ) : null}

                <div className="flex gap-1.5">
                  <button
                    onClick={() => void loadDesktopUpdateStatus(true)}
                    disabled={desktopUpdateAction !== "idle"}
                    className="text-[9px] font-semibold px-2 py-1.5 rounded-md flex items-center gap-1.5 transition-all bg-bg-hover/40 border border-border-subtle text-tx-2 disabled:opacity-50"
                  >
                    <RefreshCw size={10} className={desktopUpdateAction === "checking" ? "animate-spin" : ""} />
                    {desktopUpdateAction === "checking" ? "Checking..." : "Check"}
                  </button>
                  <button
                    onClick={() => {
                      if (desktopUpdateAction === "restart-ready") {
                        void handleRestartDesktopApp();
                        return;
                      }
                      void handleInstallDesktopUpdate();
                    }}
                    disabled={
                      desktopUpdateAction !== "restart-ready" &&
                      (desktopUpdateAction !== "idle" || !desktopUpdateStatus?.available)
                    }
                    className="text-[9px] font-semibold px-2 py-1.5 rounded-md flex items-center gap-1.5 transition-all bg-accent-glow border border-border-accent text-tx-1 disabled:opacity-50"
                  >
                    <ArrowDownToLine size={10} className={desktopUpdateAction === "installing" ? "animate-bounce" : ""} />
                    {desktopUpdateAction === "installing"
                      ? "Installing..."
                      : desktopUpdateAction === "restart-ready"
                        ? "Restart"
                        : "Update"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Mobile Nav ── */}
          {isMobileViewport && (
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(var(--accent), 0.1)" }}>
                <Smartphone size={13} style={{ color: "var(--accent)" }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tx-4">Mobile Nav</span>
              <span className="ml-auto text-[9px] text-tx-4">{mobileNavItems.length}/4</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {MOBILE_NAV_OPTIONS.map(item => {
                const active = mobileNavItems.includes(item.id);
                const disabled = !active && mobileNavItems.length >= 4;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => !disabled && toggleMobileNavItem(item.id)}
                    disabled={disabled}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all",
                      active
                        ? "bg-accent/15 border border-accent/30 text-tx-1"
                        : disabled
                          ? "opacity-25 cursor-not-allowed text-tx-4"
                          : "text-tx-3 hover:text-tx-2"
                    )}
                    style={
                      active
                        ? undefined
                        : disabled
                          ? { border: "1px solid rgba(var(--border-rgb),0.04)" }
                          : { border: "1px solid rgba(var(--border-rgb),0.06)" }
                    }
                    onMouseEnter={!active && !disabled ? (e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(var(--border-rgb),0.1)"; } : undefined}
                    onMouseLeave={!active && !disabled ? (e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(var(--border-rgb),0.06)"; } : undefined}
                  >
                    <span>{item.label}</span>
                    {active && (
                      <svg width="6" height="6" viewBox="0 0 6 6" className="text-accent">
                        <circle cx="3" cy="3" r="3" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* ── Import / Export Data ── */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.12)" }}>
                <Download size={13} style={{ color: "var(--color-warn)" }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-tx-4">Import & Export</span>
            </div>
            <p className="text-[10px] mb-3 text-tx-4">Restore a full Nexus backup or download your data for backup and analysis.</p>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportBackup}
            />
            <div className="flex flex-wrap gap-1.5 mb-2">
              <label className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-accent-muted border border-border-subtle text-tx-3 hover:text-tx-1 transition-all cursor-pointer">
                Import
                <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportBackup} />
              </label>
              <button onClick={exportAllJSON} className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-accent-muted border border-border-subtle text-tx-3 hover:text-tx-1 transition-all">JSON backup</button>
              <button onClick={exportTradesCSV} className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-accent-muted border border-border-subtle text-tx-3 hover:text-tx-1 transition-all">Trades CSV</button>
              <button onClick={exportExpensesCSV} className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-accent-muted border border-border-subtle text-tx-3 hover:text-tx-1 transition-all">Expenses CSV</button>
            </div>
            {importPreview && (
              <div className="rounded-lg border border-warn/20 bg-warn/10 p-2 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={10} className="text-warn mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[9px] font-semibold text-warn">Review before replacing data</p>
                    <p className="text-[8px] text-warn/80 mt-0.5">
                      {importPreview.fileName} will replace the current dataset on this device.
                      {importPreview.formatVersion ? ` Backup format v${importPreview.formatVersion}.` : " Legacy format."}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {importPreview.summary.map((item) => (
                    <div key={item.label} className="rounded-md px-2 py-1 border border-warn/15 bg-black/10">
                      <p className="text-[8px] uppercase tracking-[0.14em] text-warn/70">{item.label}</p>
                      <p className="text-[10px] font-semibold text-tx-1 mt-0.5">{item.count}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={applyImportPreview}
                    className="text-[9px] font-semibold px-2 py-1 rounded-md flex items-center gap-1.5 transition-all bg-loss/10 border border-loss/20 text-loss"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setImportPreview(null)}
                    className="text-[9px] font-semibold px-2 py-1 rounded-md flex items-center gap-1.5 transition-all bg-bg-hover/40 border border-border-subtle text-tx-2"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {lastImportBackupAt && !importPreview && (
              <button
                onClick={rollbackLastImport}
                className="text-[9px] font-semibold px-2 py-1.5 rounded-md flex items-center gap-1.5 transition-all bg-loss/10 border border-loss/20 text-loss mb-2"
              >
                Roll back last import ({new Date(lastImportBackupAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })})
              </button>
            )}
          </div>

          {/* ── Danger Zone ── */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(239,68,68,0.1)", background: "rgba(239,68,68,0.02)" }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-loss">Danger Zone</span>
            <p className="text-[10px] mt-1 mb-3 text-tx-4">Permanently delete all data on this device. This cannot be undone.</p>
            <button
              onClick={() => {
                if (window.confirm("This will permanently delete ALL data on this device and sign you out. Are you sure?")) {
                  // Clear all Nexus localStorage keys
                  const keysToClear = [
                    "nexus_data",
                    "nexus_savedAt",
                    "nexus_custom_instruments",
                    "nexus_custom_sessions",
                    "nexus_custom_firms",
                    "nexus_custom_cats",
                    "nexus.offlineMode",
                    "nexus_tax_goal_override",
                    "nexus_tax_salary",
                    "nexus_tax_saved",
                    "sidebarCollapsed",
                  ];
                  for (const key of keysToClear) localStorage.removeItem(key);

                  // Sign out of Supabase so next launch starts fresh
                  void supabase.auth.signOut().finally(() => {
                    window.location.reload();
                  });
                }
              }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-loss/10 text-loss hover:bg-loss/20 transition-colors border border-loss/20"
            >
              Clear All Data
            </button>
          </div>

          {/* ── Actions ── */}
          <div className="rounded-2xl p-4" style={{ border: "1px solid rgba(var(--border-rgb),0.05)", background: "rgba(var(--surface-rgb),0.02)" }}>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="btn-primary btn flex-1 disabled:opacity-60"
              >
                <Save size={12} />{isSaving ? "Saving..." : "Save Settings"}
              </button>
              <button className="btn-ghost btn" onClick={handleReset} disabled={isSaving} title="Reset all settings to defaults">Reset</button>
              <button className="btn-ghost btn" onClick={onClose} disabled={isSaving}>Cancel</button>
            </div>
          </div>
        </div>

      </Modal>
      <AvatarCropModal
        open={!!cropSource}
        source={cropSource}
        onCancel={() => setCropSource(null)}
        onApply={(croppedDataUrl) => {
          setAvatarUrl(croppedDataUrl);
          setCropSource(null);
        }}
      />
    </>
  );
}
