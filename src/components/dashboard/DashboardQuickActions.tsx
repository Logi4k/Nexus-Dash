import { ArrowDownToLine, PiggyBank, Receipt, Target, Zap } from "lucide-react";
import type { QuickAction } from "@/lib/quickActions";

type DashboardQuickActionsProps = {
  accentColor: string;
  lossColor: string;
  blueColor: string;
  profitColor: string;
  warnColor: string;
  onAction: (path: string, action?: QuickAction) => void;
};

export function DashboardQuickActions({
  accentColor,
  lossColor,
  blueColor,
  profitColor,
  warnColor,
  onAction,
}: DashboardQuickActionsProps) {
  const actions: Array<{
    label: string;
    path: string;
    color: string;
    icon: React.ReactNode;
    action?: QuickAction;
  }> = [
    { label: "Add Expense", path: "/expenses", color: lossColor, icon: <Receipt size={13} />, action: "addExpense" },
    { label: "Add Account", path: "/prop", color: blueColor, icon: <Target size={13} />, action: "addAccount" },
    { label: "Log Payout", path: "/prop", color: profitColor, icon: <ArrowDownToLine size={13} />, action: "logPayout" },
    { label: "View Tax", path: "/tax", color: warnColor, icon: <PiggyBank size={13} /> },
  ];

  return (
    <div
      className="card-secondary p-4 hidden md:block"
      style={{
        background: `linear-gradient(145deg, ${accentColor}12 0%, rgba(var(--surface-rgb),0.02) 48%, ${blueColor}10 100%)`,
        borderColor: "rgba(var(--border-rgb),0.12)",
        boxShadow: "inset 0 1px 0 rgba(var(--surface-rgb),0.06)",
      }}
    >
      <p className="text-[10px] text-tx-3 uppercase tracking-wider font-medium mb-3 flex items-center gap-1.5">
        <Zap size={10} style={{ color: accentColor }} />Quick Actions
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {actions.map(({ label, path, color, icon, action }) => (
          <button
            key={label}
            onClick={() => onAction(path, action)}
            className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-[10px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-[0.98]"
            style={{
              background: `linear-gradient(180deg, ${color}12 0%, ${color}08 100%)`,
              border: `1px solid ${color}24`,
              boxShadow: `inset 0 1px 0 ${color}18`,
              color,
            }}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
