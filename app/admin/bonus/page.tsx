import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface BonusRow {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  is_active: boolean;
  book_id: string;
}

export default async function AdminBonusPage() {
  const admin = createSupabaseAdminClient();

  const { data: bonusFiles } = await admin
    .from("bonus_files")
    .select("id, title, description, storage_path, is_active, book_id")
    .order("created_at", { ascending: false });

  const bookIds = (bonusFiles ?? []).map((bonus) => bonus.book_id);
  const { data: books } = bookIds.length
    ? await admin.from("books").select("id, title, slug").in("id", bookIds)
    : { data: [] as { id: string; title: string; slug: string }[] };

  const booksById = new Map((books ?? []).map((book) => [book.id, book]));

  return (
    <Card>
      <CardTitle>Bonus PDF</CardTitle>
      <CardDescription>Verifica mapping file storage e libro associato.</CardDescription>

      <div className="mt-4 space-y-3">
        {((bonusFiles ?? []) as BonusRow[]).map((bonus) => {
          const book = booksById.get(bonus.book_id);

          return (
            <div key={bonus.id} className="rounded-2xl border border-zinc-200 p-3 text-sm">
              <p className="font-semibold text-zinc-800">{bonus.title}</p>
              <p className="text-xs text-zinc-500">{book?.title ?? "Libro non trovato"} • {bonus.storage_path}</p>
              <p className="mt-1 text-zinc-700">{bonus.description}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-emerald-700">{bonus.is_active ? "Attivo" : "Disattivo"}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
