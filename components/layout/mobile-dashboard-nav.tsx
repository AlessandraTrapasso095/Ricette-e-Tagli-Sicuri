"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Baby,
  BookOpen,
  CircleHelp,
  Gift,
  House,
  Settings2,
  UtensilsCrossed,
} from "lucide-react";

import { mobileDashboardNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

const iconMap = {
  "/dashboard": House,
  "/dashboard/chat-menu": UtensilsCrossed,
  "/dashboard/libri": BookOpen,
  "/dashboard/bonus": Gift,
  "/dashboard/profilo-bambino": Baby,
  "/dashboard/supporto": CircleHelp,
  "/dashboard/impostazioni": Settings2,
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

export function MobileDashboardNav() {
  const pathname = normalizePath(usePathname());
  const normalizedItems = mobileDashboardNavigation.map((item) => ({
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
        <div className="flex min-w-max items-stretch gap-2">
          {normalizedItems.map((item) => {
            const isActive = activeHref === item.href;
            const Icon = iconMap[item.href as keyof typeof iconMap];

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-[4.35rem] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 text-center text-[0.68rem] font-semibold transition-colors",
                  isActive
                    ? "bg-rose-100 text-rose-800"
                    : "bg-white text-zinc-500 hover:bg-rose-50 hover:text-rose-700",
                )}
              >
                <Icon className="h-[1.05rem] w-[1.05rem]" strokeWidth={2.2} />
                <span className="leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
