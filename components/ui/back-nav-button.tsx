"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import { Button } from "./button";

interface BackNavButtonProps {
  fallbackHref: string;
  className?: string;
  label?: string;
}

export function BackNavButton({ fallbackHref, className, label = "Indietro" }: BackNavButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleClick}
      aria-label="Torna alla pagina precedente"
      className={cn("h-10 rounded-xl px-3 text-sm font-semibold", className)}
    >
      <span aria-hidden>←</span>
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
