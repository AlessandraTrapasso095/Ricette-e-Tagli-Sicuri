import { AdminBroadcastPanel } from "@/components/forms/admin-broadcast-panel";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getBroadcastHistory } from "@/server/admin/broadcast-service";

export default async function AdminComunicazioneUtentiPage() {
  const history = await getBroadcastHistory();

  return (
    <Card>
      <CardTitle>Comunicazione Utenti</CardTitle>
      <CardDescription>
        Invia avvisi e novità a tutti gli utenti registrati (sconti, nuove uscite, aggiornamenti importanti).
      </CardDescription>
      <AdminBroadcastPanel initialHistory={history} />
    </Card>
  );
}
