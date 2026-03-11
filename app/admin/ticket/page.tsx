import { AdminSupportTicketsTable } from "@/components/forms/admin-support-tickets-table";
import { getAdminSupportTickets } from "@/server/support/support-service";

export default async function AdminTicketPage() {
  const tickets = await getAdminSupportTickets();

  return <AdminSupportTicketsTable initialTickets={tickets} />;
}
