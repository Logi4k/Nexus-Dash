import { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
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
  Scale,
  Wallet,
} from "lucide-react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import CommandPalette, { type CommandPaletteItem } from "./CommandPalette";

const PAGE_ORDER = [
  "/",
  "/market",
  "/journal",
  "/prop",
  "/expenses",
  "/debt",
  "/investments",
  "/tax",
  "/ideas",
];

export default function Layout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
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
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Touch state refs for swipe navigation
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  function handleTouchStart(e: React.TouchEvent<HTMLElement>) {
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    touchStartTime.current = Date.now();
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLElement>) {
    const t = e.changedTouches[0];
    const deltaX = t.clientX - touchStartX.current;
    const deltaY = t.clientY - touchStartY.current;
    const elapsed = Date.now() - touchStartTime.current;

    // Must be more horizontal than vertical
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return;
    // Minimum swipe distance
    if (Math.abs(deltaX) <= 50) return;
    // Must be fast enough
    if (elapsed >= 400) return;

    const currentIndex = PAGE_ORDER.indexOf(loc.pathname);
    if (currentIndex === -1) return;

    if (deltaX < 0) {
      // Swipe left → next page
      const nextIndex = currentIndex + 1;
      if (nextIndex < PAGE_ORDER.length) {
        navigate(PAGE_ORDER[nextIndex]);
      }
    } else {
      // Swipe right → previous page
      const prevIndex = currentIndex - 1;
      if (prevIndex >= 0) {
        navigate(PAGE_ORDER[prevIndex]);
      }
    }
  }

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
        run: () => navigate("/ideas", { state: { action: "addNote" } }),
      },
      {
        id: "action-trade",
        label: "Log trade",
        description: "Open the new trade flow in Journal",
        group: "Quick Actions",
        keywords: ["journal", "trade"],
        Icon: NotebookPen,
        run: () => navigate("/journal", { state: { action: "addTrade" } }),
      },
      {
        id: "action-expense",
        label: "New expense",
        description: "Open the add expense flow",
        group: "Quick Actions",
        keywords: ["cost", "receipt"],
        Icon: Wallet,
        run: () => navigate("/expenses", { state: { action: "addExpense" } }),
      },
      {
        id: "action-account",
        label: "Add prop account",
        description: "Create a new prop account entry",
        group: "Quick Actions",
        keywords: ["funded", "challenge"],
        Icon: Briefcase,
        run: () => navigate("/prop", { state: { action: "addAccount" } }),
      },
      {
        id: "action-payout",
        label: "Log payout",
        description: "Open the payout form in Prop Accounts",
        group: "Quick Actions",
        keywords: ["withdrawal", "profit split"],
        Icon: HandCoins,
        run: () => navigate("/prop", { state: { action: "logPayout" } }),
      },
    ],
    [navigate]
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-base">
      <div className="hidden md:flex h-full flex-shrink-0">
        <Sidebar onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      </div>

      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto pt-[env(safe-area-inset-top)]"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          key={loc.pathname}
          className="page-enter min-h-full p-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] md:p-6 md:pb-12"
        >
          <Outlet />
        </div>
      </main>

      <MobileNav
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        navVisible={navVisible}
      />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commandItems}
      />
    </div>
  );
}
