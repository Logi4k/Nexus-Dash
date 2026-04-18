import { type ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import AnimatedNumber from "./AnimatedNumber";

// ── Accent surfaces (shared by StatCard + StatCardShell) ─────────────────────

const ACCENT_VAR_MAP: Record<string, { bg: string; border: string }> = {
  "var(--accent)":        { bg: "color-mix(in srgb, var(--accent) 10%, transparent)", border: "color-mix(in srgb, var(--accent) 24%, transparent)" },
  "var(--color-teal)":    { bg: "var(--color-teal-bg)",    border: "var(--color-teal-border)"    },
  "var(--color-warn)":    { bg: "var(--color-warn-bg)",    border: "var(--color-warn-border)"    },
  "var(--color-loss)":    { bg: "var(--color-loss-bg)",    border: "var(--color-loss-border)"    },
  "var(--color-profit)":  { bg: "var(--color-profit-bg)",  border: "var(--color-profit-border)"  },
};

const COLOR_FALLBACK: Record<string, { bg: string; border: string }> = {
  "#22c55e": { bg: "var(--color-profit-bg)",   border: "var(--color-profit-border)"  },
  "#ef4444": { bg: "var(--color-loss-bg)",  border: "var(--color-loss-border)"  },
  "#f59e0b": { bg: "var(--color-warn-bg)", border: "var(--color-warn-border)" },
  "#9b8ec2": { bg: "rgba(155,142,194,0.05)",border: "rgba(155,142,194,0.16)"},
  "#6b9bbf": { bg: "rgba(91,139,191,0.05)", border: "rgba(91,139,191,0.16)" },
  "#c49060": { bg: "rgba(212,168,74,0.05)", border: "rgba(212,168,74,0.16)" },
  "#6aafaa": { bg: "rgba(106,175,170,0.05)",border: "rgba(106,175,170,0.16)"},
  "#7a80b4": { bg: "rgba(122,128,180,0.05)",border: "rgba(122,128,180,0.16)"},
};

function hexToRgbTriplet(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace("#", "");
  if (raw.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(raw)) return null;
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ];
}

export function getAccentStyles(accentColor: string) {
  const mapped = ACCENT_VAR_MAP[accentColor];
  if (mapped) return mapped;
  const fallback = COLOR_FALLBACK[accentColor];
  if (fallback) return fallback;
  const triplet = hexToRgbTriplet(accentColor);
  if (triplet) {
    const [r, g, b] = triplet;
    return {
      bg: `rgba(${r},${g},${b},0.06)`,
      border: `rgba(${r},${g},${b},0.18)`,
    };
  }
  return { bg: "rgba(var(--surface-rgb),0.06)", border: "rgba(var(--border-rgb),0.14)" };
}

function iconWrapperColor(accentColor: string) {
  if (accentColor.startsWith("var(")) return accentColor;
  return accentColor;
}

// ── Shell: same visual language as Prop summary tiles, arbitrary body ─────────

export type StatCardShellProps = {
  label: string;
  icon?: ReactNode;
  accentColor?: string;
  delay?: number;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  /** Right side of header row (e.g. pills) before the icon pill */
  trailing?: ReactNode;
  onClick?: () => void;
  compact?: boolean;
};

