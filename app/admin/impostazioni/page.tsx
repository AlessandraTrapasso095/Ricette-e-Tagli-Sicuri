import { AccountSettingsForm } from "@/components/forms/account-settings-form";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@/config/notification-preferences";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { AdminReaderSettingsForm } from "@/components/forms/admin-reader-settings-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/server/auth/session";
import { getReaderFacingName } from "@/server/settings/app-settings-service";

export default async function AdminImpostazioniPage() {
  const user = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const supabase = await createSupabaseServerClient();
  const [readerFacingName, settingsResult, profileResult] = await Promise.all([
    getReaderFacingName(),
    admin.from("app_settings").select("key, value, description, updated_at").order("key"),
    supabase
      .from("profiles")
      .select(
        "full_name, display_name, email, gender, receive_communications, receive_promotions, receive_personal_notifications, receive_ticket_updates",
      )
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const settings = settingsResult.data ?? [];
  const profile = profileResult.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Il tuo account admin</CardTitle>
        <CardDescription>Aggiorna nome utente, email, password e notifiche del tuo profilo amministratore.</CardDescription>
        <AccountSettingsForm
          initialFullName={profile?.full_name ?? ""}
          initialDisplayName={profile?.display_name ?? profile?.full_name ?? ""}
          initialEmail={profile?.email ?? user.email ?? ""}
          initialGender={profile?.gender === "maschio" || profile?.gender === "femmina" ? profile.gender : null}
          initialNotificationPreferences={{
            communications: profile?.receive_communications ?? DEFAULT_NOTIFICATION_PREFERENCES.communications,
            promotions: profile?.receive_promotions ?? DEFAULT_NOTIFICATION_PREFERENCES.promotions,
            personalNotifications:
              profile?.receive_personal_notifications ?? DEFAULT_NOTIFICATION_PREFERENCES.personalNotifications,
            ticketUpdates: profile?.receive_ticket_updates ?? DEFAULT_NOTIFICATION_PREFERENCES.ticketUpdates,
          }}
          profileEndpoint="/api/admin/account/profile"
          notificationEndpoint="/api/admin/account/notifications"
          emailRedirectPath="/admin/impostazioni"
        />
      </Card>

      <Card>
        <CardTitle>Impostazioni visibili ai lettori</CardTitle>
        <CardDescription>Aggiorna il nome mostrato ai lettori nell&apos;header del brand.</CardDescription>
        <AdminReaderSettingsForm initialReaderDisplayName={readerFacingName} />
      </Card>

      <Card>
        <CardTitle>Sessione admin</CardTitle>
        <CardDescription>Per uscire dal pannello amministratore usa il pulsante qui sotto.</CardDescription>
        <div className="mt-4">
          <LogoutButton />
        </div>
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
