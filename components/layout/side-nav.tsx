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

export function SideNav({ items }: SideNavProps) {
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
    <nav className="flex flex-col gap-1">
      {normalizedItems.map((item) => {
        const isActive = activeHref === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors",
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
