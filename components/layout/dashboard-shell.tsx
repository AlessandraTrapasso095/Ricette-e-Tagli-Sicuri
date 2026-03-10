import type { ReactNode } from "react";
import Link from "next/link";

import { dashboardNavigation } from "@/config/navigation";

import { DashboardFooter } from "./dashboard-footer";
import { BrandLogo } from "./logo";
import { SideNav } from "./side-nav";

interface DashboardShellProps {
  children: ReactNode;
  rightTop?: ReactNode;
}

export function DashboardShell({ children, rightTop }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.16),_transparent_38%),radial-gradient(circle_at_top_left,_rgba(253,186,116,0.14),_transparent_35%)]">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-rose-100 bg-white p-5 shadow-sm lg:block">
          <BrandLogo href="/dashboard" />
          <p className="mt-4 text-sm text-zinc-500">Area lettori privata</p>
          <div className="mt-5">
            <SideNav items={dashboardNavigation} />
          </div>
        </aside>
        <main className="flex-1 space-y-6">
          <div className="overflow-x-auto rounded-2xl border border-rose-100 bg-white p-2 lg:hidden">
            <div className="flex w-max gap-2">
              {dashboardNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          {rightTop ? <div className="flex justify-end">{rightTop}</div> : null}
          {children}
        </main>
      </div>
      <DashboardFooter />
    </div>
  );
}
