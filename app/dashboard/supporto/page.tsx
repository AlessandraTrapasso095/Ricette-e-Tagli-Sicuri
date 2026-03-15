import { SupportTicketForm } from "@/components/forms/support-ticket-form";
import { UserSupportTicketsList } from "@/components/forms/user-support-tickets-list";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReaderAreaPageLayout } from "@/components/dashboard/reader-area-page-layout";
import { SUPPORT_ACCESS_REQUIRED_MESSAGE } from "@/config/support-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUserSupportTickets } from "@/server/support/support-service";
import { getUserSupportAccessStatus } from "@/server/support/support-access";
import { requireUser } from "@/server/auth/session";
import Link from "next/link";

export default async function DashboardSupportoPage() {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();

  const [profileResult, supportAccess] = await Promise.all([
    supabase.from("profiles").select("display_name, full_name, email").eq("id", user.id).maybeSingle(),
    getUserSupportAccessStatus(user.id),
  ]);

  const userName = profileResult.data?.display_name ?? profileResult.data?.full_name ?? "Lettore";
  const userEmail = profileResult.data?.email ?? user.email ?? "";

  if (!supportAccess.hasAccess) {
    return (
      <ReaderAreaPageLayout>
        <div className="space-y-4">
          <EmptyState title="Supporto non ancora disponibile" description={SUPPORT_ACCESS_REQUIRED_MESSAGE} />
          <Card className="p-4">
            <Link href="/dashboard/libri" className="text-sm font-semibold text-rose-700 hover:text-rose-800">
              Vai a I miei libri per sbloccare l&apos;accesso
            </Link>
          </Card>
        </div>
      </ReaderAreaPageLayout>
    );
  }

  const tickets = await getUserSupportTickets(user.id);

  return (
    <ReaderAreaPageLayout>
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50/70 p-4">
          <CardTitle className="text-base text-amber-900">Supporto tecnico Area Lettori</CardTitle>
          <CardDescription className="mt-2 text-sm text-amber-900/90">
            Usa questa sezione solo per richieste tecniche legate al sito, all&apos;accesso, ai bonus PDF, alla chat menu o al
            funzionamento della piattaforma. Non e&apos; il canale corretto per richieste personali, consulenze o domande generali
            non legate all&apos;uso del sito.
          </CardDescription>
        </Card>

        <SupportTicketForm
          userName={userName}
          userEmail={userEmail}
          books={supportAccess.unlockedBooks}
        />

        <Card>
          <CardTitle>Ticket inviati</CardTitle>
          <CardDescription>Stato richieste inviate dall&apos;Area Lettori.</CardDescription>
          <UserSupportTicketsList tickets={tickets} />
        </Card>
      </div>
    </ReaderAreaPageLayout>
  );
}
