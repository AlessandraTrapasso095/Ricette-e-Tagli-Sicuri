import { AdminChallengeForm } from "@/components/forms/admin-challenge-form";
import { AdminChallengesTable } from "@/components/forms/admin-challenges-table";
import { getAdminBooks, getAdminChallenges } from "@/server/admin/admin-service";

export default async function AdminChallengePage() {
  const [books, challenges] = await Promise.all([getAdminBooks(), getAdminChallenges()]);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <AdminChallengeForm books={books.map((book) => ({ id: book.id, title: book.title }))} />
      <AdminChallengesTable initialChallenges={challenges} />
    </div>
  );
}
