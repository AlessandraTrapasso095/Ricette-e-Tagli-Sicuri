import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getSavedMenus } from "@/server/chat/menu-service";
import { requireUser } from "@/server/auth/session";

export default async function DashboardMenuSalvatiPage() {
  const user = await requireUser("/login");
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
