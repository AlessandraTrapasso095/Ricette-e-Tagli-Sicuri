import type { ReactNode } from "react";

import { MobileDashboardNav } from "@/components/layout/mobile-dashboard-nav";
import { BackNavButton } from "@/components/ui/back-nav-button";

import { DashboardFooter } from "./dashboard-footer";
import { BrandLogo } from "./logo";

interface DashboardShellProps {
  children: ReactNode;
  rightTop?: ReactNode;
}

export function DashboardShell({ children, rightTop }: DashboardShellProps) {
  return (
    <div className="bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.14),_transparent_35%),radial-gradient(circle_at_top_left,_rgba(253,186,116,0.12),_transparent_32%)] sm:min-h-screen">
      <div className="flex h-dvh flex-col overflow-hidden sm:hidden">
        <header className="shrink-0 border-b border-rose-100 bg-white/95 shadow-sm backdrop-blur">
          <div className="mx-auto w-full max-w-7xl px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <BackNavButton
                  fallbackHref="/"
                  showOnlyWithInternalHistory
                  historyScopePrefix="/dashboard"
                  hiddenExactPathnames={["/dashboard"]}
                />
                <BrandLogo href="/dashboard" />
              </div>
              {rightTop ? (
                <div className="flex shrink-0 items-center justify-end [&_button]:rounded-full [&_button]:border-2 [&_button]:border-rose-400 [&_button]:bg-white [&_button]:px-5 [&_button]:py-2.5 [&_button]:text-lg [&_button]:font-bold [&_button]:text-rose-500 [&_button]:shadow-none hover:[&_button]:bg-rose-50">
                  {rightTop}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [webkit-overflow-scrolling:touch]">
          <div className="mx-auto w-full max-w-7xl px-4 py-5">
            <main className="space-y-8 pb-24">
              {children}
            </main>
          </div>
          <DashboardFooter />
        </div>

        <MobileDashboardNav />
      </div>

      <div className="mx-auto hidden w-full max-w-7xl px-4 py-5 sm:block sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-rose-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <BackNavButton
                fallbackHref="/"
                showOnlyWithInternalHistory
                historyScopePrefix="/dashboard"
                hiddenExactPathnames={["/dashboard"]}
              />
              <BrandLogo href="/dashboard" />
            </div>
            {rightTop ? <div className="flex items-center justify-end">{rightTop}</div> : null}
          </div>
        </header>
        <main className="mt-6 space-y-6">
          {children}
        </main>
      </div>
      <div className="hidden sm:block">
        <DashboardFooter />
      </div>
    </div>
  );
}
