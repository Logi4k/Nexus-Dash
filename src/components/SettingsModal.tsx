import { useState, useEffect, useRef } from "react";
import {
  User,
  Bell,
  Save,
  Camera,
  X,
  Palette,
  Moon,
  Sun,
  Smartphone,
  Download,
  Cloud,
  RefreshCw,
  ArrowDownToLine,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import AvatarCropModal from "@/components/AvatarCropModal";
import { forcePullFromCloud, syncNow, useAppData, useSyncStatus } from "@/lib/store";
import { deleteAvatar, uploadAvatar } from "@/lib/avatarStorage";
import {
  checkDesktopUpdate,
  installDesktopUpdate,
  isDesktopUpdaterRuntime,
  requestDesktopRestart,
  type DesktopUpdateStatus,
} from "@/lib/desktopUpdater";
import { cn } from "@/lib/utils";
import { DEFAULT_MOBILE_NAV_ITEMS, MOBILE_NAV_OPTIONS, sanitizeMobileNavItems } from "@/lib/mobileNav";
import type { MobileNavItemId } from "@/types";

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
  "#1dd4b4", // teal (accent)
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#f97316", // orange
  "#06b6d4", // cyan
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

export default function SettingsModal({ open, onClose }: Props) {
  const { data, update } = useAppData();
  const syncStatus = useSyncStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local draft state — only committed on Save
  const [username, setUsername] = useState(
    () => data.userProfile?.username ?? "Trader"
  );
  const [avatarColor, setAvatarColor] = useState(
    () => data.userProfile?.avatarColor ?? "#1dd4b4"
  );
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(
    () => data.userProfile?.avatarUrl
  );
  const [renewalDays, setRenewalDays] = useState(
    () => data.userSettings?.subscriptionRenewalDays ?? 7
  );
  const [theme, setTheme] = useState<"dark" | "bw">(
    () => data.userSettings?.theme ?? "dark"
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
  const [desktopUpdateAction, setDesktopUpdateAction] = useState<"idle" | "checking" | "installing">("idle");
  const desktopUpdaterVisible = isDesktopUpdaterRuntime();
  // Re-sync draft state each time the modal opens
  useEffect(() => {
    if (!open) return;
    setUsername(data.userProfile?.username ?? "Trader");
    setAvatarColor(data.userProfile?.avatarColor ?? "#1dd4b4");
    setAvatarUrl(data.userProfile?.avatarUrl);
    setRenewalDays(data.userSettings?.subscriptionRenewalDays ?? 7);
    setTheme(data.userSettings?.theme ?? "dark");
    setMobileNavItems(
      sanitizeMobileNavItems(data.userSettings?.mobileNavItems).length > 0
        ? sanitizeMobileNavItems(data.userSettings?.mobileNavItems)
        : DEFAULT_MOBILE_NAV_ITEMS
    );
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

  function handleRemovePhoto() {
    setAvatarUrl(undefined);
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
        theme,
        mobileNavItems,
      },
    }));

    if (previousAvatarUrl && !nextAvatarUrl) {
      void deleteAvatar().catch(() => {});
    }

    setIsSaving(false);
    onClose();
  }

  function exportAllJSON() {
    const json = JSON.stringify(data, null, 2);
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

  async function handleSyncNow() {
    const ok = await syncNow();
    if (ok) {
      toast.success("Sync complete");
    } else {
      toast.error("Sync is unavailable right now.");
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
      setDesktopUpdateStatus(status);
      if (notifyOnError && status.error) {
        toast.error(`Update check failed: ${status.error}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Update check failed.";
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

      toast.success(`Version ${result.version ?? "update"} installed. Restarting Nexus...`);
      onClose();
      setTimeout(() => {
        void requestDesktopRestart();
      }, 450);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Desktop update install failed.";
      toast.error(message);
      setDesktopUpdateAction("idle");
      await loadDesktopUpdateStatus(false);
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
      ? { label: "Syncing", className: "bg-blue-500/10 border-blue-500/20 text-blue-300" }
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
        size="sm"
      >
        <div className="space-y-5">

        {/* ── Profile Section ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <User size={11} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-tx-3">Profile</span>
          </div>

          {/* Avatar preview + upload */}
          <div className="flex items-center gap-4 mb-3">
            {/* Clickable avatar with camera overlay */}
            <div className="relative flex-shrink-0 group">
              <div
                className="w-[72px] h-[72px] rounded-[26px] flex items-center justify-center font-black text-xl select-none overflow-hidden cursor-pointer"
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
              {/* Camera overlay */}
              <div
                className="absolute inset-0 rounded-2xl flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer bg-black/55"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={16} className="text-tx-1" />
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="flex-1">
              <label className="text-tx-3 text-[10px] block mb-1.5">Username</label>
              <input
                type="text"
                className="nx-input"
                maxLength={24}
                placeholder="Trader"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {/* Photo actions */}
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-md transition-all bg-accent-muted border border-border text-tx-3"
                >
                  {avatarUrl ? "Change & crop" : "Upload & crop"}
                </button>
                {avatarUrl && (
                  <button
                    onClick={handleRemovePhoto}
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all bg-loss/10 border border-loss/20 text-loss"
                  >
                    <X size={8} />Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Avatar colour swatches (only shown when no photo) */}
          {!avatarUrl && (
            <div>
              <label className="text-tx-3 text-[10px] flex items-center gap-1.5 mb-2">
                Avatar colour
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setAvatarColor(color)}
                    className="w-11 h-11 rounded-xl transition-all flex items-center justify-center flex-shrink-0"
                    style={{
                      background: color,
                      transform: avatarColor === color ? "scale(1.2)" : "scale(1)",
                      boxShadow: avatarColor === color ? `0 0 8px ${color}80` : "none",
                      outline: avatarColor === color ? `2px solid ${color}` : "none",
                      outlineOffset: "2px",
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
          <p className="text-[9px] text-tx-4 mt-2">
            Use a tight crop so your profile reads cleanly in both desktop and mobile navigation.
          </p>
        </div>

        {/* ── Notifications Section ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Bell size={11} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-tx-3">Notifications</span>
          </div>

          <div>
            <label className="text-tx-3 text-[10px] block mb-1.5">
              Subscription renewal reminder
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {RENEWAL_DAYS_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setRenewalDays(value)}
                  className={cn(
                    "py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all text-center border",
                    renewalDays === value
                      ? "bg-profit/10 border-profit/30 text-profit"
                      : "bg-accent-muted border-border-subtle text-tx-3"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-tx-4 mt-1.5">
              You'll see a notification badge when a subscription is due within this window.
            </p>
          </div>
        </div>

        {/* ── Appearance Section ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Palette size={11} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-tx-3">Appearance</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "dark" as const, label: "Dark",       Icon: Moon,  desc: "Default dark mode" },
              { value: "bw"   as const, label: "Black & White", Icon: Sun, desc: "Clean monochrome" },
            ] as const).map(({ value, label, Icon, desc }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  "relative flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all border",
                  theme === value
                    ? "bg-accent-glow border-border-accent"
                    : "bg-accent-muted border-border-subtle"
                )}
              >
                {/* Mini preview swatch */}
                <div
                  className="w-full h-8 rounded-lg overflow-hidden flex"
                  style={{
                    background: value === "dark" ? "#080a10" : "#f0f2f5",
                    border: `1px solid ${value === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                  }}
                >
                  <div className="w-1/4 h-full" style={{ background: value === "dark" ? "#111318" : "#ffffff" }} />
                  <div className="flex-1 flex flex-col justify-center gap-0.5 px-1.5">
                    <div className="h-1.5 rounded-full w-3/4" style={{ background: value === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" }} />
                    <div className="h-1 rounded-full w-1/2" style={{ background: value === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)" }} />
                  </div>
                </div>
                <div className="text-center">
                  <p className={cn("text-[10px] font-bold", theme === value ? "text-tx-1" : "text-tx-4")}>{label}</p>
                  <p className="text-[9px] text-tx-4">{desc}</p>
                </div>
                {theme === value && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center bg-profit">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l2 2 3-3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Sync Center ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={11} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-tx-3">Sync</span>
          </div>

          <div className="rounded-xl p-3 border border-border-subtle bg-accent-muted space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-tx-2">Cloud sync status</p>
                <p className="text-[9px] text-tx-4 mt-1">
                  {syncStatus.realtimeState === "connected"
                    ? "Realtime channel is connected."
                    : syncStatus.enabled
                      ? "Manual sync is available if realtime drops."
                      : "Sign in is required for cloud sync."}
                </p>
              </div>
              <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full border", syncBadge.className)}>
                {syncBadge.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg px-3 py-2 border border-border-subtle bg-bg-hover/40">
                <p className="text-[9px] uppercase tracking-[0.14em] text-tx-4">Last cloud sync</p>
                <p className="text-[11px] font-semibold text-tx-2 mt-1">{formatSyncTime(syncStatus.syncedAt)}</p>
              </div>
              <div className="rounded-lg px-3 py-2 border border-border-subtle bg-bg-hover/40">
                <p className="text-[9px] uppercase tracking-[0.14em] text-tx-4">Last local save</p>
                <p className="text-[11px] font-semibold text-tx-2 mt-1">{formatSyncTime(syncStatus.localSavedAt)}</p>
              </div>
            </div>

            {syncStatus.lastError && (
              <div className="rounded-lg px-3 py-2 border border-loss/20 bg-loss/10 flex items-start gap-2">
                <AlertTriangle size={12} className="text-loss mt-0.5 shrink-0" />
                <p className="text-[10px] leading-relaxed text-loss/90">{syncStatus.lastError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSyncNow}
                disabled={!syncStatus.enabled || syncStatus.syncInFlight}
                className="text-[10px] font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition-all bg-accent-glow border border-border-accent text-tx-1 disabled:opacity-50"
              >
                <RefreshCw size={11} className={syncStatus.syncInFlight ? "animate-spin" : ""} />
                {syncStatus.syncInFlight ? "Syncing..." : "Sync Now"}
              </button>
              <button
                onClick={handlePullLatest}
                disabled={!syncStatus.enabled || syncStatus.syncInFlight}
                className="text-[10px] font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition-all bg-bg-hover/40 border border-border-subtle text-tx-2 disabled:opacity-50"
              >
                <ArrowDownToLine size={11} />
                Pull Latest
              </button>
            </div>
          </div>
        </div>

        {/* ── Desktop Updates ── */}
        {desktopUpdaterVisible && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownToLine size={11} className="text-accent" />
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-tx-3">Desktop Updates</span>
            </div>

            <div className="rounded-xl p-3 border border-border-subtle bg-accent-muted space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-tx-2">OTA updater</p>
                  <p className="text-[9px] text-tx-4 mt-1">
                    Current version {desktopUpdateStatus?.currentVersion ?? "loading..."}
                    {desktopUpdateStatus?.available && desktopUpdateStatus.version
                      ? ` · update ${desktopUpdateStatus.version} ready`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                    !desktopUpdateStatus?.configured
                      ? "bg-warn/10 border-warn/20 text-warn"
                      : desktopUpdateStatus.available
                        ? "bg-profit/10 border-profit/20 text-profit"
                        : "bg-accent-muted border-border-subtle text-tx-3"
                  )}
                >
                  {!desktopUpdateStatus?.configured
                    ? "Not configured"
                    : desktopUpdateStatus.available
                      ? "Update ready"
                      : "Up to date"}
                </span>
              </div>

              {!desktopUpdateStatus?.configured ? (
                <div className="rounded-lg px-3 py-2 border border-warn/20 bg-warn/10">
                  <p className="text-[10px] leading-relaxed text-warn">
                    Set <span className="font-semibold">TAURI_UPDATER_PUBKEY</span> and <span className="font-semibold">TAURI_UPDATER_ENDPOINTS</span> before building the desktop release to enable OTA updates.
                  </p>
                </div>
              ) : null}

              {desktopUpdateStatus?.body ? (
                <div className="rounded-lg px-3 py-2 border border-border-subtle bg-bg-hover/40">
                  <p className="text-[9px] uppercase tracking-[0.14em] text-tx-4 mb-1">Release Notes</p>
                  <p className="text-[10px] leading-relaxed text-tx-3 whitespace-pre-wrap">
                    {desktopUpdateStatus.body}
                  </p>
                </div>
              ) : null}

              {desktopUpdateStatus?.error ? (
                <div className="rounded-lg px-3 py-2 border border-loss/20 bg-loss/10">
                  <p className="text-[10px] leading-relaxed text-loss">
                    {desktopUpdateStatus.error}
                  </p>
                </div>
              ) : null}

              <div className="flex gap-2">
                <button
                  onClick={() => void loadDesktopUpdateStatus(true)}
                  disabled={desktopUpdateAction !== "idle"}
                  className="text-[10px] font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition-all bg-bg-hover/40 border border-border-subtle text-tx-2 disabled:opacity-50"
                >
                  <RefreshCw size={11} className={desktopUpdateAction === "checking" ? "animate-spin" : ""} />
                  {desktopUpdateAction === "checking" ? "Checking..." : "Check for Updates"}
                </button>
                <button
                  onClick={() => void handleInstallDesktopUpdate()}
                  disabled={desktopUpdateAction !== "idle" || !desktopUpdateStatus?.available}
                  className="text-[10px] font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition-all bg-accent-glow border border-border-accent text-tx-1 disabled:opacity-50"
                >
                  <ArrowDownToLine size={11} className={desktopUpdateAction === "installing" ? "animate-bounce" : ""} />
                  {desktopUpdateAction === "installing" ? "Installing..." : "Download & Restart"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── App Info ── */}
        {isMobileViewport && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Smartphone size={11} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-tx-3">Mobile Nav</span>
          </div>

          <div className="rounded-xl p-3 mb-3 bg-accent-muted border border-border-subtle">
            <p className="text-[10px] font-semibold text-tx-2">Pinned sections</p>
            <p className="text-[9px] text-tx-4 mt-1">
              Search stays fixed in the middle. Choose up to 4 sections for the mobile bar.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {mobileNavItems.length === 0 ? (
                <span className="text-[9px] text-tx-4">No sections pinned right now.</span>
              ) : (
                mobileNavItems.map((id, index) => {
                  const item = MOBILE_NAV_OPTIONS.find((option) => option.id === id);
                  if (!item) return null;
                  return (
                    <span
                      key={id}
                      className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-profit/10 border border-profit/25 text-profit"
                    >
                      {index + 1}. {item.label}
                    </span>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-1">
            {MOBILE_NAV_OPTIONS.map((item) => {
              const selected = mobileNavItems.includes(item.id);
              const disabled = !selected && mobileNavItems.length >= 4;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleMobileNavItem(item.id)}
                  disabled={disabled}
                  className={cn(
                    "px-3 py-2.5 rounded-xl text-left transition-all disabled:opacity-45 border",
                    selected
                      ? "bg-profit/10 border-profit/25 text-profit"
                      : "bg-accent-muted border-border-subtle text-tx-3"
                  )}
                >
                  <div className="text-[10px] font-semibold">{item.label}</div>
                  <div className={cn("text-[9px] mt-0.5", selected ? "text-profit/70" : "text-tx-4")}>
                    {selected ? "Pinned" : disabled ? "Remove one first" : "Tap to pin"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* ── Export Data ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Download size={11} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-tx-3">Export Data</span>
          </div>
          <p className="text-[9px] text-tx-4 mb-3">Download your data for backup or analysis.</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={exportAllJSON}
              className="text-[10px] font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition-all bg-accent-muted border border-border text-tx-2 hover:border-accent/40 hover:text-tx-1"
            >
              <Download size={11} className="text-accent flex-shrink-0" />
              Export All Data (JSON)
            </button>
            <button
              onClick={exportTradesCSV}
              className="text-[10px] font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition-all bg-accent-muted border border-border text-tx-2 hover:border-accent/40 hover:text-tx-1"
            >
              <Download size={11} className="text-accent flex-shrink-0" />
              Export Trades (CSV)
            </button>
            <button
              onClick={exportExpensesCSV}
              className="text-[10px] font-semibold px-3 py-2 rounded-lg flex items-center gap-2 transition-all bg-accent-muted border border-border text-tx-2 hover:border-accent/40 hover:text-tx-1"
            >
              <Download size={11} className="text-accent flex-shrink-0" />
              Export Expenses (CSV)
            </button>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          <button className="btn-primary btn flex-1 disabled:opacity-60" onClick={handleSave} disabled={isSaving}>
            <Save size={12} />{isSaving ? "Saving..." : "Save Settings"}
          </button>
          <button className="btn-ghost btn" onClick={onClose} disabled={isSaving}>Cancel</button>
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
