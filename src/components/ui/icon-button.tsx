import * as React from "react";
import { cn } from "@/lib/utils";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: "default" | "profit" | "loss" | "warn" | "accent";
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, label, tone = "default", type = "button", title, ...props }, ref) => {
    const toneClass =
      tone === "profit"
        ? "hover:text-profit hover:bg-profit/10"
        : tone === "loss"
          ? "hover:text-loss hover:bg-loss/10"
          : tone === "warn"
            ? "hover:text-warn hover:bg-warn/10"
            : tone === "accent"
              ? "text-accent hover:text-accent hover:bg-accent/10"
            : "hover:text-tx-1 hover:bg-[rgba(var(--surface-rgb),0.08)]";

    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={title ?? label}
        className={cn(
          "inline-flex items-center justify-center rounded-lg p-1.5 text-tx-3 transition-colors",
          toneClass,
          className,
        )}
        {...props}
      />
    );
  },
);

IconButton.displayName = "IconButton";
