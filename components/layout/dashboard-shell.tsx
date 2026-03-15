import type { ReactNode } from "react";

import { BackNavButton } from "@/components/ui/back-nav-button";

import { DashboardFooter } from "./dashboard-footer";
import { BrandLogo } from "./logo";

interface DashboardShellProps {
  children: ReactNode;
  rightTop?: ReactNode;
}

export function DashboardShell({ children, rightTop }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.14),_transparent_35%),radial-gradient(circle_at_top_left,_rgba(253,186,116,0.12),_transparent_32%)]">
      <header className="sticky top-0 z-40 border-b border-rose-100 bg-white/95 shadow-sm backdrop-blur sm:hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-3">
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
              <div className="flex shrink-0 items-center justify-end [&_button]:rounded-full [&_button]:border [&_button]:border-rose-300 [&_button]:bg-white [&_button]:px-4 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-rose-700 [&_button]:shadow-none hover:[&_button]:bg-rose-50">
                {rightTop}
              </div>
            ) : null}
          </div>
        </div>
      </header>
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
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:hidden">
        <main className="space-y-8">
          {children}
        </main>
      </div>
      <DashboardFooter />
    </div>
  );
}
