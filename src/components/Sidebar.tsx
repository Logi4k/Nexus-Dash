import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  LayoutGrid, LineChart, NotebookPen, Briefcase,
  Wallet, Landmark, Scale, PieChart, Lightbulb,
  ChevronLeft, ChevronRight, Search, Zap, Settings, PanelRightOpen,
  Sun, Moon,
} from "lucide-react";
import { cn, fmtGBP, toNum } from "@/lib/utils";
import { useAppData } from "@/lib/store";
import type { AppData } from "@/types";
import { PAGE_THEMES, type PageThemeKey } from "@/lib/theme";
import NotificationBell from "@/components/NotificationBell";
import SettingsModal from "@/components/SettingsModal";
import { useThemeTransition } from "@/components/ThemeTransition";
import { useBWMode, bwColor } from "@/lib/useBWMode";

const NAV: { path: string; label: string; Icon: React.ElementType; themeKey: PageThemeKey }[] = [
  { path: "/",            label: "Dashboard",     Icon: LayoutGrid,   themeKey: "dashboard"   },
  { path: "/market",      label: "Market",        Icon: LineChart,     themeKey: "market"      },
  { path: "/journal",     label: "Journal",       Icon: NotebookPen,   themeKey: "journal"     },
  { path: "/prop",        label: "Prop Accounts", Icon: Briefcase,     themeKey: "prop"        },
  { path: "/expenses",    label: "Expenses",      Icon: Wallet,        themeKey: "expenses"    },
  { path: "/debt",        label: "Debt",          Icon: Landmark,      themeKey: "debt"        },
  { path: "/tax",         label: "Tax",           Icon: Scale,         themeKey: "tax"         },
  { path: "/investments", label: "Investments",   Icon: PieChart,      themeKey: "investments" },
  { path: "/ideas",       label: "Ideas",         Icon: Lightbulb,     themeKey: "ideas"       },
];

