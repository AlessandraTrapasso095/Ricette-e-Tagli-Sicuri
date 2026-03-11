import { AdminUsersTable } from "@/components/forms/admin-users-table";
import { getAdminBooks, getAdminUsersOverview } from "@/server/admin/admin-service";

export default async function AdminUtentiPage() {
  const [users, books] = await Promise.all([getAdminUsersOverview(), getAdminBooks()]);

  return (
    <AdminUsersTable
      users={users}
      books={books.map((book) => ({
        id: book.id,
        slug: book.slug,
        title: book.title,
      }))}
    />
  );
}
