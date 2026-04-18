import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine,
  BookmarkPlus,
  Briefcase,
  Clock3,
  FolderOpen,
  HandCoins,
  Landmark,
  LayoutGrid,
  Layers3,
  Lightbulb,
  LineChart,
  NotebookPen,
  PieChart,
  Plus,
  Receipt,
  Repeat,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import CommandPalette, { type CommandPaletteItem } from "./CommandPalette";
import QuickActionHost from "./QuickActionHost";
import TitleBar from "./TitleBar";
import Modal from "./Modal";
import { PageViewProvider, useCurrentPageView } from "./PageViewContext";
import WorkspaceDrawer from "./WorkspaceDrawer";
import ExportCenterModal from "./ExportCenterModal";
import { useAppData, useSyncStatus } from "@/lib/store";
import type { AppData, RecentEntry, SavedView } from "@/types";
import { navigateToQuickAction, type QuickAction } from "@/lib/quickActions";
import { buildViewIntentState, upsertRecentEntry } from "@/lib/viewIntents";
import { PAGE_THEMES, getPageThemeKeyForPath, hexToRgbTriplet } from "@/lib/theme";
import { useBWMode, bwPageTheme } from "@/lib/useBWMode";

const MOBILE_SHELL_PAD_VISIBLE = "calc(env(safe-area-inset-bottom) + 5.5rem)";
const MOBILE_SHELL_PAD_HIDDEN = "calc(env(safe-area-inset-bottom) + 1.2rem)";

/** Lazy route loading — minimal so it does not “pop” after the route motion has already finished. */
function PageSwitchFallback() {
  return <div className="min-h-[50vh] w-full" aria-busy="true" />;
}

/** Warm route chunks so navigations rarely suspend mid-transition. */
function prefetchRouteChunks() {
  void import("@/pages/Dashboard");
  void import("@/pages/Market");
  void import("@/pages/PropAccounts");
  void import("@/pages/Expenses");
  void import("@/pages/Debt");
  void import("@/pages/Tax");
  void import("@/pages/Investments");
  void import("@/pages/Journal");
  void import("@/pages/Ideas");
}

const PAGE_METADATA = {
  "/": {
    label: "Dashboard",
    description: "Main overview and performance dashboard",
    Icon: LayoutGrid,
    iconKey: "dashboard",
  },
  "/market": {
    label: "Market",
    description: "Sessions, calendar, and market tools",
    Icon: LineChart,
    iconKey: "market",
  },
  "/journal": {
    label: "Journal",
    description: "Trades, sessions, and review notes",
    Icon: NotebookPen,
    iconKey: "journal",
  },
  "/ideas": {
    label: "Ideas",
    description: "Research workspace and notes",
    Icon: Lightbulb,
    iconKey: "ideas",
  },
  "/prop": {
    label: "Prop Accounts",
    description: "Accounts, payouts, and challenge progress",
    Icon: Briefcase,
    iconKey: "prop",
  },
  "/expenses": {
    label: "Expenses",
    description: "Prop costs and overhead tracking",
    Icon: Wallet,
    iconKey: "expenses",
  },
  "/debt": {
    label: "Debt",
    description: "Cards, balances, and repayment plans",
    Icon: Landmark,
    iconKey: "debt",
  },
  "/tax": {
    label: "Tax",
    description: "Tax planning and filing prep",
    Icon: Scale,
    iconKey: "tax",
  },
  "/investments": {
    label: "Investments",
    description: "Portfolio and subscription overview",
    Icon: PieChart,
    iconKey: "investments",
  },
} as const;

function iconForKey(iconKey?: string) {
  switch (iconKey) {
    case "dashboard":
      return LayoutGrid;
    case "market":
      return LineChart;
    case "journal":
      return NotebookPen;
    case "ideas":
      return Lightbulb;
    case "prop":
      return Briefcase;
    case "expenses":
      return Wallet;
    case "debt":
      return Landmark;
    case "tax":
      return Scale;
    case "investments":
      return PieChart;
    case "saved-view":
      return BookmarkPlus;
    case "recent":
      return Clock3;
    default:
      return FolderOpen;
  }
}

