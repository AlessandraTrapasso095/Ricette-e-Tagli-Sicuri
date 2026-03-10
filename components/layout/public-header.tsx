import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { BrandLogo } from "./logo";

export async function PublicHeader() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const navItems = user
    ? [
        { href: "/", label: "Home" },
        { href: "/faq", label: "FAQ" },
        { href: "/dashboard", label: "Dashboard" },
      ]
    : [
        { href: "/", label: "Home" },
        { href: "/faq", label: "FAQ" },
        { href: "/login", label: "Accedi" },
        { href: "/register", label: "Registrati" },
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-rose-100/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <BrandLogo href={user ? "/dashboard" : "/"} />
        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-zinc-700 transition-colors hover:text-rose-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
