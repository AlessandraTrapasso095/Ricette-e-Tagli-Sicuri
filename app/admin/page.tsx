import { AdminOverviewPanels } from "@/components/forms/admin-overview-panels";
import {
  getAdminActiveUsersOverview,
  getAdminBooks,
  getAdminFailedAttemptsOverview,
  getAdminStats,
  getAdminUnlockedBooksSummary,
  getAdminUsersOverview,
} from "@/server/admin/admin-service";
import { getAdminSupportTickets } from "@/server/support/support-service";

export default async function AdminPage() {
  const [stats, users, books, unlockedBooks, activeUsers, tickets, failedAttempts] = await Promise.all([
    getAdminStats(),
    getAdminUsersOverview(),
    getAdminBooks(),
    getAdminUnlockedBooksSummary(),
    getAdminActiveUsersOverview(),
    getAdminSupportTickets(),
    getAdminFailedAttemptsOverview(),
  ]);

  return (
    <AdminOverviewPanels
      stats={stats}
      users={users}
      books={books.map((book) => ({
        id: book.id,
        slug: book.slug,
        title: book.title,
      }))}
      unlockedBooks={unlockedBooks}
      activeUsers={activeUsers}
      tickets={tickets}
      failedAttempts={failedAttempts}
    />
  );
}
