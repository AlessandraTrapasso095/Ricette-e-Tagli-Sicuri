import { AdminBroadcastForm } from "@/components/forms/admin-broadcast-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function AdminComunicazioneUtentiPage() {
  return (
    <Card>
      <CardTitle>Comunicazione Utenti</CardTitle>
      <CardDescription>
        Invia avvisi e novità a tutti gli utenti registrati (sconti, nuove uscite, aggiornamenti importanti).
      </CardDescription>
      <AdminBroadcastForm />
    </Card>
  );
}
