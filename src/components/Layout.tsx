import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Briefcase,
  HandCoins,
  Landmark,
  LayoutGrid,
  Lightbulb,
  LineChart,
  NotebookPen,
  PieChart,
  Plus,
  Receipt,
  Scale,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import CommandPalette, { type CommandPaletteItem } from "./CommandPalette";
import QuickActionHost from "./QuickActionHost";
import { useAppData } from "@/lib/store";
import { navigateToQuickAction, type QuickAction } from "@/lib/quickActions";

const MOBILE_SHELL_PAD_VISIBLE = "calc(env(safe-area-inset-bottom) + 5.5rem)";
const MOBILE_SHELL_PAD_HIDDEN = "calc(env(safe-area-inset-bottom) + 1.2rem)";

export default function Layout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { data } = useAppData();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState<QuickAction | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const lastScrollTop = useRef(0);
  const peakScrollTop = useRef(0);

  // Reset scroll position and nav visibility on route change
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
    lastScrollTop.current = 0;
    peakScrollTop.current = 0;
    setNavVisible(true);
    setQuickActionOpen(null);
  }, [loc.pathname]);

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
      }

      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }

      // Single-letter page navigation (only when not editing and no modifier keys)
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const isEditing =
        tag === "input" ||
        tag === "textarea" ||
        (e.target as HTMLElement).isContentEditable;
      if (isEditing || e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "d": navigate("/"); break;
        case "m": navigate("/market"); break;
        case "j": navigate("/journal"); break;
        case "p": navigate("/prop"); break;
        case "e": navigate("/expenses"); break;
        case "b": navigate("/debt"); break;
        case "i": navigate("/investments"); break;
        case "t": navigate("/tax"); break;
        case "n": navigate("/ideas"); break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commandItems = useMemo<CommandPaletteItem[]>(
    () => [
      {
        id: "nav-dashboard",
        label: "Dashboard",
        description: "Open your main overview",
        group: "Pages",
        keywords: ["home", "overview"],
        Icon: LayoutGrid,
        run: () => navigate("/"),
      },
      {
        id: "nav-market",
        label: "Market",
        description: "Open sessions and market tools",
        group: "Pages",
        keywords: ["sessions", "markets"],
        Icon: LineChart,
        run: () => navigate("/market"),
      },
      {
        id: "nav-journal",
        label: "Journal",
        description: "Open your trading journal",
        group: "Pages",
        keywords: ["trades", "log"],
        Icon: NotebookPen,
        run: () => navigate("/journal"),
      },
      {
        id: "nav-prop",
        label: "Prop Accounts",
        description: "Open your prop firm accounts",
        group: "Pages",
        keywords: ["funded", "challenge", "payout"],
        Icon: Briefcase,
        run: () => navigate("/prop"),
      },
      {
        id: "nav-expenses",
        label: "Expenses",
        description: "Open your expense tracker",
        group: "Pages",
        keywords: ["costs", "spending"],
        Icon: Wallet,
        run: () => navigate("/expenses"),
      },
      {
        id: "nav-debt",
        label: "Debt",
        description: "Open cards and repayments",
        group: "Pages",
        keywords: ["credit", "repayment"],
        Icon: Landmark,
        run: () => navigate("/debt"),
      },
      {
        id: "nav-tax",
        label: "Tax",
        description: "Open tax planning and records",
        group: "Pages",
        keywords: ["hmrc", "taxes"],
        Icon: Scale,
        run: () => navigate("/tax"),
      },
      {
        id: "nav-investments",
        label: "Investments",
        description: "Open your portfolio overview",
        group: "Pages",
        keywords: ["portfolio", "wealth"],
        Icon: PieChart,
        run: () => navigate("/investments"),
      },
      {
        id: "nav-ideas",
        label: "Ideas",
        description: "Open your research and notes workspace",
        group: "Pages",
        keywords: ["notes", "brainstorm", "research"],
        Icon: Lightbulb,
        run: () => navigate("/ideas"),
      },
      {
        id: "action-note",
        label: "New note",
        description: "Create a fresh page in Ideas",
        group: "Quick Actions",
        keywords: ["idea", "page", "brainstorm"],
        Icon: Plus,
        run: () => navigateToQuickAction(navigate, "/ideas", "addNote"),
      },
      {
        id: "action-trade",
        label: "Log trade",
        description: "Open the new trade flow in Journal",
        group: "Quick Actions",
        keywords: ["journal", "trade"],
        Icon: NotebookPen,
        run: () => navigateToQuickAction(navigate, "/journal", "addTrade"),
      },
      {
        id: "action-expense",
        label: "New expense",
        description: "Open the add expense flow",
        group: "Quick Actions",
        keywords: ["cost", "receipt"],
        Icon: Wallet,
        run: () => navigateToQuickAction(navigate, "/expenses", "addExpense"),
      },
      {
        id: "action-account",
        label: "Add prop account",
        description: "Create a new prop account entry",
        group: "Quick Actions",
        keywords: ["funded", "challenge"],
        Icon: Briefcase,
        run: () => navigateToQuickAction(navigate, "/prop", "addAccount"),
      },
      {
        id: "action-payout",
        label: "Log payout",
        description: "Open the payout form in Prop Accounts",
        group: "Quick Actions",
        keywords: ["withdrawal", "profit split"],
        Icon: HandCoins,
        run: () => navigateToQuickAction(navigate, "/prop", "logPayout"),
      },
    ],
    [navigate]
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
        run: () => navigate("/journal"),
      }));

    const expenseItems: CommandPaletteItem[] = [...(data.expenses ?? [])]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 100)
      .map((e) => {
        const amt =
          typeof e.amount === "string" ? parseFloat(e.amount) : e.amount;
        return {
          id: `expense-${e.id}`,
          label: e.description || `${e.cat} expense`,
          description: `${amt < 0 ? "-" : ""}£${Math.abs(amt).toLocaleString()} · ${e.date}`,
          group: "Expenses",
          keywords: [e.description, e.cat].filter(Boolean) as string[],
          Icon: Receipt,
          run: () => navigate("/expenses"),
        };
      });

    const ideaItems: CommandPaletteItem[] = (data.ideaTopics ?? []).map(
      (topic) => ({
        id: `idea-${topic.id}`,
        label: topic.name,
        group: "Ideas",
        keywords: [topic.name],
        Icon: Lightbulb,
        run: () => navigate("/ideas"),
      })
    );

    return [...tradeItems, ...expenseItems, ...ideaItems];
  }, [data, navigate]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      <div className="hidden md:flex h-full flex-shrink-0">
        <Sidebar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      </div>

      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]"
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={loc.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="shell-content min-h-full p-4 md:p-6"
            style={
              {
                "--shell-bottom-pad": navVisible
                  ? MOBILE_SHELL_PAD_VISIBLE
                  : MOBILE_SHELL_PAD_HIDDEN,
              } as CSSProperties
            }
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileNav
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onQuickAction={(action) => setQuickActionOpen(action)}
        navVisible={navVisible}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commandItems}
        dynamicItems={dynamicItems}
      />

      <QuickActionHost
        action={quickActionOpen}
        onClose={() => setQuickActionOpen(null)}
      />
    </div>
  );
}
