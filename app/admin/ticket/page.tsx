import { AdminSupportTicketsTable } from "@/components/forms/admin-support-tickets-table";
import { getAdminBooks } from "@/server/admin/admin-service";
import { getAdminSupportTickets } from "@/server/support/support-service";

export default async function AdminTicketPage() {
  const [tickets, books] = await Promise.all([getAdminSupportTickets(), getAdminBooks()]);

  return (
    <AdminSupportTicketsTable
      initialTickets={tickets}
      books={books.map((book) => ({
        id: book.id,
        slug: book.slug,
        title: book.title,
      }))}
    />
  );
}
