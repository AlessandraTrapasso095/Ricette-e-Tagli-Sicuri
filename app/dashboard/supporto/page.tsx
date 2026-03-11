import { SupportTicketForm } from "@/components/forms/support-ticket-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SUPPORT_ACCESS_REQUIRED_MESSAGE } from "@/config/support-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserSupportTickets } from "@/server/support/support-service";
import { getUserSupportAccessStatus } from "@/server/support/support-access";
import { requireUser } from "@/server/auth/session";
import Link from "next/link";

export default async function DashboardSupportoPage() {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();

  const [profileResult, supportAccess] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    getUserSupportAccessStatus(user.id),
  ]);

  const userName = profileResult.data?.full_name ?? "Lettore";
  const userEmail = profileResult.data?.email ?? user.email ?? "";

  if (!supportAccess.hasAccess) {
    return (
      <div className="space-y-4">
        <EmptyState title="Supporto non ancora disponibile" description={SUPPORT_ACCESS_REQUIRED_MESSAGE} />
        <Card className="p-4">
          <Link href="/dashboard/libri" className="text-sm font-semibold text-rose-700 hover:text-rose-800">
            Vai a I miei libri per sbloccare l&apos;accesso
          </Link>
        </Card>
      </div>
    );
  }

  const tickets = await getUserSupportTickets(user.id);

  return (
    <div className="space-y-6">
      <SupportTicketForm
        userName={userName}
        userEmail={userEmail}
        books={supportAccess.unlockedBooks}
      />

      <Card>
        <CardTitle>Ticket inviati</CardTitle>
        <CardDescription>Stato richieste inviate dall&apos;Area Lettori.</CardDescription>
        <div className="mt-4 space-y-3">
          {tickets.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessun ticket inviato.</p>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="rounded-2xl border border-rose-100 p-3">
                <p className="text-sm font-semibold text-rose-900">{ticket.category}</p>
                <p className="text-xs text-zinc-500">{new Date(ticket.created_at).toLocaleString("it-IT")}</p>
                <p className="mt-1 text-sm text-zinc-700">{ticket.message}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-700">Stato: {ticket.status}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
