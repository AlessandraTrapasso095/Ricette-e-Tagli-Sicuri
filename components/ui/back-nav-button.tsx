"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import { Button } from "./button";

const PREVIOUS_PATHNAME_STORAGE_KEY = "rts-previous-pathname";

interface BackNavButtonProps {
  fallbackHref: string;
  className?: string;
  label?: string;
  showOnlyWithInternalHistory?: boolean;
  historyScopePrefix?: string;
  hiddenExactPathnames?: string[];
}

export function BackNavButton({
  fallbackHref,
  className,
  label = "Indietro",
  showOnlyWithInternalHistory = false,
  historyScopePrefix,
  hiddenExactPathnames = [],
}: BackNavButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!showOnlyWithInternalHistory || typeof window === "undefined") {
      return;
    }

    const previousPathname = window.sessionStorage.getItem(PREVIOUS_PATHNAME_STORAGE_KEY);
    const isHiddenExactPath = hiddenExactPathnames.includes(pathname);
    const isWithinScope = historyScopePrefix ? pathname.startsWith(historyScopePrefix) : true;
    const previousIsWithinScope = historyScopePrefix ? previousPathname?.startsWith(historyScopePrefix) : true;
    const canShow = Boolean(
      !isHiddenExactPath && isWithinScope && previousPathname && previousPathname !== pathname && previousIsWithinScope,
    );
    buttonRef.current?.classList.toggle("hidden", !canShow);
    window.sessionStorage.setItem(PREVIOUS_PATHNAME_STORAGE_KEY, pathname);
  }, [pathname, showOnlyWithInternalHistory, historyScopePrefix, hiddenExactPathnames]);

  const handleClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  };

  return (
    <Button
      ref={buttonRef}
      type="button"
      variant="ghost"
      onClick={handleClick}
      aria-label="Torna alla pagina precedente"
      className={cn("h-10 rounded-xl px-3 text-sm font-semibold", showOnlyWithInternalHistory && "hidden", className)}
    >
      <span aria-hidden>←</span>
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
