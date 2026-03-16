"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Bell, BookOpen, Settings2, Ticket, Users } from "lucide-react";

import { mobileAdminNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

const iconMap = {
  "/admin/utenti": Users,
  "/admin/libri-sbloccati": BookOpen,
  "/admin/accessi-attivi": Activity,
  "/admin/ticket": Ticket,
  "/admin/comunicazione-utenti": Bell,
  "/admin/impostazioni": Settings2,
} as const;

function normalizePath(path: string) {
  if (path === "/") {
    return path;
  }

  return path.replace(/\/+$/, "");
}

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileAdminNav() {
  const pathname = normalizePath(usePathname());
  const normalizedItems = mobileAdminNavigation.map((item) => ({
    ...item,
    normalizedHref: normalizePath(item.href),
  }));
  const activeHref =
    normalizedItems
      .filter((item) => pathMatches(pathname, item.normalizedHref))
      .sort((a, b) => b.normalizedHref.length - a.normalizedHref.length)[0]?.href ?? null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-rose-100 bg-white/96 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
      <div className="overflow-x-auto px-3 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-stretch gap-1">
          {normalizedItems.map((item) => {
            const isActive = activeHref === item.href;
            const Icon = iconMap[item.href as keyof typeof iconMap];
            const isLongLabel = item.label.length > 9;

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  width: isLongLabel ? "5.2rem" : "calc((100vw - 4.4rem) / 5)",
                  minWidth: isLongLabel ? "5.2rem" : "4rem",
                }}
                className={cn(
                  "flex shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-center text-[0.64rem] font-semibold transition-colors",
                  isActive
                    ? "bg-rose-100 text-rose-800"
                    : "bg-white text-zinc-500 hover:bg-rose-50 hover:text-rose-700",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2.2} />
                <span className="whitespace-normal leading-[1.05] [word-break:keep-all]">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
