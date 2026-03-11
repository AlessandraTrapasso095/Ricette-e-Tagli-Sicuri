"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface BookRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  is_active: boolean;
}

interface RecommendedBookRow {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  isActive: boolean;
}

interface AdminBooksManagerProps {
  initialBooks: BookRow[];
  initialRecommendedBooks: RecommendedBookRow[];
}

export function AdminBooksManager({ initialBooks, initialRecommendedBooks }: AdminBooksManagerProps) {
  const [books, setBooks] = useState(initialBooks);
  const [recommendedBooks, setRecommendedBooks] = useState(initialRecommendedBooks);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function saveBook(book: BookRow) {
    setStatusMessage(null);
    setLoading(`book-${book.id}`);

    try {
      const response = await fetch("/api/admin/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: book.id,
          title: book.title,
          subtitle: book.description ?? "",
          link: book.cover_url ?? "",
          isActive: book.is_active,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Salvataggio libro non riuscito.");
      }

      setStatusMessage("Libro aggiornato.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Salvataggio libro non riuscito.");
    } finally {
      setLoading(null);
    }
  }

  async function deleteBook(bookId: string) {
    const confirmed = window.confirm("Confermi l'eliminazione del libro? L'azione è definitiva.");
    if (!confirmed) {
      return;
    }

    setStatusMessage(null);
    setLoading(`delete-book-${bookId}`);

    try {
      const response = await fetch("/api/admin/books", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Eliminazione libro non riuscita.");
      }

      setBooks((prev) => prev.filter((book) => book.id !== bookId));
      setStatusMessage("Libro eliminato.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Eliminazione libro non riuscita.");
    } finally {
      setLoading(null);
    }
  }

  function updateBookField(bookId: string, field: keyof BookRow, value: string | boolean) {
    setBooks((prev) =>
      prev.map((book) => {
        if (book.id !== bookId) {
          return book;
        }

        return {
          ...book,
          [field]: value,
        };
      }),
    );
  }

  function updateRecommendedField(id: string, field: keyof RecommendedBookRow, value: string | boolean) {
    setRecommendedBooks((prev) =>
      prev.map((book) => {
        if (book.id !== id) {
          return book;
        }
        return {
          ...book,
          [field]: value,
        };
      }),
    );
  }

  function addRecommendedBook() {
    setRecommendedBooks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: "",
        subtitle: "Apri su Amazon",
        url: "",
        isActive: true,
      },
    ]);
  }

  function removeRecommendedBook(id: string) {
    setRecommendedBooks((prev) => prev.filter((row) => row.id !== id));
  }

  async function saveRecommendedBooks() {
    setStatusMessage(null);
    setLoading("recommended");

    try {
      const response = await fetch("/api/admin/recommended-books", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          books: recommendedBooks,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Salvataggio libri consigliati non riuscito.");
      }

      setRecommendedBooks((json.data ?? []) as RecommendedBookRow[]);
      setStatusMessage("Libri consigliati aggiornati.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Salvataggio libri consigliati non riuscito.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Libri area privata</CardTitle>
            <CardDescription>Modifica titolo/link, sospendi la visibilità in dashboard o elimina il libro.</CardDescription>
          </div>
        </div>

        {statusMessage ? <p className="mt-3 text-sm text-zinc-700">{statusMessage}</p> : null}

        <div className="mt-4 space-y-3">
          {books.map((book) => (
            <div key={book.id} className="rounded-2xl border border-zinc-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{book.slug}</p>
              <div className="mt-2 grid gap-2">
                <Input
                  value={book.title}
                  onChange={(event) => updateBookField(book.id, "title", event.target.value)}
                  placeholder="Titolo"
                />
                <Textarea
                  value={book.description ?? ""}
                  onChange={(event) => updateBookField(book.id, "description", event.target.value)}
                  placeholder="Sottotitolo"
                />
                <Input
                  value={book.cover_url ?? ""}
                  onChange={(event) => updateBookField(book.id, "cover_url", event.target.value)}
                  placeholder="Link"
                />
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={book.is_active}
                    onChange={(event) => updateBookField(book.id, "is_active", event.target.checked)}
                  />
                  Libro visibile in dashboard utente
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" disabled={loading === `book-${book.id}`} onClick={() => saveBook(book)}>
                  {loading === `book-${book.id}` ? "Salvo..." : "Salva modifiche"}
                </Button>
                <Button type="button" variant="danger" disabled={loading === `delete-book-${book.id}`} onClick={() => deleteBook(book.id)}>
                  {loading === `delete-book-${book.id}` ? "Elimino..." : "Elimina"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={addRecommendedBook}>
            + Nuovo suggerito
          </Button>
          <div>
            <CardTitle>Scopri anche gli altri libri</CardTitle>
            <CardDescription>Questi libri compaiono nella card dedicata in dashboard utente.</CardDescription>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {recommendedBooks.map((book) => (
            <div key={book.id} className="rounded-2xl border border-zinc-200 p-3">
              <div className="grid gap-2">
                <Input
                  value={book.title}
                  onChange={(event) => updateRecommendedField(book.id, "title", event.target.value)}
                  placeholder="Titolo"
                />
                <Input
                  value={book.subtitle}
                  onChange={(event) => updateRecommendedField(book.id, "subtitle", event.target.value)}
                  placeholder="Sottotitolo"
                />
                <Input
                  value={book.url}
                  onChange={(event) => updateRecommendedField(book.id, "url", event.target.value)}
                  placeholder="Link"
                />
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={book.isActive}
                    onChange={(event) => updateRecommendedField(book.id, "isActive", event.target.checked)}
                  />
                  Mostra in dashboard
                </label>
              </div>
              <Button type="button" variant="ghost" className="mt-2" onClick={() => removeRecommendedBook(book.id)}>
                Rimuovi riga
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" className="mt-4" disabled={loading === "recommended"} onClick={saveRecommendedBooks}>
          {loading === "recommended" ? "Salvo..." : "Salva libri consigliati"}
        </Button>
      </Card>
    </div>
  );
}
