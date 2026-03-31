import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutGrid, LineChart, NotebookPen, Briefcase,
  Wallet, Landmark, Scale, PieChart, Lightbulb,
  ChevronLeft, ChevronRight, Search, Zap, Settings,
} from "lucide-react";
import { cn, fmtGBP, toNum } from "@/lib/utils";
import { useAppData } from "@/lib/store";
import { PAGE_THEMES, type PageThemeKey } from "@/lib/theme";
import NotificationBell from "@/components/NotificationBell";
import SettingsModal from "@/components/SettingsModal";

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

export default function Sidebar({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  const { data } = useAppData();
  const loc = useLocation();
  const [now, setNow] = useState(new Date());
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebarCollapsed") === "true"; } catch { return false; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Computed values
  const totalWithdrawals = data.withdrawals.reduce((s, w) => s + toNum(w.gross), 0);
  const totalExpenses    = data.expenses.reduce((s, e) => s + toNum(e.amount), 0);
  const totalDebt        = (data.debts || []).reduce((s, d) => s + d.currentBalance, 0)
                         + (data.otherDebts || []).reduce((s, d) => s + d.currentBalance, 0);
  const investVal        = data.investments.reduce((s, i) => s + toNum(i.units) * toNum(i.cur), 0);
  const t212Val          = data.t212?.total_value || 0;
  const netWorth         = totalWithdrawals - totalExpenses + investVal + t212Val - totalDebt;

  const activeFunded     = data.accounts.filter(a => ["funded","Funded"].includes(a.status)).length;
  const activeChallenges = data.accounts.filter(a => a.status === "Challenge").length;

  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  const username    = data.userProfile?.username ?? "Trader";
  const avatarColor = data.userProfile?.avatarColor ?? "#f472b6";
  const avatarUrl   = data.userProfile?.avatarUrl;
  const initials    = username.slice(0, 2).toUpperCase();

  // Determine active theme for accent colouring
  const activeNavItem = NAV.find(n => n.path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.path));
  const activeTheme   = activeNavItem ? PAGE_THEMES[activeNavItem.themeKey] : PAGE_THEMES.dashboard;

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
              <div className="text-[10px] font-medium mb-1" style={{ color: activeTheme.accent }}>Net Worth</div>
              <div className="text-[28px] font-black tabular-nums leading-tight tracking-tight"
                style={{ color: netWorth >= 0 ? "var(--tx-1)" : "var(--color-loss)" }}>
                {fmtGBP(netWorth)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg p-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.18)" }}>
                  <div className="text-[9px] font-medium mb-0.5" style={{ color: "rgba(34,197,94,0.65)" }}>Funded</div>
                  <div className="text-base font-black leading-none" style={{ color: "var(--color-profit)" }}>{activeFunded}</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.16)" }}>
                  <div className="text-[9px] font-medium mb-0.5" style={{ color: "rgba(245,158,11,0.65)" }}>Challenges</div>
                  <div className="text-base font-black leading-none" style={{ color: "var(--color-warn)" }}>{activeChallenges}</div>
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
            title={isCollapsed ? "Quick find" : undefined}
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

          {NAV.map(({ path, label, Icon, themeKey }) => {
            const theme    = PAGE_THEMES[themeKey];
            const isActive = path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(path);
            return (
              <NavLink
                key={path}
                to={path}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden",
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
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs select-none overflow-hidden"
                style={avatarUrl ? {} : { background: avatarColor + "20", border: `1.5px solid ${avatarColor}50`, color: avatarColor }}>
                {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--tx-1)" }}>{username}</p>
                <p className="text-[10px]" style={{ color: "var(--tx-4)" }}>{dateStr} | {timeStr}</p>
              </div>
              <div className="flex items-center gap-1">
                <NotificationBell collapsed={false} />
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
              <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs select-none overflow-hidden"
                style={avatarUrl ? {} : { background: avatarColor + "20", border: `1.5px solid ${avatarColor}50`, color: avatarColor }}
                title={username}>
                {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : initials}
              </div>
              <NotificationBell collapsed={true} />
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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
