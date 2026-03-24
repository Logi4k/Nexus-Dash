import { type ElementType, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Camera,
  Landmark,
  LayoutGrid,
  Lightbulb,
  LineChart,
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
} from "lucide-react";
import { PAGE_THEMES, type PageTheme } from "@/lib/theme";
import { useAppData } from "@/lib/store";
import NotificationBell from "@/components/NotificationBell";
import SettingsModal from "@/components/SettingsModal";
import { DEFAULT_MOBILE_NAV_ITEMS, MOBILE_NAV_OPTIONS, sanitizeMobileNavItems } from "@/lib/mobileNav";
import type { MobileNavItemId } from "@/types";
import { getSession, signOut } from "@/lib/supabase";

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
  { label: "Log Trade",   path: "/journal",  state: { action: "addTrade" },    color: "#8b5cf6", Icon: NotebookPen },
  { label: "Add Expense", path: "/expenses", state: { action: "addExpense" },  color: "#ef4444", Icon: Receipt },
  { label: "Log Payout",  path: "/prop",     state: { action: "logPayout" },   color: "#22c55e", Icon: Wallet },
  { label: "Add Account", path: "/prop",     state: { action: "addAccount" },  color: "#3b82f6", Icon: Briefcase },
] as const;

const SLIDE_TRANSITION = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

function Avatar({ avatarUrl, username, avatarColor, size }: {
  avatarUrl?: string;
  username: string;
  avatarColor?: string;
  size: number;
}) {
  const initials = (username.trim() || "T").slice(0, 2).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
        alt={username}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarColor ?? "#1dd4b4",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "var(--bg-base)",
    }}>
      {initials}
    </div>
  );
}

