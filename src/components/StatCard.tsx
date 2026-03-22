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

export default function StatCard({
  label, value, prefix = "£", suffix = "", decimals = 2, icon,
  change, changeSuffix = "%", large = false, subLabel,
  className, delay, accentColor = "#f1f5f9",
}: Props) {
  return (
    <div
      className={cn("card card-hover animate-fade-up", className)}
      style={{
        ...(delay ? { animationDelay: `${delay}ms`, animationFillMode: "both" } : {}),
        background: `linear-gradient(135deg, ${accentColor}0d 0%, transparent 70%)`,
        borderColor: `${accentColor}28`,
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
                background: `${accentColor}18`,
                color: accentColor,
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
