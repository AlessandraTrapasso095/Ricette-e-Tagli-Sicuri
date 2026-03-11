import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminActiveUsersOverview } from "@/server/admin/admin-service";

export default async function AdminAccessiAttiviPage() {
  const users = await getAdminActiveUsersOverview();

  return (
    <Card>
      <CardTitle>Utenti attivi in questo momento</CardTitle>
      <CardDescription>
        Considerati attivi se hanno effettuato accesso negli ultimi 10 minuti e non sono sospesi.
      </CardDescription>

      <div className="mt-4 space-y-3">
        {users.length === 0 ? <p className="text-sm text-zinc-500">Nessun utente attivo al momento.</p> : null}

        {users.map((user) => (
          <div key={user.id} className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-3 text-sm">
            <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <div>
              <p className="font-semibold text-zinc-800">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-zinc-500">{user.email}</p>
              <p className="text-xs text-zinc-500">
                Ultimo accesso: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("it-IT") : "n/d"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
