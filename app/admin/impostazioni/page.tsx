import { AdminReaderSettingsForm } from "@/components/forms/admin-reader-settings-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getReaderFacingName } from "@/server/settings/app-settings-service";

export default async function AdminImpostazioniPage() {
  const admin = createSupabaseAdminClient();
  const [readerFacingName, settingsResult] = await Promise.all([
    getReaderFacingName(),
    admin.from("app_settings").select("key, value, description, updated_at").order("key"),
  ]);

  const settings = settingsResult.data ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Impostazioni visibili ai lettori</CardTitle>
        <CardDescription>Aggiorna il nome mostrato ai lettori nell&apos;header del brand.</CardDescription>
        <AdminReaderSettingsForm initialReaderDisplayName={readerFacingName} />
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
