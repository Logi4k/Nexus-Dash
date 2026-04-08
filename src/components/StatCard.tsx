import { type ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import AnimatedNumber from "./AnimatedNumber";

interface Props {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  icon?: ReactNode;
  change?: number;
  changeSuffix?: string;
  large?: boolean;
  subLabel?: string;
  className?: string;
  delay?: number;
  accentColor?: string;
}

// Maps accentColor prop values to their CSS variable counterparts.
// Each key maps to the bg/border CSS variable names defined in index.css.
const ACCENT_VAR_MAP: Record<string, { bg: string; border: string }> = {
  "var(--color-teal)":    { bg: "var(--color-teal-bg)",    border: "var(--color-teal-border)"    },
  "var(--color-warn)":    { bg: "var(--color-warn-bg)",    border: "var(--color-warn-border)"    },
  "var(--color-loss)":    { bg: "var(--color-loss-bg)",    border: "var(--color-loss-border)"    },
  "var(--color-profit)":  { bg: "var(--color-teal-bg)",    border: "var(--color-teal-border)"    },
};

// Fallback colors for plain hex strings
const COLOR_FALLBACK: Record<string, { bg: string; border: string }> = {
  "#22c55e": { bg: "rgba(34,197,94,0.05)",   border: "rgba(34,197,94,0.16)"  },
  "#ef4444": { bg: "rgba(239,68,68,0.05)",  border: "rgba(239,68,68,0.16)"  },
  "#f59e0b": { bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.16)" },
  "#9b8ec2": { bg: "rgba(155,142,194,0.05)",border: "rgba(155,142,194,0.16)"},
  "#6b9bbf": { bg: "rgba(91,139,191,0.05)", border: "rgba(91,139,191,0.16)" },
  "#c49060": { bg: "rgba(212,168,74,0.05)", border: "rgba(212,168,74,0.16)" },
  "#6aafaa": { bg: "rgba(106,175,170,0.05)",border: "rgba(106,175,170,0.16)"},
  "#7a80b4": { bg: "rgba(122,128,180,0.05)",border: "rgba(122,128,180,0.16)"},
};

function getAccentStyles(accentColor: string) {
  // Prefer CSS variable mapping (handles var(--color-*) correctly in both themes)
  const mapped = ACCENT_VAR_MAP[accentColor];
  if (mapped) return mapped;
  // Fallback to hex lookup
  const fallback = COLOR_FALLBACK[accentColor];
  if (fallback) return fallback;
  // Last resort: tiny transparent values
  return { bg: "rgba(0,0,0,0.05)", border: "rgba(0,0,0,0.12)" };
}

export default function StatCard({
  label, value, prefix = "£", suffix = "", decimals = 2, icon,
  change, changeSuffix = "%", large = false, subLabel,
  className, delay, accentColor = "#f1f5f9",
}: Props) {
  const { bg, border } = getAccentStyles(accentColor);

  return (
    <div
      className={cn("card card-hover animate-fade-up", className)}
      style={{
        ...(delay ? { animationDelay: `${delay}ms`, animationFillMode: "both" } : {}),
        background: `linear-gradient(135deg, ${bg} 0%, transparent 70%)`,
        borderColor: border,
      }}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-tx-3">
            {label}
          </span>
          {icon && (
            <div
              className="p-1.5 rounded-lg"
              style={{
                background: bg,
                color: accentColor.startsWith("var(") ? accentColor : accentColor,
              }}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="flex flex-col gap-0.5">
          <div className={cn("stat-num", large ? "text-3xl" : "text-xl")}>
            <AnimatedNumber
              value={value}
              prefix={prefix}
              suffix={suffix}
              decimals={decimals}
            />
          </div>
          {subLabel && (
            <span className="text-xs text-tx-3">{subLabel}</span>
          )}
        </div>

        {/* Change indicator */}
        {change !== undefined && (
          <div className="flex items-center gap-1.5">
            {change >= 0 ? (
              <TrendingUp size={11} className="text-profit" />
            ) : (
              <TrendingDown size={11} className="text-loss" />
            )}
            <span
              className={cn(
                "text-xs font-semibold",
                change >= 0 ? "text-profit" : "text-loss"
              )}
            >
              {change >= 0 ? "+" : ""}
              {Math.abs(change).toFixed(1)}
              {changeSuffix}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
