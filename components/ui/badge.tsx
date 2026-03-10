import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "neutral";

const variantStyles: Record<BadgeVariant, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  neutral: "bg-rose-100 text-rose-700",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  );
}
