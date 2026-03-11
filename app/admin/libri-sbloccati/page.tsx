import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminUnlockedBooksSummary } from "@/server/admin/admin-service";

export default async function AdminLibriSbloccatiPage() {
  const rows = await getAdminUnlockedBooksSummary();

  return (
    <Card>
      <CardTitle>Libri sbloccati dagli utenti</CardTitle>
      <CardDescription>Per ogni libro vedi quante persone lo hanno sbloccato.</CardDescription>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-zinc-200 p-3 text-sm">
            <p className="font-semibold text-zinc-800">{row.title}</p>
            <p className="text-xs text-zinc-500">{row.slug}</p>
            <p className="mt-1 text-zinc-700">Sblocchi totali: {row.unlockedUsers}</p>
            <p className={`mt-1 text-xs font-semibold ${row.isActive ? "text-emerald-700" : "text-zinc-500"}`}>
              {row.isActive ? "Visibile in dashboard utente" : "Sospeso in dashboard utente"}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}
