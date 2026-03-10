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

export function SideNav({ items }: SideNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

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
