import { type ElementType, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Landmark,
  LayoutGrid,
  Lightbulb,
  LineChart,
  Bell,
  LogOut,
  NotebookPen,
  PieChart,
  Plus,
  Receipt,
  Scale,
  Settings,
  Wallet,
  MoreHorizontal,
  X,
  Search,
  RefreshCw,
  Sun,
  Moon,
} from "lucide-react";
import { toast } from "sonner";
import { PAGE_THEMES, type PageTheme } from "@/lib/theme";
import { syncNow, useAppData, useSyncStatus } from "@/lib/store";
import SettingsModal from "@/components/SettingsModal";
import { DEFAULT_MOBILE_NAV_ITEMS, MOBILE_NAV_OPTIONS, sanitizeMobileNavItems } from "@/lib/mobileNav";
import type { QuickAction } from "@/lib/quickActions";
import { buildAppNotifications, getNotificationCount } from "@/lib/notifications";
import type { MobileNavItemId } from "@/types";
import type { AppData } from "@/types";
import { signOut } from "@/lib/supabase";
import { useThemeTransition } from "@/components/ThemeTransition";

const ICONS: Record<MobileNavItemId, ElementType> = {
  dashboard: LayoutGrid,
  market: LineChart,
  journal: NotebookPen,
  ideas: Lightbulb,
  prop: Briefcase,
  expenses: Wallet,
  debt: Landmark,
  tax: Scale,
  investments: PieChart,
};

const FAB_ACTIONS = [
  { label: "Log Trade",   path: "/journal",  action: "addTrade",   cssColor: "var(--color-purple)", Icon: NotebookPen },
  { label: "Add Expense", path: "/expenses", action: "addExpense", cssColor: "var(--color-loss)",   Icon: Receipt },
  { label: "Log Payout",  path: "/prop",     action: "logPayout",  cssColor: "var(--color-profit)", Icon: Wallet },
  { label: "Add Account", path: "/prop",     action: "addAccount", cssColor: "var(--color-blue)",   Icon: Briefcase },
] as const;

const SLIDE_TRANSITION = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };
const FAB_BOTTOM = "calc(env(safe-area-inset-bottom) + 1rem)";
const FAB_STACK_BOTTOM = "calc(env(safe-area-inset-bottom) + 4.8rem)";
const FAB_VISIBLE_LIFT = 58;

function Avatar({ avatarUrl, username, avatarColor, size }: {
  avatarUrl?: string;
  username: string;
  avatarColor?: string;
  size: number;
}) {
  const initials = (username.trim() || "T").slice(0, 2).toUpperCase();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !imageFailed) {
    return (
      <img
        src={avatarUrl}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        alt={username}
        loading="eager"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarColor ?? "#5aadaa",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "var(--bg-base)",
    }}>
      {initials}
    </div>
  );
}