export default function MobileNav({
  onOpenCommandPalette,
  navVisible = true,
}: {
  onOpenCommandPalette?: () => void;
  navVisible?: boolean;
}) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { data } = useAppData();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLDivElement>(null);

  // Fetch email once on mount
  useEffect(() => {
    getSession().then((s) => setUserEmail(s?.user.email ?? null)).catch(() => {});
  }, []);

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

  function handleFabAction(action: typeof FAB_ACTIONS[number]) {
    navigate(action.path, { state: action.state });
    setFabOpen(false);
  }

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
    label,
    Icon,
    theme,
  }: {
    path: string;
    label: string;
    Icon: ElementType;
    theme: PageTheme;
  }) {
    const isActive = path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(path);

    return (
      <NavLink to={path} className="flex flex-col items-center gap-1 min-w-0 flex-1 py-1.5">
        <div
          className="w-11 h-11 flex items-center justify-center rounded-2xl transition-all"
          style={
            isActive
              ? {
                  background: theme.dim,
                  border: `1px solid ${theme.border}`,
                  boxShadow: `0 0 0 1px ${theme.border}20 inset`,
                }
              : { background: "transparent" }
          }
        >
          <Icon size={16} style={{ color: isActive ? theme.accent : "var(--tx-3)" }} />
        </div>
        <span
          className="text-[10px] font-semibold truncate"
          style={{ color: isActive ? theme.accent : "var(--tx-3)" }}
        >
          {label}
        </span>
      </NavLink>
    );
  }

  return (
    <>
      {/* Nav bar + FAB wrapped in a single animated container */}
      <motion.div
        animate={{ y: navVisible ? 0 : 120 }}
        transition={SLIDE_TRANSITION}
        className="md:hidden"
        style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50 }}
      >
        <nav
          className="px-3 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-2"
          style={{
            background: "rgb(var(--bg-base-rgb))",
          }}
        >
          <div className="mx-auto mb-2 flex justify-end" style={{ maxWidth: 430 }}>
            <div className="flex items-center gap-2">
              <NotificationBell collapsed={false} />
              <button
                type="button"
                onClick={() => setPanelOpen((o) => !o)}
                style={{
                  width: 34, height: 34,
                  borderRadius: "50%",
                  border: "2px solid rgba(99,102,241,0.45)",
                  padding: 0, overflow: "hidden",
                  background: "transparent", cursor: "pointer",
                  boxShadow: panelOpen ? "0 0 0 3px rgba(99,102,241,0.25)" : "none",
                  flexShrink: 0,
                }}
                aria-label="Open account panel"
              >
                <Avatar
                  avatarUrl={data.userProfile?.avatarUrl}
                  username={data.userProfile?.username ?? "Trader"}
                  avatarColor={data.userProfile?.avatarColor}
                  size={30}
                />
              </button>
            </div>
          </div>

          <div
            className="mx-auto flex items-center gap-1 px-2 h-16 rounded-[24px]"
            style={{
              maxWidth: 430,
              background: `rgba(var(--bg-card-rgb),0.95)`,
              border: "1px solid rgba(var(--border-rgb),0.08)",
              boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
              backdropFilter: "blur(20px)",
            }}
          >
            {leftItems.map((item) => (
              <NavItem key={item.id} {...item} />
            ))}

            {leftItems.length < 2 &&
              Array.from({ length: 2 - leftItems.length }, (_, index) => (
                <div key={`left-empty-${index}`} className="flex-1" />
              ))}

            {/* More / All Pages Button */}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-1 min-w-0 flex-1 py-1.5"
              aria-label="All pages"
            >
              <div
                className="w-11 h-11 rounded-[18px] flex items-center justify-center"
                style={{
                  background: "rgba(var(--surface-rgb),0.06)",
                  border: "1px solid rgba(var(--border-rgb),0.1)",
                }}
              >
                <MoreHorizontal size={17} style={{ color: "var(--tx-3)" }} />
              </div>
              <span className="text-[10px] font-semibold text-tx-4">
                More
              </span>
            </button>

            {rightItems.map((item) => (
              <NavItem key={item.id} {...item} />
            ))}

            {rightItems.length < 2 &&
              Array.from({ length: 2 - rightItems.length }, (_, index) => (
                <div key={`right-empty-${index}`} className="flex-1" />
              ))}
          </div>

          <AnimatePresence>
            {panelOpen && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
                style={{
                  position: "fixed",
                  bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)",
                  right: "0.75rem",
                  width: 210,
                  background: `rgba(var(--bg-card-rgb),0.98)`,
                  border: "1px solid rgba(var(--border-rgb),0.1)",
                  borderRadius: 16,
                  padding: "12px 10px",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
                  zIndex: 60,
                }}
              >
                {/* Avatar + name/email */}
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
                    size={36}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--tx-1)" }}>
                      {data.userProfile?.username ?? "Trader"}
                    </div>
                    {userEmail && (
                      <div style={{ fontSize: 10, color: "var(--tx-4)", marginTop: 1 }}>
                        {userEmail}
                      </div>
                    )}
                  </div>
                </div>

                {/* Settings */}
                <button
                  type="button"
                  style={rowStyle}
                  onClick={() => { setPanelOpen(false); setSettingsOpen(true); }}
                >
                  <Settings size={13} /> Settings
                </button>

                {/* Change Photo */}
                <button
                  type="button"
                  style={rowStyle}
                  onClick={() => { setPanelOpen(false); setSettingsOpen(true); }}
                >
                  <Camera size={13} /> Change Photo
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
        </nav>
      </motion.div>

      {/* FAB — outside the animated nav wrapper so it is never affected by the translateY transform */}
      <div ref={fabRef} className="md:hidden">
        {/* Action items stacked above FAB */}
        <AnimatePresence>
          {fabOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed right-4 z-50 flex flex-col items-end gap-2 md:hidden"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 9.5rem)" }}
            >
              {FAB_ACTIONS.map((action, i) => (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, y: 16, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  onClick={() => handleFabAction(action)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                  style={{
                    background: `${action.color}20`,
                    border: `1px solid ${action.color}35`,
                    boxShadow: `0 4px 12px ${action.color}25`,
                    minWidth: 160,
                  }}
                >
                  <action.Icon size={16} style={{ color: action.color }} />
                  <span className="text-sm font-semibold text-tx-1 whitespace-nowrap">{action.label}</span>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => setFabOpen((o) => !o)}
          aria-label={fabOpen ? "Close quick actions" : "Open quick actions"}
          className="fixed right-4 z-[51] flex items-center justify-center rounded-full md:hidden"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 8rem)",
            width: 52,
            height: 52,
            background: "var(--tx-1)",
            color: "var(--bg-base)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          }}
        >
          <motion.div
            animate={{ rotate: fabOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus size={22} strokeWidth={2.5} />
          </motion.div>
        </motion.button>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* More / All Pages Drawer — fixed positioned, unaffected by nav visibility */}
      <AnimatePresence>
        {moreOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[55] md:hidden"
              style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
              onClick={() => setMoreOpen(false)}
            />
            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[56] md:hidden rounded-t-[28px] px-5 pt-5"
              style={{
                background: `rgba(var(--bg-card-rgb),0.98)`,
                border: "1px solid rgba(var(--border-rgb),0.1)",
                boxShadow: "0 -8px 48px rgba(0,0,0,0.5)",
                backdropFilter: "blur(20px)",
                paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
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
                        background: isActive ? page.theme.dim : "rgba(var(--surface-rgb),0.04)",
                        border: `1px solid ${isActive ? page.theme.border : "rgba(var(--border-rgb),0.07)"}`,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background: isActive ? `${page.theme.accent}20` : "rgba(var(--surface-rgb),0.07)",
                        }}
                      >
                        <page.Icon size={18} style={{ color: isActive ? page.theme.accent : "var(--tx-3)" }} />
                      </div>
                      <span
                        className="text-[10px] font-semibold text-center leading-tight"
                        style={{ color: isActive ? page.theme.accent : "var(--tx-3)" }}
                      >
                        {page.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
