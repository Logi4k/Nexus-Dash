import { useEffect, useMemo, useState } from "react";
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

export default function Layout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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

      <main className="flex-1 overflow-y-auto">
        <div
          key={loc.pathname}
          className="page-enter min-h-full p-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] md:p-6 md:pb-12"
        >
          <Outlet />
        </div>
      </main>

      <MobileNav onOpenCommandPalette={() => setCommandPaletteOpen(true)} />

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={commandItems}
      />
    </div>
  );
}
