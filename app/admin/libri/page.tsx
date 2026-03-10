import { AdminBookForm } from "@/components/forms/admin-book-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminBooks } from "@/server/admin/admin-service";

export default async function AdminLibriPage() {
  const books = await getAdminBooks();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <AdminBookForm />

      <Card>
        <CardTitle>Catalogo libri</CardTitle>
        <CardDescription>Stato attuale del catalogo e parametri challenge.</CardDescription>

        <div className="mt-4 space-y-3">
          {books.map((book) => (
            <div key={book.id} className="rounded-2xl border border-zinc-200 p-3 text-sm">
              <p className="font-semibold text-zinc-800">{book.title}</p>
              <p className="text-xs text-zinc-500">{book.slug}</p>
              <p className="mt-1 text-zinc-600">
                Tentativi: {book.challenge_max_attempts} • Cooldown: {book.challenge_cooldown_minutes} min • Stato:{" "}
                {book.is_active ? "Attivo" : "Disattivo"}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
