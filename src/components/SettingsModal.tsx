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
  CloudDownload,
  CloudUpload,
  RefreshCw,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useAppData, forcePullFromCloud, forcePushToCloud } from "@/lib/store";
import { uploadAvatar, deleteAvatar } from "@/lib/avatarStorage";
import { getVersion } from "@tauri-apps/api/app";
import { cn } from "@/lib/utils";
import { DEFAULT_MOBILE_NAV_ITEMS, MOBILE_NAV_OPTIONS, sanitizeMobileNavItems } from "@/lib/mobileNav";
import type { MobileNavItemId } from "@/types";

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
  const [uploading, setUploading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [appVersion, setAppVersion] = useState("1.0.7");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

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

  async function handleSave() {
    // Upload avatar to Supabase Storage if it's a new base64 image
    let finalAvatarUrl = avatarUrl;
    if (avatarUrl && avatarUrl.startsWith("data:")) {
      setUploading(true);
      const url = await uploadAvatar(avatarUrl);
      if (url) {
        finalAvatarUrl = url;
      }
      setUploading(false);
    }

    update((prev) => ({
      ...prev,
      userProfile: {
        username:    username.trim() || "Trader",
        avatarColor,
        avatarUrl: finalAvatarUrl,
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
                className="absolute inset-0 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                style={{ background: "rgba(0,0,0,0.55)" }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={16} style={{ color: "#fff" }} />
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
                  className="text-[9px] font-semibold px-2 py-0.5 rounded-md transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#6b7280",
                  }}
                >
                  {avatarUrl ? "Change photo" : "Upload photo"}
                </button>
                {avatarUrl && (
                  <button
                    onClick={handleRemovePhoto}
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171",
                    }}
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
                    className="w-6 h-6 rounded-lg transition-all flex items-center justify-center flex-shrink-0"
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
                    "py-1.5 px-2 rounded-lg text-[10px] font-semibold transition-all text-center",
                  )}
                  style={{
                    background: renewalDays === value
                      ? "rgba(14,184,154,0.12)"
                      : "rgba(255,255,255,0.03)",
                    border: `1px solid ${renewalDays === value ? "rgba(14,184,154,0.35)" : "rgba(255,255,255,0.07)"}`,
                    color: renewalDays === value ? "#1dd4b4" : "#4b5563",
                  }}
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
                className="relative flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all"
                style={{
                  background: theme === value ? "rgba(var(--surface-rgb, 255,255,255),0.08)" : "rgba(var(--surface-rgb, 255,255,255),0.03)",
                  border: `1px solid ${theme === value ? "rgba(var(--border-rgb, 255,255,255),0.2)" : "rgba(var(--border-rgb, 255,255,255),0.07)"}`,
                }}
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
                  <p className="text-[10px] font-bold" style={{ color: theme === value ? "var(--tx-1)" : "var(--tx-4)" }}>{label}</p>
                  <p className="text-[9px]" style={{ color: "var(--tx-4)" }}>{desc}</p>
                </div>
                {theme === value && (
                  <div
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: "#22c55e" }}
                  >
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

          <div
            className="rounded-xl p-3 mb-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
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
                      className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                      style={{ background: "rgba(14,184,154,0.12)", border: "1px solid rgba(14,184,154,0.26)", color: "#1dd4b4" }}
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
                  className="px-3 py-2.5 rounded-xl text-left transition-all disabled:opacity-45"
                  style={{
                    background: selected ? "rgba(14,184,154,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selected ? "rgba(14,184,154,0.28)" : "rgba(255,255,255,0.07)"}`,
                    color: selected ? "#1dd4b4" : "#94a3b8",
                  }}
                >
                  <div className="text-[10px] font-semibold">{item.label}</div>
                  <div className="text-[9px] mt-0.5" style={{ color: selected ? "#7dd3c7" : "rgba(255,255,255,0.34)" }}>
                    {selected ? "Pinned" : disabled ? "Remove one first" : "Tap to pin"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* ── Data Sync Section ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw size={11} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-tx-3">Data Sync</span>
          </div>
          <div
            className="rounded-xl p-3 mb-2.5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <p className="text-[10px] font-semibold text-tx-2 mb-0.5">Sync with cloud</p>
            <p className="text-[9px] text-tx-4">
              Data syncs automatically when you save. Use these if your devices are out of sync.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={async () => {
                setSyncStatus("loading");
                const ok = await forcePullFromCloud();
                setSyncStatus(ok ? "ok" : "err");
                setTimeout(() => setSyncStatus("idle"), 3000);
              }}
              disabled={syncStatus === "loading"}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-50"
              style={{
                background: "rgba(59,130,246,0.10)",
                border: "1px solid rgba(59,130,246,0.25)",
                color: "#60a5fa",
              }}
            >
              <CloudDownload size={13} />
              Pull from cloud
            </button>
            <button
              onClick={async () => {
                setSyncStatus("loading");
                const ok = await forcePushToCloud();
                setSyncStatus(ok ? "ok" : "err");
                setTimeout(() => setSyncStatus("idle"), 3000);
              }}
              disabled={syncStatus === "loading"}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-[11px] font-semibold transition-all disabled:opacity-50"
              style={{
                background: "rgba(34,197,94,0.10)",
                border: "1px solid rgba(34,197,94,0.25)",
                color: "#4ade80",
              }}
            >
              <CloudUpload size={13} />
              Push to cloud
            </button>
          </div>
          {syncStatus === "ok" && (
            <p className="text-[9px] mt-2 text-center" style={{ color: "#4ade80" }}>Sync successful</p>
          )}
          {syncStatus === "err" && (
            <p className="text-[9px] mt-2 text-center" style={{ color: "#f87171" }}>Sync failed — check your connection</p>
          )}
          {syncStatus === "loading" && (
            <p className="text-[9px] mt-2 text-center text-tx-4">Syncing…</p>
          )}
        </div>

        <div
          className="rounded-xl p-3 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="text-[10px] font-bold text-tx-3">Nexus</p>
            <p className="text-[9px] text-tx-4">Synced across devices via Supabase</p>
          </div>
          <span
            className="text-[9px] font-bold px-2 py-1 rounded-lg"
            style={{ background: "rgba(255,255,255,0.05)", color: "#4b5563" }}
          >
            v{appVersion}
          </span>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-2 pt-1">
          <button className="btn-primary btn flex-1" onClick={handleSave} disabled={uploading}>
            <Save size={12} />{uploading ? "Uploading…" : "Save Settings"}
          </button>
          <button className="btn-ghost btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
