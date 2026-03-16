import type { ReactNode } from "react";
import Link from "next/link";

import { adminNavigation } from "@/config/navigation";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { BackNavButton } from "@/components/ui/back-nav-button";

import { BrandLogo } from "./logo";
import { MobileAdminNav } from "./mobile-admin-nav";
import { SideNav } from "./side-nav";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-5 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-5 lg:block lg:max-h-[calc(100svh-2.5rem)] lg:overflow-y-auto">
          <BackNavButton fallbackHref="/dashboard" className="mb-2" />
          <BrandLogo href="/admin" />
          <p className="mt-4 text-sm text-zinc-500">Pannello admin</p>
          <div className="mt-4 space-y-2 [&_button]:w-full">
            <Link
              href="/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-200"
            >
              Vai alla dashboard
            </Link>
            <LogoutButton />
          </div>
          <div className="mt-5">
            <SideNav items={adminNavigation} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 space-y-4 pb-28 sm:space-y-6 sm:pb-0">
          <div className="rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm lg:hidden">
            <div className="flex flex-col gap-3">
              <BrandLogo href="/admin" />
              <div className="grid grid-cols-3 gap-2 [&>*]:min-w-0">
                <BackNavButton fallbackHref="/dashboard" className="h-9 rounded-2xl px-2 text-[11px]" />
                <Link
                  href="/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center rounded-2xl bg-rose-100 px-2 text-[11px] font-semibold text-rose-900"
                >
                  Dashboard
                </Link>
                <div className="[&_button]:h-9 [&_button]:w-full [&_button]:rounded-2xl [&_button]:px-2 [&_button]:text-[11px]">
                  <LogoutButton />
                </div>
              </div>
            </div>
          </div>
          {children}
        </main>
      </div>
      <MobileAdminNav />
    </div>
  );
}
