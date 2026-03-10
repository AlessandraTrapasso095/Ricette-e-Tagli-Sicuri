import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-28 w-full rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm text-zinc-800 shadow-sm outline-none placeholder:text-zinc-400 focus:border-rose-300 focus:ring-2 focus:ring-rose-100",
          className,
        )}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";
