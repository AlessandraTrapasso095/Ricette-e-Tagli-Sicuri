import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-rose-100 bg-white px-4 py-2.5 text-sm text-zinc-800 shadow-sm outline-none placeholder:text-zinc-400 focus:border-rose-300 focus:ring-2 focus:ring-rose-100",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
