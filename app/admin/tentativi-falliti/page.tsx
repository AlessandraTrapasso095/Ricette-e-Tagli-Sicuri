import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminFailedAttemptsOverview } from "@/server/admin/admin-service";

export default async function AdminTentativiFallitiPage() {
  const rows = await getAdminFailedAttemptsOverview();

  return (
    <Card>
      <CardTitle>Tentativi falliti challenge</CardTitle>
      <CardDescription>
        Questa sezione serve a monitorare errori ripetuti, possibili abusi e problemi di accesso ai libri.
      </CardDescription>

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? <p className="text-sm text-zinc-500">Nessun tentativo fallito registrato.</p> : null}

        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-zinc-200 p-3 text-sm">
            <p className="font-semibold text-zinc-800">
              {row.userName} • {row.userEmail}
            </p>
            <p className="text-xs text-zinc-500">
              {row.bookTitle}
              {row.pageNumber ? ` • pagina ${row.pageNumber}` : ""} • {new Date(row.createdAt).toLocaleString("it-IT")}
            </p>
            <p className="mt-1 text-zinc-700">Input: {row.attemptInput ?? "(vuoto)"}</p>
            <p className="text-xs text-zinc-500">Motivo: {row.reason}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
