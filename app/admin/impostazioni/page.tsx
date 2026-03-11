import { AdminBroadcastForm } from "@/components/forms/admin-broadcast-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function AdminImpostazioniPage() {
  const admin = createSupabaseAdminClient();
  const { data: settings } = await admin.from("app_settings").select("key, value, description, updated_at").order("key");

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Comunicazioni email</CardTitle>
        <CardDescription>
          Invia avvisi e novità a tutti gli utenti registrati (sconti, nuove uscite, aggiornamenti importanti).
        </CardDescription>
        <AdminBroadcastForm />
      </Card>

      <Card>
        <CardTitle>Impostazioni tecniche</CardTitle>
        <CardDescription>Configurazioni centralizzate dell&apos;app.</CardDescription>

        <div className="mt-4 space-y-3">
          {(settings ?? []).map((setting) => (
            <div key={setting.key} className="rounded-2xl border border-zinc-200 p-3 text-sm">
              <p className="font-semibold text-zinc-800">{setting.key}</p>
              <p className="text-xs text-zinc-500">{setting.description}</p>
              <pre className="mt-2 overflow-auto rounded-xl bg-zinc-50 p-2 text-xs text-zinc-700">
                {JSON.stringify(setting.value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
