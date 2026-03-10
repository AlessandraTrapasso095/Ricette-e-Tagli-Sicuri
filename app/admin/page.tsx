import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminStats } from "@/server/admin/admin-service";

export default async function AdminPage() {
  const stats = await getAdminStats();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card>
        <CardTitle className="text-2xl">{stats.users}</CardTitle>
        <CardDescription>Utenti registrati</CardDescription>
      </Card>
      <Card>
        <CardTitle className="text-2xl">{stats.books}</CardTitle>
        <CardDescription>Libri configurati</CardDescription>
      </Card>
      <Card>
        <CardTitle className="text-2xl">{stats.unlockedBooks}</CardTitle>
        <CardDescription>Accessi attivi</CardDescription>
      </Card>
      <Card>
        <CardTitle className="text-2xl">{stats.pendingTickets}</CardTitle>
        <CardDescription>Ticket in arrivo</CardDescription>
      </Card>
      <Card>
        <CardTitle className="text-2xl">{stats.failedAttempts}</CardTitle>
        <CardDescription>Tentativi falliti</CardDescription>
      </Card>
    </div>
  );
}