function LayoutBody() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { data: _data, update } = useAppData();
  const syncStatus = useSyncStatus();
  const data = _data ?? ({} as AppData);
  const isBW = useBWMode();
  const { currentView } = useCurrentPageView();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState<QuickAction | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [exportCenterOpen, setExportCenterOpen] = useState(false);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [manageViewsOpen, setManageViewsOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState("");
  const mainRef = useRef<HTMLElement>(null);
  const lastScrollTop = useRef(0);
  const peakScrollTop = useRef(0);
  const savedViews = data.userSettings?.savedViews ?? [];
  const recentEntries = data.userSettings?.recentEntries ?? [];

  const pushRecent = useCallback(
    (entry: Omit<RecentEntry, "visitedAt">) => {
      update((prev) => ({
        ...prev,
        userSettings: {
          ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }),
          recentEntries: upsertRecentEntry(prev.userSettings?.recentEntries, entry),
        },
      }));
    },
    [update]
  );

  const runNavigation = useCallback(
    (
      route: string,
      state?: unknown,
      recentEntry?: Omit<RecentEntry, "visitedAt">
    ) => {
      if (recentEntry) {
        pushRecent(recentEntry);
      }
      if (state) {
        navigate(route, { state });
        return;
      }
      navigate(route);
    },
    [navigate, pushRecent]
  );

  // Reset scroll position and nav visibility on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    lastScrollTop.current = 0;
    peakScrollTop.current = 0;
    setNavVisible(true);
    setQuickActionOpen(null);
  }, [loc.pathname]);

  useEffect(() => {
    prefetchRouteChunks();
  }, []);

  useEffect(() => {
    if (!saveViewOpen) return;
    setSaveViewName(currentView?.title ?? "");
  }, [currentView, saveViewOpen]);

  useEffect(() => {
    const pageMeta =
      PAGE_METADATA[loc.pathname as keyof typeof PAGE_METADATA] ?? null;
    if (!pageMeta) return;
    pushRecent({
      id: `page-${loc.pathname}`,
      kind: "page",
      route: loc.pathname,
      label: pageMeta.label,
      description: pageMeta.description,
      iconKey: pageMeta.iconKey,
    });
  }, [loc.pathname, pushRecent]);

  // Route-aware accent on :root so PageHeader, TitleBar, mobile nav, and focus rings match the active page.
  useEffect(() => {
    const key = getPageThemeKeyForPath(loc.pathname);
    const th = bwPageTheme(PAGE_THEMES[key], isBW);
    const root = document.documentElement;
    root.style.setProperty("--accent", th.accent);
    root.style.setProperty("--accent-rgb", hexToRgbTriplet(th.accent));
  }, [loc.pathname, isBW]);

  // Scroll direction tracking for nav hide/show
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    function onScroll() {
      const st = el!.scrollTop;

      // Always show nav when near top
      if (st < 10) {
        setNavVisible(true);
        peakScrollTop.current = 0;
        lastScrollTop.current = st;
        return;
      }

      if (st < lastScrollTop.current) {
        // Scrolling up — show immediately
        peakScrollTop.current = st;
        setNavVisible(true);
      } else {
        // Scrolling down — update peak and hide after 60px threshold
        if (st > peakScrollTop.current) {
          if (st - peakScrollTop.current > 60) {
            setNavVisible(false);
          }
        } else {
          peakScrollTop.current = st;
        }
      }

      lastScrollTop.current = st;
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setWorkspaceOpen(false);
        setExportCenterOpen(false);
        return;
      }

      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "w":
            e.preventDefault();
            setWorkspaceOpen((prev) => !prev);
            return;
          case "x":
            e.preventDefault();
            setExportCenterOpen(true);
            return;
          case "s":
            if (currentView) {
              e.preventDefault();
              setSaveViewOpen(true);
            }
            return;
          case "t":
            e.preventDefault();
            setQuickActionOpen("addTrade");
            return;
          case "e":
            e.preventDefault();
            setQuickActionOpen("addExpense");
            return;
          case "a":
            e.preventDefault();
            setQuickActionOpen("addAccount");
            return;
          case "p":
            e.preventDefault();
            setQuickActionOpen("logPayout");
            return;
          case "n":
            e.preventDefault();
            navigateToQuickAction(navigate, "/ideas", "addNote");
            return;
        }
      }

      // Single-letter page navigation (only when not editing and no modifier keys)
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const isEditing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (e.target as HTMLElement).isContentEditable;
      if (isEditing || e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "h": navigate("/"); break;
        case "m": navigate("/market"); break;
        case "j": navigate("/journal"); break;
        case "p": navigate("/prop"); break;
        case "e": navigate("/expenses"); break;
        case "l": navigate("/debt"); break;
        case "i": navigate("/investments"); break;
        case "t": navigate("/tax"); break;
        case "n": navigate("/ideas"); break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentView, navigate]);

  const syncLabel = useMemo(() => {
    let offline = false;
    try {
      const v = localStorage.getItem("nexus.offlineMode");
      offline = v === "true" || v === "1";
    } catch {
      /* ignore */
    }
    if (!syncStatus.enabled) {
      return offline ? "Local only" : "Cloud sync off";
    }
    if (syncStatus.lastError) return "Sync needs attention";
    if (syncStatus.syncInFlight) return "Syncing workspace…";
    if (syncStatus.syncedAt) {
      return `Synced ${new Date(syncStatus.syncedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    return "Cloud connected";
  }, [
    syncStatus.enabled,
    syncStatus.lastError,
    syncStatus.syncInFlight,
    syncStatus.syncedAt,
  ]);

  const commandItems = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        description: "Open your main overview",
        group: "Pages",
        keywords: ["home", "overview"],
        Icon: LayoutGrid,
        run: () =>
          runNavigation("/", undefined, {
            id: "page-dashboard",
            kind: "page",
            route: "/",
            label: "Dashboard",
            description: PAGE_METADATA["/"].description,
            iconKey: PAGE_METADATA["/"].iconKey,
          }),
      },
      {
        id: "nav-market",
        label: "Market",
        description: "Open sessions and market tools",
        group: "Pages",
        keywords: ["sessions", "markets"],
        Icon: LineChart,
        run: () =>
          runNavigation("/market", undefined, {
            id: "page-market",
            kind: "page",
            route: "/market",
            label: "Market",
            description: PAGE_METADATA["/market"].description,
            iconKey: PAGE_METADATA["/market"].iconKey,
          }),
      },
      {
        id: "nav-journal",
        label: "Journal",
        description: "Open your trading journal",
        group: "Pages",
        keywords: ["trades", "log"],
        Icon: NotebookPen,
        run: () =>
          runNavigation("/journal", undefined, {
            id: "page-journal",
            kind: "page",
            route: "/journal",
            label: "Journal",
            description: PAGE_METADATA["/journal"].description,
            iconKey: PAGE_METADATA["/journal"].iconKey,
          }),
      },
      {
        id: "nav-prop",
        label: "Prop Accounts",
        description: "Open your prop firm accounts",
        group: "Pages",
        keywords: ["funded", "challenge", "payout"],
        Icon: Briefcase,
        run: () =>
          runNavigation("/prop", undefined, {
            id: "page-prop",
            kind: "page",
            route: "/prop",
            label: "Prop Accounts",
            description: PAGE_METADATA["/prop"].description,
            iconKey: PAGE_METADATA["/prop"].iconKey,
          }),
      },
      {
        id: "nav-expenses",
        label: "Expenses",
        description: "Open your expense tracker",
        group: "Pages",
        keywords: ["costs", "spending"],
        Icon: Wallet,
        run: () =>
          runNavigation("/expenses", undefined, {
            id: "page-expenses",
            kind: "page",
            route: "/expenses",
            label: "Expenses",
            description: PAGE_METADATA["/expenses"].description,
            iconKey: PAGE_METADATA["/expenses"].iconKey,
          }),
      },
      {
        id: "nav-debt",
        label: "Debt",
        description: "Open cards and repayments",
        group: "Pages",
        keywords: ["credit", "repayment"],
        Icon: Landmark,
        run: () =>
          runNavigation("/debt", undefined, {
            id: "page-debt",
            kind: "page",
            route: "/debt",
            label: "Debt",
            description: PAGE_METADATA["/debt"].description,
            iconKey: PAGE_METADATA["/debt"].iconKey,
          }),
      },
      {
        id: "nav-tax",
        label: "Tax",
        description: "Open tax planning and records",
        group: "Pages",
        keywords: ["hmrc", "taxes"],
        Icon: Scale,
        run: () =>
          runNavigation("/tax", undefined, {
            id: "page-tax",
            kind: "page",
            route: "/tax",
            label: "Tax",
            description: PAGE_METADATA["/tax"].description,
            iconKey: PAGE_METADATA["/tax"].iconKey,
          }),
      },
      {
        id: "nav-investments",
        label: "Investments",
        description: "Open your portfolio overview",
        group: "Pages",
        keywords: ["portfolio", "wealth"],
        Icon: PieChart,
        run: () =>
          runNavigation("/investments", undefined, {
            id: "page-investments",
            kind: "page",
            route: "/investments",
            label: "Investments",
            description: PAGE_METADATA["/investments"].description,
            iconKey: PAGE_METADATA["/investments"].iconKey,
          }),
      },
      {
        id: "nav-ideas",
        label: "Ideas",
        description: "Open your research and notes workspace",
        group: "Pages",
        keywords: ["notes", "brainstorm", "research"],
        Icon: Lightbulb,
        run: () =>
          runNavigation("/ideas", undefined, {
            id: "page-ideas",
            kind: "page",
            route: "/ideas",
            label: "Ideas",
            description: PAGE_METADATA["/ideas"].description,
            iconKey: PAGE_METADATA["/ideas"].iconKey,
          }),
      },
      {
        id: "action-note",
        label: "New note",
        description: "Create a fresh page in Ideas",
        group: "Quick Actions",
        keywords: ["idea", "page", "brainstorm"],
        Icon: Plus,
        run: () => {
          pushRecent({
            id: "action-add-note",
            kind: "action",
            route: "/ideas",
            label: "New note",
            description: "Create a fresh page in Ideas",
            iconKey: "ideas",
          });
          navigateToQuickAction(navigate, "/ideas", "addNote");
        },
      },
      {
        id: "action-trade",
        label: "Log trade",
        description: "Open the new trade flow in Journal",
        group: "Quick Actions",
        keywords: ["journal", "trade"],
        Icon: NotebookPen,
        run: () => {
          pushRecent({
            id: "action-add-trade",
            kind: "action",
            route: "/journal",
            label: "Log trade",
            description: "Open the new trade flow in Journal",
            iconKey: "journal",
          });
          navigateToQuickAction(navigate, "/journal", "addTrade");
        },
      },
      {
        id: "action-expense",
        label: "New expense",
        description: "Open the add expense flow",
        group: "Quick Actions",
        keywords: ["cost", "receipt"],
        Icon: Wallet,
        run: () => {
          pushRecent({
            id: "action-add-expense",
            kind: "action",
            route: "/expenses",
            label: "New expense",
            description: "Open the add expense flow",
            iconKey: "expenses",
          });
          navigateToQuickAction(navigate, "/expenses", "addExpense");
        },
      },
      {
        id: "action-account",
        label: "Add prop account",
        description: "Create a new prop account entry",
        group: "Quick Actions",
        keywords: ["funded", "challenge"],
        Icon: Briefcase,
        run: () => {
          pushRecent({
            id: "action-add-account",
            kind: "action",
            route: "/prop",
            label: "Add prop account",
            description: "Create a new prop account entry",
            iconKey: "prop",
          });
          navigateToQuickAction(navigate, "/prop", "addAccount");
        },
      },
      {
        id: "action-payout",
        label: "Log payout",
        description: "Open the payout form in Prop Accounts",
        group: "Quick Actions",
        keywords: ["withdrawal", "profit split"],
        Icon: HandCoins,
        run: () => {
          pushRecent({
            id: "action-log-payout",
            kind: "action",
            route: "/prop",
            label: "Log payout",
            description: "Open the payout form in Prop Accounts",
            iconKey: "prop",
          });
          navigateToQuickAction(navigate, "/prop", "logPayout");
        },
      },
      ...(currentView
        ? [
            {
              id: "action-save-view",
              label: "Save current view",
              description: `Store this ${currentView.title.toLowerCase()} view for quick access`,
              group: "Quick Actions",
              keywords: ["bookmark", "save filters", "view preset"],
              Icon: BookmarkPlus,
              run: () => setSaveViewOpen(true),
            } satisfies CommandPaletteItem,
          ]
        : []),
      {
        id: "action-manage-saved-views",
        label: "Manage saved views",
        description: "Open and remove saved page presets",
        group: "Quick Actions",
        keywords: ["saved views", "bookmarks", "presets"],
        Icon: FolderOpen,
        run: () => setManageViewsOpen(true),
      },
      {
        id: "action-workspace-drawer",
        label: "Open workspace drawer",
        description: "Open recents, saved views, sync status, and hotkeys",
        group: "Quick Actions",
        keywords: ["workspace", "drawer", "control center"],
        Icon: Layers3,
        run: () => setWorkspaceOpen(true),
      },
      {
        id: "action-export-center",
        label: "Open export center",
        description: "Export backups, CSVs, and monthly review packs",
        group: "Quick Actions",
        keywords: ["export", "backup", "csv", "review"],
        Icon: ArrowDownToLine,
        run: () => setExportCenterOpen(true),
      },
    ],
    [currentView, navigate, pushRecent, runNavigation]
  );

  const savedViewItems = useMemo<CommandPaletteItem[]>(
    () =>
      savedViews.map((view) => ({
        id: `saved-${view.id}`,
        label: view.name,
        description: view.description || view.routeLabel,
        group: "Saved Views",
        keywords: [view.routeLabel, view.route, ...(Object.values(view.state).map(String) ?? [])],
        Icon:
          PAGE_METADATA[view.route as keyof typeof PAGE_METADATA]?.Icon ??
          BookmarkPlus,
        run: () =>
          runNavigation(
            view.route,
            buildViewIntentState(view.route, view.state, "saved-view"),
            {
              id: `recent-saved-${view.id}`,
              kind: "saved-view",
              route: view.route,
              label: view.name,
              description: view.description || view.routeLabel,
              iconKey: "saved-view",
              state: view.state,
            }
          ),
      })),
    [runNavigation, savedViews]
  );

  const recentCommandItems = useMemo<CommandPaletteItem[]>(
    () =>
      recentEntries.slice(0, 8).map((entry) => ({
        id: `recent-${entry.id}-${entry.visitedAt}`,
        label: entry.label,
        description: entry.description || new Date(entry.visitedAt).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        }),
        group: "Recent",
        keywords: [entry.route, entry.kind],
        Icon: iconForKey(entry.iconKey),
        run: () => runNavigation(entry.route, entry.state, {
          id: entry.id,
          kind: entry.kind,
          route: entry.route,
          label: entry.label,
          description: entry.description,
          iconKey: entry.iconKey,
          state: entry.state,
        }),
      })),
    [recentEntries, runNavigation]
  );

  const dynamicItems = useMemo<CommandPaletteItem[]>(() => {
    const tradeItems: CommandPaletteItem[] = [...(data.tradeJournal ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 200)
      .map((t) => ({
        id: `trade-${t.id}`,
        label: `${t.instrument} ${t.direction} — ${t.date}`,
        description:
          [t.setup, t.notes].filter(Boolean).join(" · ") || undefined,
        group: "Trades",
        keywords: [t.instrument, t.setup, t.notes, ...(t.tags ?? [])].filter(
          Boolean
        ) as string[],
        Icon: TrendingUp,
        run: () =>
          runNavigation(
            "/journal",
            buildViewIntentState(
              "/journal",
              {
                date: t.date,
                filters: {
                  direction: "all",
                  outcome: "all",
                  phase: "all",
                  sort: "date",
                  accountId: t.accountId,
                },
              },
              "command-palette"
            ),
            {
              id: `entity-trade-${t.id}`,
              kind: "entity",
              route: "/journal",
              label: `${t.instrument} trade`,
              description: `${t.date}${t.accountId ? " · linked account" : ""}`,
              iconKey: "journal",
              state: {
                date: t.date,
                filters: {
                  direction: "all",
                  outcome: "all",
                  phase: "all",
                  sort: "date",
                  accountId: t.accountId,
                },
              },
            }
          ),
      }));

    const expenseItems: CommandPaletteItem[] = [
      ...(data.expenses ?? []).map((expense) => ({ expense, tab: "propfirm" as const })),
      ...(data.genExpenses ?? []).map((expense) => ({ expense, tab: "other" as const })),
    ]
      .sort((a, b) => b.expense.date.localeCompare(a.expense.date))
      .slice(0, 100)
      .map(({ expense: e, tab }) => {
        const amt =
          typeof e.amount === "string" ? parseFloat(e.amount) : e.amount;
        return {
          id: `expense-${e.id}`,
          label: e.description || `${e.cat} expense`,
          description: `${amt < 0 ? "-" : ""}£${Math.abs(amt).toLocaleString()} · ${e.date}`,
          group: "Expenses",
          keywords: [e.description, e.cat].filter(Boolean) as string[],
          Icon: Receipt,
          run: () =>
            runNavigation(
              "/expenses",
              buildViewIntentState(
                "/expenses",
                tab === "propfirm"
                  ? { tab, propSearch: e.description || "" }
                  : { tab, otherSearch: e.description || "" },
                "command-palette"
              ),
              {
                id: `entity-expense-${e.id}`,
                kind: "entity",
                route: "/expenses",
                label: e.description || "Expense",
                description: `${amt < 0 ? "-" : ""}£${Math.abs(amt).toLocaleString()} · ${e.date}`,
                iconKey: "expenses",
                state: tab === "propfirm"
                  ? { tab, propSearch: e.description || "" }
                  : { tab, otherSearch: e.description || "" },
              }
            ),
        };
      });

    const ideaTopicItems: CommandPaletteItem[] = (data.ideaTopics ?? []).map(
      (topic) => ({
        id: `idea-topic-${topic.id}`,
        label: topic.name,
        description: "Topic",
        group: "Ideas",
        keywords: [topic.name],
        Icon: Lightbulb,
        run: () =>
          runNavigation(
            "/ideas",
            buildViewIntentState(
              "/ideas",
              { activeTopicId: topic.id, activeNoteId: null, search: "" },
              "command-palette"
            ),
            {
              id: `entity-topic-${topic.id}`,
              kind: "entity",
              route: "/ideas",
              label: topic.name,
              description: "Topic",
              iconKey: "ideas",
              state: { activeTopicId: topic.id, activeNoteId: null, search: "" },
            }
          ),
      })
    );

    const ideaNoteItems: CommandPaletteItem[] = [...(data.ideaNotes ?? [])]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 120)
      .map((note) => ({
        id: `idea-note-${note.id}`,
        label: note.title || "Untitled note",
        description: new Date(note.updatedAt).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        }),
        group: "Ideas",
        keywords: [
          note.title,
          ...note.tags,
          ...note.blocks.map((block) => block.content).slice(0, 4),
        ].filter(Boolean),
        Icon: Lightbulb,
        run: () =>
          runNavigation(
            "/ideas",
            buildViewIntentState(
              "/ideas",
              {
                activeTopicId: note.topicId,
                activeNoteId: note.id,
                search: "",
                mobileView: "editor",
              },
              "command-palette"
            ),
            {
              id: `entity-note-${note.id}`,
              kind: "entity",
              route: "/ideas",
              label: note.title || "Untitled note",
              description: "Idea note",
              iconKey: "ideas",
              state: {
                activeTopicId: note.topicId,
                activeNoteId: note.id,
                search: "",
                mobileView: "editor",
              },
            }
          ),
      }));

    const accountItems: CommandPaletteItem[] = [...(data.accounts ?? [])]
      .slice(0, 120)
      .map((account) => ({
        id: `account-${account.id}`,
        label: account.name || account.type,
        description: `${account.firm} · ${account.status}`,
        group: "Prop Accounts",
        keywords: [account.name, account.firm, account.status, account.type].filter(Boolean) as string[],
        Icon: Briefcase,
        run: () =>
          runNavigation(
            "/prop",
            buildViewIntentState("/prop", { filters: { status: account.status, sort: "balance" } }, "command-palette"),
            {
              id: `entity-account-${account.id}`,
              kind: "entity",
              route: "/prop",
              label: account.name || account.type,
              description: `${account.firm} · ${account.status}`,
              iconKey: "prop",
              state: { filters: { status: account.status, sort: "balance" } },
            }
          ),
      }));

    const investmentItems: CommandPaletteItem[] = [...(data.investments ?? [])]
      .slice(0, 120)
      .map((investment) => ({
        id: `investment-${investment.id}`,
        label: investment.ticker,
        description: investment.name,
        group: "Investments",
        keywords: [investment.ticker, investment.name, investment.type].filter(Boolean) as string[],
        Icon: PieChart,
        run: () =>
          runNavigation(
            "/investments",
            buildViewIntentState(
              "/investments",
              { search: `${investment.ticker} ${investment.name}`.trim(), filters: { performance: "all", sort: "value" } },
              "command-palette"
            ),
            {
              id: `entity-investment-${investment.id}`,
              kind: "entity",
              route: "/investments",
              label: investment.ticker,
              description: investment.name,
              iconKey: "investments",
              state: { search: `${investment.ticker} ${investment.name}`.trim(), filters: { performance: "all", sort: "value" } },
            }
          ),
      }));

    const debtItems: CommandPaletteItem[] = [...(data.debts ?? [])]
      .slice(0, 80)
      .map((debt) => ({
        id: `debt-${debt.id}`,
        label: debt.name,
        description: `${debt.rate}% APR · £${Number(debt.currentBalance).toLocaleString()}`,
        group: "Debt",
        keywords: [debt.name, debt.network].filter(Boolean) as string[],
        Icon: Landmark,
        run: () =>
          runNavigation("/debt", undefined, {
            id: `entity-debt-${debt.id}`,
            kind: "entity",
            route: "/debt",
            label: debt.name,
            description: `${debt.rate}% APR`,
            iconKey: "debt",
          }),
      }));

    const withdrawalItems: CommandPaletteItem[] = [...(data.withdrawals ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 120)
      .map((w) => ({
        id: `withdrawal-${w.id}`,
        label: `Payout ${w.firm} — ${w.date}`,
        description: `£${Number(w.gross).toLocaleString("en-GB", { maximumFractionDigits: 0 })} gross`,
        group: "Payouts",
        keywords: [w.firm, w.notes, w.accountId].filter(Boolean) as string[],
        Icon: ArrowDownToLine,
        run: () =>
          runNavigation(
            "/prop",
            buildViewIntentState(
              "/prop",
              {
                filters: { status: "all", sort: "balance" },
                scrollToWithdrawalId: w.id,
              },
              "command-palette"
            ),
            {
              id: `entity-payout-${w.id}`,
              kind: "entity",
              route: "/prop",
              label: `Payout ${w.firm}`,
              description: w.date,
              iconKey: "prop",
              state: {
                filters: { status: "all", sort: "balance" },
                scrollToWithdrawalId: w.id,
              },
            }
          ),
      }));

    const subscriptionItems: CommandPaletteItem[] = [...(data.subscriptions ?? [])]
      .filter((s) => !s.cancelled)
      .slice(0, 80)
      .map((s) => ({
        id: `subscription-${s.id}`,
        label: s.name,
        description: `Renews ${s.nextRenewal} · £${Number(s.amount).toLocaleString("en-GB")}`,
        group: "Subscriptions",
        keywords: [s.name, s.notes].filter(Boolean) as string[],
        Icon: Repeat,
        run: () =>
          runNavigation(
            "/investments",
            buildViewIntentState(
              "/investments",
              {
                search: s.name,
                filters: { performance: "all", sort: "value" },
              },
              "command-palette"
            ),
            {
              id: `entity-sub-${s.id}`,
              kind: "entity",
              route: "/investments",
              label: s.name,
              description: "Subscription",
              iconKey: "investments",
              state: {
                search: s.name,
                filters: { performance: "all", sort: "value" },
              },
            }
          ),
      }));

    return [
      ...tradeItems,
      ...expenseItems,
      ...ideaTopicItems,
      ...ideaNoteItems,
      ...accountItems,
      ...investmentItems,
      ...debtItems,
      ...withdrawalItems,
      ...subscriptionItems,
    ];
  }, [
    data.tradeJournal,
    data.expenses,
    data.genExpenses,
    data.ideaTopics,
    data.ideaNotes,
    data.accounts,
    data.investments,
    data.debts,
    data.withdrawals,
    data.subscriptions,
    recentCommandItems,
    runNavigation,
    savedViewItems,
  ]);

  /** Pathname only — `search` can change after navigation (view intents), which was retriggering enter animations. */
  const routeAnimKey = loc.pathname;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg-base">
      <TitleBar />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="hidden md:flex h-full flex-shrink-0">
          <Sidebar
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenWorkspaceDrawer={() => setWorkspaceOpen(true)}
          />
        </div>

        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div
            className="shell-content min-h-full"
            style={
              {
                "--shell-bottom-pad": navVisible
                  ? MOBILE_SHELL_PAD_VISIBLE
                  : MOBILE_SHELL_PAD_HIDDEN,
              } as CSSProperties
            }
          >
            <div className="shell-frame">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={routeAnimKey}
                  className="route-stage"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
                  }}
                  exit={{
                    opacity: 0,
                    transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
                  }}
                >
                  <Suspense key={routeAnimKey} fallback={<PageSwitchFallback />}>
                    <Outlet />
                  </Suspense>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
      </main>
      </div>

      <MobileNav
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onQuickAction={(action) => setQuickActionOpen(action)}
        onOpenWorkspaceDrawer={() => setWorkspaceOpen(true)}
        onOpenExportCenter={() => setExportCenterOpen(true)}
        navVisible={navVisible}
      />

      <WorkspaceDrawer
        open={workspaceOpen}
        onClose={() => setWorkspaceOpen(false)}
        currentView={currentView}
        savedViews={savedViews}
        recentEntries={recentEntries}
        syncLabel={syncLabel}
        onOpenSavedView={(view) => {
          runNavigation(
            view.route,
            buildViewIntentState(view.route, view.state, "saved-view"),
            {
              id: `recent-saved-${view.id}`,
              kind: "saved-view",
              route: view.route,
              label: view.name,
              description: view.routeLabel,
              iconKey: "saved-view",
              state: view.state,
            }
          );
          setWorkspaceOpen(false);
        }}
        onOpenRecentEntry={(entry) => {
          runNavigation(entry.route, entry.state, {
            id: entry.id,
            kind: entry.kind,
            route: entry.route,
            label: entry.label,
            description: entry.description,
            iconKey: entry.iconKey,
            state: entry.state,
          });
          setWorkspaceOpen(false);
        }}
        onOpenExportCenter={() => {
          setWorkspaceOpen(false);
          setExportCenterOpen(true);
        }}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={[...recentCommandItems, ...savedViewItems, ...commandItems]}
        dynamicItems={dynamicItems}
      />

      <Modal
        open={saveViewOpen}
        onClose={() => setSaveViewOpen(false)}
        title="Save Current View"
        size="sm"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-tx-3">This saves the current filters and context for quick recall later.</p>
            {currentView && (
              <div className="rounded-xl border border-border-subtle bg-bg-hover px-3 py-2 text-xs">
                <div className="font-semibold text-tx-1">{currentView.title}</div>
                {currentView.description && <div className="mt-1 text-tx-4">{currentView.description}</div>}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="saved-view-name" className="text-xs text-tx-3">View name</label>
            <input
              id="saved-view-name"
              className="nx-input"
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              placeholder="e.g. Funded accounts"
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm flex-1" onClick={() => setSaveViewOpen(false)}>Cancel</button>
            <button
              className="btn-primary btn-sm flex-1"
              disabled={!currentView || !saveViewName.trim()}
              onClick={() => {
                if (!currentView || !saveViewName.trim()) return;
                const pageMeta =
                  PAGE_METADATA[currentView.route as keyof typeof PAGE_METADATA] ??
                  PAGE_METADATA["/"];
                const savedView: SavedView = {
                  id: `${currentView.route}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  name: saveViewName.trim(),
                  route: currentView.route,
                  routeLabel: pageMeta.label,
                  description: currentView.description,
                  state: currentView.state,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };
                update((prev) => {
                  const existing = prev.userSettings?.savedViews ?? [];
                  const next = [savedView, ...existing.filter((view) => !(view.route === savedView.route && view.name === savedView.name))].slice(0, 20);
                  return {
                    ...prev,
                    userSettings: {
                      ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }),
                      savedViews: next,
                    },
                  };
                });
                pushRecent({
                  id: `saved-${savedView.id}`,
                  kind: "saved-view",
                  route: savedView.route,
                  label: savedView.name,
                  description: savedView.routeLabel,
                  iconKey: "saved-view",
                  state: savedView.state,
                });
                setSaveViewOpen(false);
              }}
            >
              Save View
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={manageViewsOpen}
        onClose={() => setManageViewsOpen(false)}
        title="Saved Views"
        size="md"
      >
        <div className="space-y-3">
          {savedViews.length === 0 ? (
            <div className="rounded-2xl border border-border-subtle bg-bg-hover px-4 py-8 text-center">
              <div className="text-sm font-semibold text-tx-1">No saved views yet</div>
              <div className="mt-1 text-xs text-tx-4">Save filters from Journal, Prop, Expenses, Investments, or Ideas to reuse them here.</div>
            </div>
          ) : (
            savedViews.map((view) => {
              const Icon =
                PAGE_METADATA[view.route as keyof typeof PAGE_METADATA]?.Icon ??
                BookmarkPlus;
              return (
                <div key={view.id} className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-hover px-3 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent-muted">
                    <Icon size={16} className="text-tx-2" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-tx-1">{view.name}</div>
                    <div className="mt-0.5 text-xs text-tx-4">{view.routeLabel}</div>
                  </div>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => {
                      runNavigation(
                        view.route,
                        buildViewIntentState(view.route, view.state, "saved-view"),
                        {
                          id: `recent-saved-${view.id}`,
                          kind: "saved-view",
                          route: view.route,
                          label: view.name,
                          description: view.routeLabel,
                          iconKey: "saved-view",
                          state: view.state,
                        }
                      );
                      setManageViewsOpen(false);
                    }}
                  >
                    Open
                  </button>
                  <button
                    className="btn-ghost btn-sm text-loss hover:text-loss"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        userSettings: {
                          ...(prev.userSettings ?? { subscriptionRenewalDays: 7 }),
                          savedViews: (prev.userSettings?.savedViews ?? []).filter((item) => item.id !== view.id),
                        },
                      }))
                    }
                  >
                    Delete
                  </button>
                </div>
              );
            })
          )}
        </div>
      </Modal>

      <QuickActionHost
        action={quickActionOpen}
        onClose={() => setQuickActionOpen(null)}
      />

      <ExportCenterModal
        open={exportCenterOpen}
        onClose={() => setExportCenterOpen(false)}
        data={data}
      />
    </div>
  );
}

export default function Layout() {
  return (
    <PageViewProvider>
      <LayoutBody />
    </PageViewProvider>
  );
}
