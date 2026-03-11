import type { ReactNode } from "react";
import Link from "next/link";

import { adminNavigation } from "@/config/navigation";

import { BrandLogo } from "./logo";
import { SideNav } from "./side-nav";

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <aside className="hidden w-72 shrink-0 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm lg:block">
          <BrandLogo href="/admin" />
          <p className="mt-4 text-sm text-zinc-500">Pannello admin</p>
          <Link
            href="/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-200"
          >
            Vai alla dashboard
          </Link>
          <div className="mt-5">
            <SideNav items={adminNavigation} />
          </div>
        </aside>
        <main className="flex-1 space-y-6">
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-2 lg:hidden">
            <div className="flex w-max items-center gap-2">
              <Link
                href="/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-900"
              >
                Vai alla dashboard
              </Link>
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
