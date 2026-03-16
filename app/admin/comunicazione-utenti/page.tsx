import { AdminBroadcastPanel } from "@/components/forms/admin-broadcast-panel";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getBroadcastHistory } from "@/server/admin/broadcast-service";

export default async function AdminComunicazioneUtentiPage() {
  const history = await getBroadcastHistory();

  return (
    <Card className="p-4 sm:p-6">
      <CardTitle className="text-lg sm:text-xl">Comunicazione Utenti</CardTitle>
      <CardDescription className="max-w-2xl leading-6 sm:text-sm">
        Invia avvisi e novità a tutti gli utenti registrati (sconti, nuove uscite, aggiornamenti importanti).
      </CardDescription>
      <AdminBroadcastPanel initialHistory={history} />
    </Card>
  );
}
