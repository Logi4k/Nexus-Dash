import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  colorize?: boolean;
}

export default function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  duration = 800,
  className,
  colorize = false,
}: Props) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number>();
  const startRef = useRef<number>();
  const fromRef = useRef(value);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const from = fromRef.current;
    const to = value;
    startRef.current = undefined;

    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = to;
      }
    };

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(display);

  const colorClass = colorize
    ? value > 0
      ? "text-profit"
      : value < 0
        ? "text-loss"
        : ""
    : "";

  return (
    <span className={cn("tabular-nums", colorClass, className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
