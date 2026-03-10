import { SupportTicketForm } from "@/components/forms/support-ticket-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBooksWithAccess } from "@/server/books/book-access-service";
import { getUserSupportTickets } from "@/server/support/support-service";
import { requireUser } from "@/server/auth/session";

export default async function DashboardSupportoPage() {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();

  const [profileResult, books, tickets] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    getBooksWithAccess(user.id),
    getUserSupportTickets(user.id),
  ]);

  const userName = profileResult.data?.full_name ?? "Lettore";
  const userEmail = profileResult.data?.email ?? user.email ?? "";

  return (
    <div className="space-y-6">
      <SupportTicketForm
        userName={userName}
        userEmail={userEmail}
        books={books.map((book) => ({ slug: book.slug, title: book.title }))}
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
