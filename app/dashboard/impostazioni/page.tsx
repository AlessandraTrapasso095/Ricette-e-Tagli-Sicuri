import { AccountSettingsForm } from "@/components/forms/account-settings-form";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";

export default async function DashboardImpostazioniPage() {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Impostazioni account</CardTitle>
        <CardDescription>Aggiorna nome utente, email, password e preferenze base del tuo profilo.</CardDescription>
        <AccountSettingsForm
          initialFullName={profile?.full_name ?? ""}
          initialDisplayName={profile?.display_name ?? profile?.full_name ?? ""}
          initialEmail={profile?.email ?? user.email ?? ""}
        />
      </Card>

      <Card>
        <CardTitle>Sessione</CardTitle>
        <CardDescription>Per uscire dal tuo account usa il pulsante qui sotto.</CardDescription>
        <div className="mt-4">
          <LogoutButton />
        </div>
      </Card>
    </div>
  );
}
