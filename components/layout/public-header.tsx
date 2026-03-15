import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasActiveAdminRole } from "@/server/auth/admin-guard";

import { BrandLogo } from "./logo";

export async function PublicHeader() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = user ? await hasActiveAdminRole(user.id, user.email) : false;
  const privateHomeHref = isAdmin ? "/admin" : "/dashboard";
  const privateHomeLabel = isAdmin ? "Admin" : "Dashboard";

  const navItems = user
    ? [
        { href: "/", label: "Home" },
        { href: "/faq", label: "FAQ" },
        { href: privateHomeHref, label: privateHomeLabel },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/faq", label: "FAQ" },
        { href: "/login", label: "Accedi" },
        { href: "/register", label: "Registrati" },
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-rose-100/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div className="-ml-2 sm:-ml-3 lg:-ml-4">
          <BrandLogo href={user ? privateHomeHref : "/"} />
        </div>
        <nav className="-mx-1 flex w-full gap-2 overflow-x-auto pb-1 md:mx-0 md:w-auto md:flex-wrap md:justify-end md:overflow-visible md:pb-0">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-rose-100 hover:text-rose-700 md:bg-transparent md:px-0 md:py-0"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
