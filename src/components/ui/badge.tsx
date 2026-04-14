import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default:   "bg-accent-muted text-accent-bright border-accent/20",
        funded:    "bg-profit-subtle text-profit border-profit/20",
        challenge: "bg-warn-subtle text-warn border-warn/20",
        breached:  "bg-loss-subtle text-loss border-loss/20",
        outline:   "border-[rgba(var(--border-rgb),0.12)] text-tx-2",
        ghost:     "border-transparent bg-[rgba(var(--surface-rgb),0.06)] text-tx-2",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
