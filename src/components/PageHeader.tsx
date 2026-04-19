import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function PageHeader({ eyebrow, title, subtitle, icon, meta, actions, className }: Props) {
  return (
    <div className={cn("mb-5 flex flex-col gap-2.5 sm:gap-3 xl:mb-8 md:mb-7 md:flex-row md:items-start md:justify-between", className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <div
            className="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase"
            style={{ color: "var(--accent)", letterSpacing: "0.08em" }}
          >
            <span
              aria-hidden
              className="inline-block h-[2px] w-5 rounded-full"
              style={{ background: "var(--accent)" }}
            />
            {eyebrow}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-bg-elevated border border-border-subtle flex items-center justify-center text-accent">
              {icon}
            </div>
          )}
          <div>
            <h1 className="page-title">{title}</h1>
            {subtitle && <p className="text-tx-3 text-sm mt-0.5">{subtitle}</p>}
          </div>
          {meta}
        </div>
      </div>
      {actions && <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center md:justify-end">{actions}</div>}
    </div>
  );
}
