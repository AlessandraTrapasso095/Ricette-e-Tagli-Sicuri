import { AdminBonusManager } from "@/components/forms/admin-bonus-manager";
import { getAdminBooks, getAdminBonusFiles } from "@/server/admin/admin-service";

export default async function AdminBonusPage() {
  const [books, bonus] = await Promise.all([getAdminBooks(), getAdminBonusFiles()]);

  return (
    <AdminBonusManager
      books={books.map((book) => ({
        id: book.id,
        slug: book.slug,
        title: book.title,
      }))}
      initialBonus={bonus}
    />
  );
}
