import Link from "next/link";

import { CHAT_ACCESS_REQUIRED_MESSAGE } from "@/config/chat-access";
import { DailyMenuDisplay } from "@/components/dashboard/daily-menu-display";
import { ReaderAreaPageLayout } from "@/components/dashboard/reader-area-page-layout";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSavedMenus } from "@/server/chat/menu-service";
import { getUserChatAccessStatus } from "@/server/chat/chat-access";
import { requireUser } from "@/server/auth/session";

export default async function DashboardMenuSalvatiPage() {
  const user = await requireUser("/login");
  const chatAccess = await getUserChatAccessStatus(user.id);

  if (!chatAccess.hasAccess) {
    return (
      <ReaderAreaPageLayout>
        <div className="space-y-4">
          <EmptyState title="Menu salvati non disponibili" description={CHAT_ACCESS_REQUIRED_MESSAGE} />
          <Card className="p-4">
            <Link href="/dashboard/libri" className="text-sm font-semibold text-rose-700 hover:text-rose-800">
              Sblocca un libro idoneo per attivare la chat e i menu salvati
            </Link>
          </Card>
        </div>
      </ReaderAreaPageLayout>
    );
  }

  const menus = await getSavedMenus(user.id);

  if (menus.length === 0) {
    return (
      <ReaderAreaPageLayout>
        <EmptyState
          title="Nessun menu salvato"
          description="Genera un menu in chat e salvalo per ritrovarlo in questa sezione."
        />
      </ReaderAreaPageLayout>
    );
  }

  return (
    <ReaderAreaPageLayout>
      <div className="grid gap-4">
        {menus.map((menu) => (
          <Card key={menu.id}>
            <CardTitle>{menu.title}</CardTitle>
            <CardDescription className="mt-1">
              Salvato il {new Date(menu.created_at).toLocaleString("it-IT")} • Età:{" "}
              {menu.menu_payload.childProfileSummary.ageMonths !== null
                ? `${menu.menu_payload.childProfileSummary.ageMonths} mesi`
                : "non specificata"}{" "}
              • Svezzamento: {menu.menu_payload.childProfileSummary.weaningType}
            </CardDescription>
            <DailyMenuDisplay menu={menu.menu_payload} className="mt-4" />
          </Card>
        ))}
      </div>
    </ReaderAreaPageLayout>
  );
}
