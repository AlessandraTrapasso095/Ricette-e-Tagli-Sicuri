import Link from "next/link";

import { CHAT_ACCESS_REQUIRED_MESSAGE } from "@/config/chat-access";
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
      <div className="space-y-4">
        <EmptyState title="Menu salvati non disponibili" description={CHAT_ACCESS_REQUIRED_MESSAGE} />
        <Card className="p-4">
          <Link href="/dashboard/libri" className="text-sm font-semibold text-rose-700 hover:text-rose-800">
            Sblocca un libro idoneo per attivare la chat e i menu salvati
          </Link>
        </Card>
      </div>
    );
  }

  const menus = await getSavedMenus(user.id);

  if (menus.length === 0) {
    return (
      <EmptyState
        title="Nessun menu salvato"
        description="Genera un menu in chat e salvalo per ritrovarlo in questa sezione."
      />
    );
  }

  return (
    <div className="grid gap-4">
      {menus.map((menu) => (
        <Card key={menu.id}>
          <CardTitle>{menu.title}</CardTitle>
          <CardDescription>Salvato il {new Date(menu.created_at).toLocaleString("it-IT")}</CardDescription>
          <pre className="mt-4 max-h-80 overflow-auto rounded-2xl bg-zinc-50 p-4 text-xs text-zinc-700">
            {JSON.stringify(menu.menu_payload, null, 2)}
          </pre>
        </Card>
      ))}
    </div>
  );
}
