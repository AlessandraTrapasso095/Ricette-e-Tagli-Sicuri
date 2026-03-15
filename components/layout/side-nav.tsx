"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface SideNavItem {
  href: string;
  label: string;
}

interface SideNavProps {
  items: SideNavItem[];
  mobileHorizontal?: boolean;
  className?: string;
}

function normalizePath(path: string) {
  if (path === "/") {
    return path;
  }

  return path.replace(/\/+$/, "");
}

function pathMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ items, mobileHorizontal = false, className }: SideNavProps) {
  const pathname = normalizePath(usePathname());
  const normalizedItems = items.map((item) => ({
    ...item,
    normalizedHref: normalizePath(item.href),
  }));

  const activeHref =
    normalizedItems
      .filter((item) => pathMatches(pathname, item.normalizedHref))
      .sort((a, b) => b.normalizedHref.length - a.normalizedHref.length)[0]?.href ?? null;

  return (
    <nav
      className={cn(
        "flex gap-1",
        mobileHorizontal
          ? "overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:pb-0"
          : "flex-col",
        className,
      )}
    >
      {normalizedItems.map((item) => {
        const isActive = activeHref === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              mobileHorizontal ? "shrink-0 lg:w-full" : "",
              isActive
                ? "bg-rose-100 text-rose-800"
                : "text-zinc-600 hover:bg-rose-50 hover:text-rose-700",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
