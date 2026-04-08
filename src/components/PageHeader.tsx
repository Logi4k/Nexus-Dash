import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({ title, subtitle, icon, actions, className }: Props) {
  return (
    <div className={cn("flex items-start justify-between mb-6", className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-bg-elevated border border-[rgba(var(--border-rgb),0.08)] flex items-center justify-center text-accent">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-tx-1">{title}</h1>
          {subtitle && (
            <p className="text-tx-3 text-sm mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