export function StatCardShell({
  label,
  icon,
  accentColor = "var(--accent)",
  delay,
  className,
  bodyClassName,
  children,
  trailing,
  onClick,
  compact,
}: StatCardShellProps) {
  const { bg, border } = getAccentStyles(accentColor);
  const pad = compact ? "p-3" : "p-4";
  const gap = compact ? "gap-2" : "gap-3";
  const labelCls = compact
    ? "text-[9px] font-bold uppercase tracking-[0.12em] text-tx-3"
    : "text-[10px] font-bold uppercase tracking-[0.14em] text-tx-3";

  const shellStyle = {
    ...(delay ? { animationDelay: `${delay}ms`, animationFillMode: "both" as const } : {}),
    background: `linear-gradient(135deg, ${bg} 0%, transparent 70%)`,
    borderColor: border,
  };

  const shellClass = cn(
    "card card-hover",
    onClick && "cursor-pointer transition-[transform,filter] duration-200 hover:brightness-[1.03] active:scale-[0.985]",
    className,
  );

  const header = (
    <div className="flex items-start justify-between gap-2">
      <span className={labelCls}>{label}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {trailing}
        {icon && (
          <div
            className={cn("rounded-lg shrink-0 [&_svg]:stroke-[currentColor]", compact ? "p-1" : "p-1.5")}
            style={{
              background: bg,
              color: iconWrapperColor(accentColor),
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  const body = (
    <div className={cn("flex flex-col min-w-0", gap, bodyClassName)}>{children}</div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(
          shellClass,
          "w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.35)]",
        )}
        style={shellStyle}
        onClick={onClick}
      >
        <div className={cn(pad, "flex flex-col relative overflow-hidden", gap)}>
          {header}
          {body}
        </div>
      </button>
    );
  }

  return (
    <div className={shellClass} style={shellStyle}>
      <div className={cn(pad, "flex flex-col relative overflow-hidden", gap)}>
        {header}
        {body}
      </div>
    </div>
  );
}

// ── Numeric stat tile (Prop Accounts reference) ──────────────────────────────

interface StatCardProps {
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
  renderValue?: ReactNode;
  onClick?: () => void;
  badge?: ReactNode;
  sparkData?: number[];
  compact?: boolean;
}

export default function StatCard({
  label, value, prefix = "£", suffix = "", decimals = 2, icon,
  change, changeSuffix = "%", large = false, subLabel,
  className, delay, accentColor = "var(--accent)",
  renderValue, onClick, badge, sparkData, compact,
}: StatCardProps) {
  const sparkId = label.replace(/\s+/g, "-").toLowerCase();
  const sparkStroke = accentColor.startsWith("var(") ? accentColor : accentColor;

  const valueBlock = (
    <>
      <div className={cn("stat-num", large ? "text-3xl" : compact ? "text-lg" : "text-xl")}>
        {renderValue ?? (
          <AnimatedNumber
            value={value}
            prefix={prefix}
            suffix={suffix}
            decimals={decimals}
          />
        )}
      </div>
      {subLabel && (
        <span className={cn("text-tx-3 leading-snug", compact ? "text-[10px]" : "text-xs")}>{subLabel}</span>
      )}
    </>
  );

  const changeBlock =
    change !== undefined ? (
      <div className="flex items-center gap-1.5">
        {change >= 0 ? (
          <TrendingUp size={11} className="text-profit" />
        ) : (
          <TrendingDown size={11} className="text-loss" />
        )}
        <span
          className={cn(
            "text-xs font-semibold",
            change >= 0 ? "text-profit" : "text-loss",
          )}
        >
          {change >= 0 ? "+" : ""}
          {Math.abs(change).toFixed(1)}
          {changeSuffix}
        </span>
      </div>
    ) : null;

  const badgeBlock = badge ? <div className="flex items-center gap-2 flex-wrap">{badge}</div> : null;

  const sparkBlock =
    sparkData && sparkData.length > 1
      ? (() => {
          const W = 200, H = 40;
          const min = Math.min(...sparkData);
          const max = Math.max(...sparkData);
          const range = max - min || 1;
          const pts = sparkData.map((v, i) => [
            (i / (sparkData.length - 1)) * W,
            H - 4 - ((v - min) / range) * (H - 8),
          ]);
          const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
          const area = `${line} L ${W} ${H} L 0 ${H} Z`;
          return (
            <div className="relative mt-1 h-10 w-full opacity-45">
              <svg width="100%" height="40" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block">
                <defs>
                  <linearGradient id={`stat-spark-${sparkId}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparkStroke} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={sparkStroke} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill={`url(#stat-spark-${sparkId})`} />
                <path d={line} fill="none" stroke={sparkStroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          );
        })()
      : null;

  return (
    <StatCardShell
      label={label}
      icon={icon}
      accentColor={accentColor}
      delay={delay}
      className={className}
      onClick={onClick}
      compact={compact}
    >
      <div className="flex flex-col gap-0.5">
        {valueBlock}
      </div>
      {changeBlock}
      {badgeBlock}
      {sparkBlock}
    </StatCardShell>
  );
}
