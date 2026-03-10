import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-rose-500 text-white shadow-sm hover:bg-rose-600 focus-visible:ring-rose-400 disabled:bg-rose-300",
  secondary:
    "bg-rose-100 text-rose-900 hover:bg-rose-200 focus-visible:ring-rose-300 disabled:bg-rose-50",
  ghost:
    "bg-transparent text-rose-900 hover:bg-rose-100 focus-visible:ring-rose-300",
  danger:
    "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-300 disabled:bg-red-300",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed",
          variantClasses[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
