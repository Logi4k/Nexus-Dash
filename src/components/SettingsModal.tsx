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
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAppData } from "@/lib/store";
import { deleteAvatar } from "@/lib/avatarStorage";
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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
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
      setAvatarUrl(result);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function handleRemovePhoto() {
    setAvatarUrl(undefined);
    deleteAvatar().catch(() => {});
  }

  function handleSave() {
    update((prev) => ({
      ...prev,
      userProfile: {
        username:    username.trim() || "Trader",
        avatarColor,
        avatarUrl: avatarUrl,
      },
      userSettings: {
        ...(prev.userSettings ?? {}),
        subscriptionRenewalDays: renewalDays,
        theme,
        mobileNavItems,
      },
    }));
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

  const initials = (username.trim() || "T").slice(0, 2).toUpperCase();

  return (
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
                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg select-none overflow-hidden cursor-pointer"
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
                  {avatarUrl ? "Change photo" : "Upload photo"}
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
          <button className="btn-primary btn flex-1" onClick={handleSave}>
            <Save size={12} />Save Settings
          </button>
          <button className="btn-ghost btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
