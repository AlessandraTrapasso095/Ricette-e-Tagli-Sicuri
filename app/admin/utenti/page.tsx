import { AdminUsersTable } from "@/components/forms/admin-users-table";
import { getAdminUsersOverview } from "@/server/admin/admin-service";

export default async function AdminUtentiPage() {
  const users = await getAdminUsersOverview();

  return <AdminUsersTable users={users} />;
}