export default function Sidebar({
  onOpenCommandPalette,
  onOpenWorkspaceDrawer,
}: {
  onOpenCommandPalette?: () => void;
  onOpenWorkspaceDrawer?: () => void;
}) {
  const { data: _data, update } = useAppData();
  const data = _data ?? ({} as AppData);
  const loc = useLocation();
  const [now, setNow] = useState(new Date());
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebarCollapsed") === "true"; } catch { return false; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const currentTheme = data.userSettings?.theme ?? "dark";
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  function toggleCollapse() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebarCollapsed", String(next)); } catch {}
      return next;
    });
  }

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
  const expandedThemeBtnRef = useRef<HTMLButtonElement>(null);
  const collapsedThemeBtnRef = useRef<HTMLButtonElement>(null);
  const handleThemeClick = useCallback((isExpanded: boolean) => {
    const el = isExpanded ? expandedThemeBtnRef.current : collapsedThemeBtnRef.current;
    if (el) activateTheme(el);
  }, [activateTheme]);

  // Computed values
  const totalWithdrawals = data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
  const totalExpenses    = data.expenses.reduce((s, e) => s + toNum(e.amount), 0);
  const totalDebt        = (data.debts || []).reduce((s, d) => s + d.currentBalance, 0)
                         + (data.otherDebts || []).reduce((s, d) => s + d.currentBalance, 0);
  const investVal        = data.investments.reduce((s, i) => s + toNum(i.units) * toNum(i.cur), 0);
  const t212Val          = data.t212?.total_value || 0;
  const netWorth         = totalWithdrawals - totalExpenses + investVal + t212Val - totalDebt;

  const activeFunded     = data.accounts.filter(a => String(a.status).toLowerCase() === "funded").length;
  const activeChallenges = data.accounts.filter(a => a.status.toLowerCase() === "challenge").length;

  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  const username    = data.userProfile?.username ?? "Trader";
  const avatarColor = data.userProfile?.avatarColor ?? "#f472b6";
  const avatarUrl   = data.userProfile?.avatarUrl;
  const initials    = username.slice(0, 2).toUpperCase();

  // Determine active theme for accent colouring
  const activeNavItem = NAV.find(n => n.path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.path));
  const activeTheme   = activeNavItem ? PAGE_THEMES[activeNavItem.themeKey] : PAGE_THEMES.dashboard;
  const isBW = useBWMode();

  const isCollapsed = collapsed;

  return (
    <>
      <aside
        className="flex flex-col h-full select-none flex-shrink-0 transition-all duration-200"
        style={{
          width: isCollapsed ? 64 : 240,
          background: "var(--bg-base)",
          borderRight: "1px solid rgba(var(--border-rgb),0.07)",
          overflow: "hidden",
        }}
      >
        {/* ── Logo + Toggle ── */}
        <div className="px-3 pt-4 pb-3 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.06)", minHeight: 56 }}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: activeTheme.dim, border: `1px solid ${activeTheme.border}` }}>
              <Zap size={13} style={{ color: activeTheme.accent }} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="font-black text-sm tracking-[0.18em] leading-none whitespace-nowrap" style={{ color: "var(--tx-1)" }}>
                  NEXUS
                </div>
                <div className="text-[9px] font-medium mt-0.5 whitespace-nowrap" style={{ color: "var(--tx-4)" }}>
                  Trader Dashboard
                </div>
              </div>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: "var(--tx-4)", background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
            {isCollapsed ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
          </button>
        </div>

        {/* ── Net Worth Card (expanded only) ── */}
        {!isCollapsed && (
          <div className="px-3 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.06)" }}>
            <div className="rounded-xl p-3" style={{ background: activeTheme.dim, border: `1px solid ${activeTheme.border}` }}>
              <div className="section-label mb-1.5" style={{ color: activeTheme.accent }}>Net Worth</div>
              <div className="stat-display"
                style={{ color: netWorth >= 0 ? "var(--tx-1)" : "var(--color-loss)" }}>
                {fmtGBP(netWorth)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div
                  className="rounded-lg p-2"
                  style={{
                    background: "rgba(var(--color-profit-rgb), 0.10)",
                    border: "1px solid rgba(var(--color-profit-rgb), 0.18)",
                  }}
                >
                  <div className="text-[9px] font-medium mb-0.5" style={{ color: "rgba(var(--color-profit-rgb), 0.75)" }}>Funded</div>
                  <div className="text-base font-black leading-none text-profit">{activeFunded}</div>
                </div>
                <div
                  className="rounded-lg p-2"
                  style={{
                    background: "rgba(var(--color-warn-rgb), 0.10)",
                    border: "1px solid rgba(var(--color-warn-rgb), 0.18)",
                  }}
                >
                  <div className="text-[9px] font-medium mb-0.5" style={{ color: "rgba(var(--color-warn-rgb), 0.75)" }}>Challenges</div>
                  <div className="text-base font-black leading-none text-warn">{activeChallenges}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Quick Find"
            title={isCollapsed ? "Quick Find (Ctrl K)" : "Quick Find (Ctrl K)"}
            className={cn(
              "mb-2 w-full rounded-xl transition-all",
              isCollapsed ? "px-0 py-2.5 flex justify-center" : "px-3 py-2.5 flex items-center gap-2.5"
            )}
            style={{ background: "rgba(var(--surface-rgb),0.035)", border: "1px solid rgba(var(--border-rgb),0.06)", color: "var(--tx-2)" }}
          >
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "rgba(var(--surface-rgb),0.04)" }}>
              <Search size={14} />
            </div>
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left text-[13px] font-medium">Quick Find</span>
                <span className="text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: "rgba(var(--surface-rgb),0.05)", color: "var(--tx-4)" }}>
                  {isMac ? "⌘ K" : "Ctrl K"}
                </span>
              </>
            )}
          </button>

          {onOpenWorkspaceDrawer && (
            <button
              type="button"
              onClick={onOpenWorkspaceDrawer}
              aria-label="Open workspace drawer"
              title={isCollapsed ? "Workspace Drawer (Shift W)" : "Workspace Drawer (Shift W)"}
              className={cn(
                "mb-2 w-full rounded-xl transition-all",
                isCollapsed ? "px-0 py-2.5 flex justify-center" : "px-3 py-2.5 flex items-center gap-2.5"
              )}
              style={{ background: "rgba(var(--surface-rgb),0.028)", border: "1px solid rgba(var(--border-rgb),0.05)", color: "var(--tx-2)" }}
            >
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: "rgba(var(--surface-rgb),0.04)" }}>
                <PanelRightOpen size={14} />
              </div>
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left text-[13px] font-medium">Workspace</span>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: "rgba(var(--surface-rgb),0.05)", color: "var(--tx-4)" }}>
                    Shift W
                  </span>
                </>
              )}
            </button>
          )}

          {NAV.map(({ path, label, Icon, themeKey }) => {
            const theme    = PAGE_THEMES[themeKey];
            const isActive = path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(path);
            return (
              <NavLink
                key={path}
                to={path}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden hover:translate-x-0.5",
                  isCollapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
                )}
                style={isActive
                  ? { background: theme.dim, color: theme.accent, border: `1px solid ${theme.border}` }
                  : { color: "var(--tx-4)", border: "1px solid transparent" }
                }
              >
                {/* Active left bar */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 rounded-r-full"
                    style={{ height: "55%", background: theme.accent }} />
                )}
                {/* Icon */}
                <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg"
                  style={isActive ? { background: theme.glow } : {}}>
                  <Icon size={14} style={{ color: isActive ? theme.accent : "var(--tx-4)" }} strokeWidth={isActive ? 2 : 1.75} />
                </div>
                {!isCollapsed && (
                  <span className="flex-1 truncate text-[13px]">{label}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="px-3 py-2.5 flex flex-col gap-2 flex-shrink-0" style={{ borderTop: "1px solid rgba(var(--border-rgb),0.06)" }}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              {/* Avatar */}
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 font-black text-sm select-none overflow-hidden"
                style={avatarUrl ? {} : { background: avatarColor + "20", border: `1.5px solid ${avatarColor}50`, color: avatarColor }}>
                {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate" style={{ color: "var(--tx-1)" }}>{username}</p>
                <p className="text-[10px]" style={{ color: "var(--tx-4)" }}>{dateStr} | {timeStr}</p>
              </div>
              <div className="flex items-center gap-1">
                <NotificationBell collapsed={false} />
                <button
                  ref={expandedThemeBtnRef}
                  onClick={() => handleThemeClick(true)}
                  aria-label={currentTheme === "dark" ? "Switch to paper mode" : "Switch to dark mode"}
                  title={currentTheme === "dark" ? "Paper mode" : "Dark mode"}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                  style={{ color: "var(--tx-4)", background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
                  {currentTheme === "dark" ? <Sun size={11} /> : <Moon size={11} />}
                </button>
                <button
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Open settings"
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ color: "var(--tx-4)", background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
                  <Settings size={11} />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm select-none overflow-hidden"
                style={avatarUrl ? {} : { background: avatarColor + "20", border: `1.5px solid ${avatarColor}50`, color: avatarColor }}
                title={username}>
                {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : initials}
              </div>
              <NotificationBell collapsed={true} />
              <button
                ref={collapsedThemeBtnRef}
                onClick={() => handleThemeClick(false)}
                aria-label={currentTheme === "dark" ? "Switch to paper mode" : "Switch to dark mode"}
                title={currentTheme === "dark" ? "Paper mode" : "Dark mode"}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                style={{ color: "var(--tx-4)", background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
                {currentTheme === "dark" ? <Sun size={11} /> : <Moon size={11} />}
              </button>
              <button onClick={() => setSettingsOpen(true)}
                aria-label="Open settings"
                className="w-7 h-7 flex items-center justify-center rounded-lg"
                style={{ color: "var(--tx-4)", background: "rgba(var(--surface-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
                <Settings size={11} />
              </button>
            </div>
          )}
        </div>
      </aside>
      {ripple}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
