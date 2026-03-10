import { LogoutButton } from "@/components/dashboard/logout-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";

export default async function DashboardImpostazioniPage() {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle();

  return (
    <Card>
      <CardTitle>Impostazioni account</CardTitle>
      <CardDescription>Gestione base del tuo profilo Area Lettori.</CardDescription>
      <div className="mt-4 space-y-2 text-sm text-zinc-700">
        <p>
          <span className="font-semibold">Nome:</span> {profile?.full_name ?? "Non impostato"}
        </p>
        <p>
          <span className="font-semibold">Email:</span> {profile?.email ?? user.email}
        </p>
      </div>
      <div className="mt-6">
        <LogoutButton />
      </div>
    </Card>
  );
}
