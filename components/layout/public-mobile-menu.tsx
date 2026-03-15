"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface PublicMobileMenuProps {
  items: Array<{
    href: string;
    label: string;
  }>;
}

export function PublicMobileMenu({ items }: PublicMobileMenuProps) {
  const pathname = usePathname();
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const open = openPathname === pathname;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Chiudi menu" : "Apri menu"}
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-900 transition-colors hover:bg-rose-100 md:hidden"
        onClick={() => setOpenPathname(open ? null : pathname)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <div
        className={cn(
          "fixed inset-0 z-[70] bg-[rgb(255,250,248)] px-5 py-5 transition-opacity duration-200 md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!open}
      >
        <div className="mx-auto flex h-full w-full max-w-md flex-col">
          <div className="flex items-center justify-end">
            <button
              type="button"
              aria-label="Chiudi menu"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-900 transition-colors hover:bg-rose-100"
              onClick={() => setOpenPathname(null)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="mt-12 flex flex-1 flex-col items-center justify-start gap-4 rounded-[28px] bg-white px-4 py-6 text-center shadow-[0_24px_80px_rgba(128,0,32,0.08)] ring-1 ring-rose-100/90">
            {items.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "w-full rounded-2xl px-5 py-4 text-lg font-semibold transition-colors",
                    isActive
                      ? "bg-rose-100 text-rose-900"
                      : "bg-white text-zinc-700 ring-1 ring-rose-100 hover:bg-rose-50 hover:text-rose-800",
                  )}
                  onClick={() => setOpenPathname(null)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
}
