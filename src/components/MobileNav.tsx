import { type ElementType, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  Scale,
  Search,
  Settings,
  Wallet,
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
        alt="avatar"
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: avatarColor ?? "#1dd4b4",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "#fff",
    }}>
      {initials}
    </div>
  );
}

export default function MobileNav({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  const loc = useLocation();
  const { data } = useAppData();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch email once on mount
  useEffect(() => {
    getSession().then((s) => setUserEmail(s?.user.email ?? null));
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

  const rowStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    width: "100%", padding: "7px 6px", borderRadius: 8,
    fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.72)",
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
      <NavLink to={path} className="flex flex-col items-center gap-1 min-w-0 flex-1 py-2">
        <div
          className="w-9 h-9 flex items-center justify-center rounded-2xl transition-all"
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
          <Icon size={16} style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.35)" }} />
        </div>
        <span
          className="text-[10px] font-semibold truncate"
          style={{ color: isActive ? theme.accent : "rgba(255,255,255,0.35)" }}
        >
          {label}
        </span>
      </NavLink>
    );
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.7rem)] pt-2 md:hidden"
        style={{
          background: "linear-gradient(180deg, rgba(7,8,16,0) 0%, rgba(7,8,16,0.92) 36%, #070810 100%)",
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
            background: "rgba(13,16,24,0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
            backdropFilter: "blur(18px)",
          }}
        >
          {leftItems.map((item) => (
            <NavItem key={item.id} {...item} />
          ))}

          {leftItems.length < 2 &&
            Array.from({ length: 2 - leftItems.length }, (_, index) => (
              <div key={`left-empty-${index}`} className="flex-1" />
            ))}

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex flex-col items-center gap-1 min-w-0 flex-1 py-1.5"
            aria-label="Open quick search"
          >
            <div
              className="w-11 h-11 rounded-[18px] flex items-center justify-center"
              style={{
                background: "linear-gradient(180deg, rgba(244,114,182,0.2) 0%, rgba(244,114,182,0.12) 100%)",
                border: `1px solid ${PAGE_THEMES.ideas.border}`,
                boxShadow: "0 12px 24px rgba(244,114,182,0.18)",
              }}
            >
              <Search size={17} style={{ color: PAGE_THEMES.ideas.accent }} />
            </div>
            <span className="text-[10px] font-semibold" style={{ color: PAGE_THEMES.ideas.accent }}>
              Search
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
        {panelOpen && (
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              bottom: "7rem",
              right: "0.75rem",
              width: 210,
              background: "rgba(10,13,24,0.98)",
              border: "1px solid rgba(255,255,255,0.1)",
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
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              marginBottom: 6,
            }}>
              <Avatar
                avatarUrl={data.userProfile?.avatarUrl}
                username={data.userProfile?.username ?? "Trader"}
                avatarColor={data.userProfile?.avatarColor}
                size={36}
              />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>
                  {data.userProfile?.username ?? "Trader"}
                </div>
                {userEmail && (
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
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
              style={{ ...rowStyle, color: "#f87171" }}
              onClick={async () => { await signOut(); window.location.reload(); }}
            >
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        )}
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
