import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminSupportTickets } from "@/server/support/support-service";

export default async function AdminSupportoPage() {
  const tickets = await getAdminSupportTickets();

  return (
    <Card>
      <CardTitle>Ticket supporto</CardTitle>
      <CardDescription>Monitoraggio richieste utenti.</CardDescription>

      <div className="mt-4 space-y-3">
        {tickets.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessun ticket disponibile.</p>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-zinc-200 p-3 text-sm">
              <p className="font-semibold text-zinc-800">{ticket.name} • {ticket.email}</p>
              <p className="text-xs text-zinc-500">
                {ticket.category} • {new Date(ticket.created_at).toLocaleString("it-IT")}
              </p>
              <p className="mt-1 text-zinc-700">{ticket.message}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-emerald-700">Stato: {ticket.status}</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
