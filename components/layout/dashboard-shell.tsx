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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.16),_transparent_38%),radial-gradient(circle_at_top_left,_rgba(253,186,116,0.14),_transparent_35%)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-rose-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <BackNavButton
                fallbackHref="/"
                showOnlyWithInternalHistory
                historyScopePrefix="/dashboard"
                hiddenExactPathnames={["/dashboard"]}
              />
              <BrandLogo href="/dashboard" />
            </div>
            {rightTop ? <div className="flex w-full justify-end sm:w-auto">{rightTop}</div> : null}
          </div>
        </header>
        <main className="mt-6 space-y-6">
          {children}
        </main>
      </div>
      <DashboardFooter />
    </div>
  );
}
