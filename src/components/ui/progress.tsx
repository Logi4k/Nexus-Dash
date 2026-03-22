"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorStyle?: React.CSSProperties;
    indicatorClassName?: string;
  }
>(({ className, value, indicatorStyle, indicatorClassName, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-1.5 w-full overflow-hidden rounded-full",
      "bg-white/[0.07]",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "h-full w-full flex-1 rounded-full transition-all duration-700 ease-out",
        indicatorClassName
      )}
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        background: "linear-gradient(90deg, #22c55e, #4ade80)",
        ...indicatorStyle,
      }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
