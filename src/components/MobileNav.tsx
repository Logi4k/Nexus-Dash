import { type ElementType, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Briefcase,
  Landmark,
  LayoutGrid,
  Lightbulb,
  LineChart,
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

export default function MobileNav({ onOpenCommandPalette }: { onOpenCommandPalette?: () => void }) {
  const loc = useLocation();
  const { data } = useAppData();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
            onClick={() => setSettingsOpen(true)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
              background: "rgba(13,16,24,0.88)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 10px 28px rgba(0,0,0,0.32)",
              backdropFilter: "blur(18px)",
              color: "rgba(255,255,255,0.72)",
            }}
            aria-label="Open settings"
          >
            <Settings size={16} />
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
      </nav>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
