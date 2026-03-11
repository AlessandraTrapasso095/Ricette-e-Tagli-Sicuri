import { AdminBooksManager } from "@/components/forms/admin-books-manager";
import { getAdminBooks, getAdminRecommendedBooks } from "@/server/admin/admin-service";

export default async function AdminLibriPage() {
  const [books, recommendedBooks] = await Promise.all([getAdminBooks(), getAdminRecommendedBooks()]);

  return <AdminBooksManager initialBooks={books} initialRecommendedBooks={recommendedBooks} />;
}
