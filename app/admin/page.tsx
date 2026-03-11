import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminStats } from "@/server/admin/admin-service";

const OVERVIEW_LINKS = [
  {
    href: "/admin/utenti",
    key: "users",
    title: "Utenti registrati",
  },
  {
    href: "/admin/libri-sbloccati",
    key: "unlockedBooks",
    title: "Libri sbloccati",
  },
  {
    href: "/admin/accessi-attivi",
    key: "activeUsers",
    title: "Accessi attivi",
  },
  {
    href: "/admin/ticket",
    key: "pendingTickets",
    title: "Ticket in arrivo",
  },
  {
    href: "/admin/tentativi-falliti",
    key: "failedAttempts",
    title: "Tentativi falliti",
  },
] as const;

export default async function AdminPage() {
  const stats = await getAdminStats();

  const values: Record<(typeof OVERVIEW_LINKS)[number]["key"], number> = {
    users: stats.users,
    unlockedBooks: stats.unlockedBooks,
    activeUsers: stats.activeUsers,
    pendingTickets: stats.pendingTickets,
    failedAttempts: stats.failedAttempts,
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {OVERVIEW_LINKS.map((item) => (
        <Link key={item.key} href={item.href} className="block">
          <Card className="h-full transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-lg">
            <CardTitle className="text-2xl">{values[item.key]}</CardTitle>
            <CardDescription>{item.title}</CardDescription>
          </Card>
        </Link>
      ))}
    </div>
  );
}
