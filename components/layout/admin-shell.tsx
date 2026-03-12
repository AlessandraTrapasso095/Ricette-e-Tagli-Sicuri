import type { ReactNode } from "react";
import Link from "next/link";

import { adminNavigation } from "@/config/navigation";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { BackNavButton } from "@/components/ui/back-nav-button";

import { BrandLogo } from "./logo";
import { SideNav } from "./side-nav";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
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
        <main className="flex-1 space-y-6">
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-2 lg:hidden">
            <div className="flex w-max items-center gap-2">
              <BackNavButton fallbackHref="/dashboard" className="h-8 rounded-xl px-3 text-xs" />
              <Link
                href="/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-900"
              >
                Vai alla dashboard
              </Link>
              <div className="[&_button]:rounded-xl [&_button]:px-3 [&_button]:py-2 [&_button]:text-xs">
                <LogoutButton />
              </div>
              {adminNavigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
