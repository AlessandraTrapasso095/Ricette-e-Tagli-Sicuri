import { ReaderAreaPageLayout } from "@/components/dashboard/reader-area-page-layout";
import { BooksGrid } from "@/components/dashboard/books-grid";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getBooksWithAccess } from "@/server/books/book-access-service";
import { requireUser } from "@/server/auth/session";

export default async function DashboardLibriPage() {
  const user = await requireUser("/login");
  const books = await getBooksWithAccess(user.id);

  return (
    <ReaderAreaPageLayout>
      <div className="space-y-4">
        <Card>
          <CardTitle>I tuoi libri</CardTitle>
          <CardDescription>
            Seleziona il libro acquistato, completa la challenge e sblocca bonus e risorse dedicate.
          </CardDescription>
        </Card>
        <BooksGrid
          books={books.map((book) => ({
            id: book.id,
            slug: book.slug,
            title: book.title,
            description: book.description,
            unlocked: book.unlocked,
            unlockedAt: book.unlockedAt,
          }))}
        />
      </div>
    </ReaderAreaPageLayout>
  );
}