export default function MobileNav({
  onOpenCommandPalette,
  onQuickAction,
  navVisible = true,
}: {
  onOpenCommandPalette?: () => void;
  onQuickAction?: (action: QuickAction) => void;
  navVisible?: boolean;
}) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const syncStatus = useSyncStatus();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [prefetchedMoreSheet, setPrefetchedMoreSheet] = useState(false);
  const [notifHeaderHovered, setNotifHeaderHovered] = useState(false);
  const [notifItemHovered, setNotifItemHovered] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);
  const fabLiftY = navVisible ? -FAB_VISIBLE_LIFT : 0;
  const notificationCount = getNotificationCount(data);
  const showNotificationBell = notificationCount > 0;
  const notificationsList = useMemo(() => buildAppNotifications(data), [data]);

  // Dismiss notifications panel on click/tap outside
  useEffect(() => {
    if (!notificationsOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationsOpen]);

  // Dismiss panel on click/tap outside
  useEffect(() => {
    if (!panelOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [panelOpen]);

  // Auto-hide profile panel on scroll
  useEffect(() => {
    if (!panelOpen) return;
    let scrollTimeout: ReturnType<typeof setTimeout>;
    function handleScroll() {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => setPanelOpen(false), 100);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [panelOpen]);

  // Dismiss FAB menu on click/tap outside
  useEffect(() => {
    if (!fabOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [fabOpen]);

  useEffect(() => {
    if (!fabOpen) return;
    if (panelOpen || moreOpen || settingsOpen) {
      setFabOpen(false);
    }
  }, [fabOpen, panelOpen, moreOpen, settingsOpen]);

  useEffect(() => {
    setFabOpen(false);
    setPanelOpen(false);
    setMoreOpen(false);
    setNotificationsOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    const id = window.setTimeout(() => setPrefetchedMoreSheet(true), 220);
    return () => window.clearTimeout(id);
  }, []);

  function handleFabAction(action: typeof FAB_ACTIONS[number]) {
    setFabOpen(false);
    setPanelOpen(false);
    setNotificationsOpen(false);
    if (onQuickAction) {
      onQuickAction(action.action as QuickAction);
      return;
    }
    navigate(action.path);
  }

  function dismissNotification(id: string) {
    update((prev) => {
      const existing = prev.userSettings?.dismissedNotificationIds ?? [];
      if (existing.includes(id)) return prev;
      return {
        ...prev,
        userSettings: {
          ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }),
          dismissedNotificationIds: [...existing, id],
        },
      };
    });
  }

  async function handleSyncNow() {
    if (syncStatus.syncInFlight) return;
    if (await syncNow()) {
      toast.success("Sync complete");
    } else {
      toast.error("Sync is unavailable right now");
    }
  }

  const currentTheme = data.userSettings?.theme ?? "dark";

  function toggleTheme() {
    const next = currentTheme === "dark" ? "bw" : "dark";
    update((prev) => ({
      ...prev,
      userSettings: {
        ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }),
        theme: next,
      },
    }));
  }

  // Theme transition animation
  const { activate: activateTheme, ripple } = useThemeTransition(toggleTheme);
  const themeBtnRef = useRef<HTMLButtonElement>(null);

  const syncLabel = syncStatus.lastError
    ? "Sync issue"
    : syncStatus.syncInFlight
      ? "Syncing..."
      : syncStatus.syncedAt
        ? `Synced ${new Date(syncStatus.syncedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
        : "Sync ready";

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "7px 6px", borderRadius: 8,
    fontSize: 12, fontWeight: 500, color: "var(--tx-2)",
    background: "transparent", border: "none", cursor: "pointer",
    textAlign: "left",
  };

  const items = useMemo(() => {
    const saved = sanitizeMobileNavItems(data.userSettings?.mobileNavItems);
    const picked = saved.length > 0 ? saved : DEFAULT_MOBILE_NAV_ITEMS;
    return picked
      .map((id) => {
        const config = MOBILE_NAV_OPTIONS.find((item) => item.id === id);
        if (!config) return null;
        return {
          ...config,
          Icon: ICONS[id],
          theme: PAGE_THEMES[config.themeKey],
        };
      })
      .filter(Boolean) as {
        id: MobileNavItemId;
        label: string;
        path: string;
        Icon: ElementType;
        theme: PageTheme;
      }[];
  }, [data.userSettings?.mobileNavItems]);

  // All 9 pages for the More drawer
  const allPages = useMemo(() => {
    return MOBILE_NAV_OPTIONS.map((config) => ({
      ...config,
      Icon: ICONS[config.id],
      theme: PAGE_THEMES[config.themeKey],
    }));
  }, []);

  const leftItems = items.slice(0, 2);
  const rightItems = items.slice(2, 4);

  function NavItem({
    path,
    Icon,
    theme,
  }: {
    path: string;
    Icon: ElementType;
    theme: PageTheme;
  }) {
    const isActive = path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(path);

    return (
      <NavLink to={path} className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center">
        <Icon size={16} style={{ color: isActive ? "var(--accent)" : "var(--tx-3)" }} />
        <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: isActive ? "var(--accent)" : 'transparent' }} />
      </NavLink>
    );
  }

  return (
    <>
      {/* Nav bar pill — animated directly so backdrop-filter works (not nested in a transform/opacity wrapper) */}
      <motion.nav
        animate={{ y: navVisible ? 0 : 108, opacity: 1 }}
        transition={SLIDE_TRANSITION}
        className="md:hidden px-3 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-2"
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: "var(--z-mobile-nav)" }}
      >
        <div
          className="mx-auto flex items-center gap-0.5 px-2 py-2 rounded-[24px] w-fit max-w-[calc(100vw-0.75rem)]"
          style={{
            background: `rgba(var(--bg-card-rgb),0.08)`,
            border: "1px solid rgba(var(--border-rgb),0.05)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            backdropFilter: "blur(48px) saturate(220%)",
            WebkitBackdropFilter: "blur(48px) saturate(220%)",
          }}
        >
          {leftItems.map((item) => (
              <NavItem key={item.id} {...item} />
            ))}

            {leftItems.length < 2 &&
              Array.from({ length: 2 - leftItems.length }, (_, index) => (
                <div key={`left-empty-${index}`} className="min-w-[36px]" />
              ))}

            {/* More / All Pages Button */}
            <button
              type="button"
              onPointerDown={() => setPrefetchedMoreSheet(true)}
              onClick={() => { setPanelOpen(false); setFabOpen(false); setNotificationsOpen(false); setMoreOpen(true); }}
              className="flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center"
              aria-label="All pages"
            >
              <MoreHorizontal size={16} style={{ color: moreOpen ? "var(--tx-1)" : "var(--tx-3)" }} />
              <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: moreOpen ? "var(--tx-1)" : 'transparent' }} />
            </button>

            {rightItems.map((item) => (
              <NavItem key={item.id} {...item} />
            ))}

            {rightItems.length < 2 &&
              Array.from({ length: 2 - rightItems.length }, (_, index) => (
                <div key={`right-empty-${index}`} className="min-w-[36px]" />
              ))}

            {/* Profile avatar with notification badge */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setMoreOpen(false);
                  setFabOpen(false);
                  setNotificationsOpen(false);
                  setPanelOpen((o) => !o);
                }}
                style={{
                  width: 40, height: 40,
                  minWidth: 40,
                  borderRadius: "50%",
                  border: "2px solid rgba(99,102,241,0.35)",
                  padding: 0,
                  background: "transparent", cursor: "pointer",
                  boxShadow: panelOpen ? "0 0 0 3px rgba(99,102,241,0.25)" : "none",
                  overflow: "visible",
                  transition: "box-shadow 0.2s ease",
                }}
                aria-label="Open account panel"
              >
                <Avatar
                  avatarUrl={data.userProfile?.avatarUrl}
                  username={data.userProfile?.username ?? "Trader"}
                  avatarColor={data.userProfile?.avatarColor}
                  size={36}
                />
              </button>
              {showNotificationBell && (
                <div
                  style={{
                    position: "absolute",
                    top: -5,
                    right: -5,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "var(--color-loss)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "var(--tx-1)",
                    border: "2.5px solid var(--bg-base)",
                    zIndex: "var(--z-base)",
                  }}
                  aria-label={notificationCount + " notifications"}
                >
                  {notificationCount > 9 ? "9+" : notificationCount}
                </div>
              )}
            </div>
        </div>
      </motion.nav>

      {/* FAB — outside the animated nav wrapper so it is never affected by the translateY transform */}
      <div ref={fabRef} className="md:hidden">
        <AnimatePresence>
          {fabOpen && (
            <motion.button
              type="button"
              aria-label="Close quick actions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-[var(--z-mobile-nav)] md:hidden"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
              onClick={() => setFabOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Action items stacked above FAB */}
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0, y: fabLiftY + 18 }}
              animate={{ opacity: 1, y: fabLiftY }}
              exit={{ opacity: 0, y: fabLiftY + 10 }}
              transition={SLIDE_TRANSITION}
              className="fixed right-4 z-[var(--z-fab)] flex flex-col items-end gap-2.5 md:hidden"
              style={{ bottom: FAB_STACK_BOTTOM }}
            >
              {FAB_ACTIONS.map((action, i) => (
                <motion.button
                  key={action.label}
                  type="button"
                  initial={{ opacity: 0, y: 16, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  onClick={() => handleFabAction(action)}
                  className="flex items-center gap-3 px-4 py-3 rounded-[22px]"
                  style={{
                    background: `rgba(var(--bg-card-rgb), 0.95)`,
                    backdropFilter: "blur(18px)",
                    border: `1px solid ${action.cssColor}60`,
                    boxShadow: `0 12px 28px rgba(0,0,0,0.28), 0 6px 16px ${action.cssColor}18`,
                    minWidth: 172,
                  }}
                >
                  <action.Icon size={16} style={{ color: action.cssColor }} />
                  <span className="text-sm font-semibold text-tx-1 whitespace-nowrap">{action.label}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB button — hidden when profile panel or notifications panel is open */}
        {!(panelOpen || notificationsOpen) && (
          <motion.button
            type="button"
            animate={{ y: fabLiftY }}
            transition={SLIDE_TRANSITION}
            whileTap={{ scale: 0.92 }}
            onClick={() => setFabOpen((o) => !o)}
            aria-label={fabOpen ? "Close quick actions" : "Open quick actions"}
            className="fixed right-4 flex items-center justify-center rounded-full md:hidden"
            style={{
              bottom: FAB_BOTTOM,
              width: 52,
              height: 52,
              zIndex: "var(--z-fab)",
              background: "var(--tx-1)",
              color: "var(--bg-base)",
              boxShadow: fabOpen ? "0 10px 28px rgba(0,0,0,0.42)" : "0 6px 22px rgba(0,0,0,0.32)",
            }}
          >
            <motion.div
              animate={{ rotate: fabOpen ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <Plus size={22} strokeWidth={2.5} />
            </motion.div>
          </motion.button>
        )}
      </div>

      {/* Profile panel — outside the animated nav div so CSS transform doesn't trap its z-index */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
            style={{
              position: "fixed",
              bottom: navVisible
                ? "calc(env(safe-area-inset-bottom) + 5.3rem)"
                : "calc(env(safe-area-inset-bottom) + 1rem)",
              right: "0.75rem",
              width: 228,
              background: `rgba(var(--bg-card-rgb),0.95)`,
              border: "1px solid rgba(var(--border-rgb),0.12)",
              borderRadius: 16,
              padding: "12px 10px",
              boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
              zIndex: "var(--z-cmd-palette)",
              transition: "bottom 0.24s cubic-bezier(0.22, 1, 0.36, 1)",
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
            }}
          >
            {/* Avatar + name */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              paddingBottom: 10,
              borderBottom: "1px solid rgba(var(--border-rgb),0.06)",
              marginBottom: 6,
            }}>
              <Avatar
                avatarUrl={data.userProfile?.avatarUrl}
                username={data.userProfile?.username ?? "Trader"}
                avatarColor={data.userProfile?.avatarColor}
                size={46}
              />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--tx-1)" }}>
                    {data.userProfile?.username ?? "Trader"}
                  </div>
                </div>
            </div>

            {/* Notifications — visible only when there are unread */}
            {showNotificationBell && (
              <button
                type="button"
                style={{
                  ...rowStyle,
                  color: "var(--color-profit)",
                  fontWeight: 600,
                }}
                onClick={() => {
                  setPanelOpen(false);
                  setNotificationsOpen((o) => !o);
                }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: "var(--color-loss)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: "var(--tx-1)", flexShrink: 0,
                }}>
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
                {notificationCount} Notification{notificationCount !== 1 ? "s" : ""}
              </button>
            )}

            {/* Settings */}
            <button
              type="button"
              style={rowStyle}
              onClick={() => { setPanelOpen(false); setSettingsOpen(true); }}
            >
              <Settings size={13} /> Settings
            </button>

            {/* Sync Now */}
            <button
              type="button"
              style={rowStyle}
              onClick={handleSyncNow}
              disabled={syncStatus.syncInFlight}
            >
              <RefreshCw size={13} className={syncStatus.syncInFlight ? "animate-spin" : ""} /> {syncStatus.syncInFlight ? "Syncing..." : "Sync Now"}
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              ref={themeBtnRef}
              style={rowStyle}
              onClick={() => { if (themeBtnRef.current) activateTheme(themeBtnRef.current); }}
            >
              {currentTheme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
              {currentTheme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>

            {/* Sign Out */}
            <button
              type="button"
              style={{ ...rowStyle, color: "var(--color-loss)" }}
              onClick={async () => { await signOut(); window.location.reload(); }}
            >
              <LogOut size={13} /> Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notifications panel */}
      <AnimatePresence>
        {notificationsOpen && (
          <motion.div
            ref={notifRef}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
            style={{
              position: "fixed",
              bottom: navVisible
                ? "calc(env(safe-area-inset-bottom) + 5.3rem)"
                : "calc(env(safe-area-inset-bottom) + 1rem)",
              right: "0.75rem",
              width: 260,
              background: `rgba(var(--bg-card-rgb),0.96)`,
              border: "1px solid rgba(var(--border-rgb),0.12)",
              borderRadius: 16,
              padding: "12px 10px",
              boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
              zIndex: "calc(var(--z-cmd-palette) - 1)",
              backdropFilter: "blur(16px) saturate(180%)",
              WebkitBackdropFilter: "blur(16px) saturate(180%)",
              maxHeight: "60vh",
              overflowY: "auto",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell size={13} style={{ color: "var(--color-profit)" }} />
                <span className="text-[11px] font-bold text-tx-1">Notifications</span>
                {notificationCount > 0 && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.12)", color: "var(--color-loss)" }}>
                    {notificationCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notificationsList.length > 0 && (
                  <button
                    type="button"
                    onPointerDown={() => setNotifHeaderHovered(true)}
                    onPointerLeave={() => setNotifHeaderHovered(false)}
                    onClick={() => {
                      notificationsList.forEach((n) => dismissNotification(n.id));
                    }}
                    className="text-[9px] font-semibold text-tx-4 hover:text-tx-2 px-1.5 py-1 rounded-lg transition-colors"
                    style={notifHeaderHovered ? { background: "rgba(255,255,255,0.06)" } : undefined}
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onPointerDown={() => setNotifHeaderHovered(true)}
                  onPointerLeave={() => setNotifHeaderHovered(false)}
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1 rounded-lg transition-colors"
                  style={notifHeaderHovered ? { background: "rgba(255,255,255,0.06)" } : undefined}
                >
                  <X size={12} className="text-tx-3" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="flex flex-col gap-1">
              {notificationsList.slice(0, 8).map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-start gap-2.5 px-3 py-3 rounded-lg transition-colors group"
                  style={notifItemHovered ? { background: "rgba(255,255,255,0.04)" } : undefined}
                  onPointerDown={() => setNotifItemHovered(true)}
                  onPointerLeave={() => setNotifItemHovered(false)}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                    style={{
                      background: notif.severity === "critical" ? "var(--color-loss)" : notif.severity === "warn" ? "var(--color-warn)" : "var(--color-profit)",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-tx-1 truncate">{notif.title}</p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); dismissNotification(notif.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all shrink-0"
                        style={notifItemHovered ? { background: "rgba(255,255,255,0.08)" } : undefined}
                        aria-label="Dismiss notification"
                      >
                        <X size={10} className="text-tx-4" />
                      </button>
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--tx-4)" }}>{notif.detail}</p>
                  </div>
                </div>
              ))}
              {notificationsList.length === 0 && (
                <p className="text-[11px] text-tx-4 text-center py-4">No notifications</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* More / All Pages Drawer — fixed positioned, unaffected by nav visibility */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[var(--z-drawer)] md:hidden"
            style={{ background: "rgba(0,0,0,0.42)", backdropFilter: "blur(2px)" }}
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>
      {(moreOpen || prefetchedMoreSheet) && (
        <motion.div
          initial={false}
          animate={moreOpen ? { y: 0, opacity: 1 } : { y: "100%", opacity: 0.98 }}
          transition={{ duration: moreOpen ? 0.22 : 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[var(--z-drawer)] md:hidden rounded-t-[28px] px-5 pt-5"
          style={{
            background: `rgba(var(--bg-card-rgb),0.98)`,
            border: "1px solid rgba(var(--border-rgb),0.1)",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.42)",
            backdropFilter: "blur(16px)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
            maxHeight: "min(78vh, 680px)",
            overflowY: "auto",
            visibility: moreOpen ? "visible" : "hidden",
            pointerEvents: moreOpen ? "auto" : "none",
            willChange: "transform, opacity",
          }}
        >
              {/* Handle */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-tx-1">All Pages</h2>
                <button
                  onClick={() => setMoreOpen(false)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-tx-3 hover:text-tx-1 transition-colors"
                  style={{ background: "rgba(var(--surface-rgb),0.07)" }}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search */}
              {onOpenCommandPalette && (
                <button
                  onClick={() => { setMoreOpen(false); onOpenCommandPalette(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl mb-4 transition-all"
                  style={{
                    background: "rgba(var(--surface-rgb),0.05)",
                    border: "1px solid rgba(var(--border-rgb),0.1)",
                  }}
                >
                  <Search size={14} className="text-tx-3" />
                  <span className="text-sm text-tx-3">Search & Command Palette</span>
                </button>
              )}

              {/* Page grid */}
              <div className="grid grid-cols-3 gap-3">
                {allPages.map((page) => {
                  const isActive = page.path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(page.path);
                  return (
                    <button
                      key={page.id}
                      onClick={() => { setMoreOpen(false); navigate(page.path); }}
                      className="flex flex-col items-center gap-2 py-3 px-2 rounded-2xl transition-all"
                      style={{
                        background: isActive ? "rgba(var(--surface-rgb),0.08)" : "rgba(var(--surface-rgb),0.04)",
                        border: `1px solid ${isActive ? "rgba(var(--border-rgb),0.12)" : "rgba(var(--border-rgb),0.07)"}`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background: isActive ? "rgba(var(--surface-rgb),0.1)" : "rgba(var(--surface-rgb),0.07)",
                        }}
                      >
                        <page.Icon size={18} style={{ color: isActive ? "var(--accent)" : "var(--tx-3)" }} />
                      </div>
                      <span
                        className="text-[10px] font-semibold text-center leading-tight"
                        style={{ color: isActive ? "var(--accent)" : "var(--tx-3)" }}
                      >
                        {page.label}
                      </span>
                    </button>
                  );
                })}
              </div>
        </motion.div>
      )}
      {ripple}
    </>
  );
}
