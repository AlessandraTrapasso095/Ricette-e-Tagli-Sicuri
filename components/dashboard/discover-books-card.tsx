"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import type { RecommendedBook } from "@/config/recommended-books";

interface DiscoverBooksCardProps {
  books: RecommendedBook[];
}

const HIGHLIGHTED_BOOKS_COUNT = 4;

export function DiscoverBooksCard({ books }: DiscoverBooksCardProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleBooks = expanded ? books : books.slice(0, HIGHLIGHTED_BOOKS_COUNT);

  return (
    <Card>
      <CardTitle>Scopri anche gli altri libri</CardTitle>

      <div className="mt-4 space-y-2">
        {visibleBooks.map((book, index) => {
          const isHighlighted = expanded || index < HIGHLIGHTED_BOOKS_COUNT;

          return (
            <a
              key={book.id ?? `${book.title}-${book.url}`}
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block rounded-2xl px-3 py-2 text-sm transition ${
                isHighlighted
                  ? "border border-rose-100 bg-rose-50 text-rose-900 hover:bg-rose-100"
                  : "border border-zinc-100 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <p className="font-semibold">{book.title}</p>
              <p className="text-xs opacity-80">{book.subtitle ?? "Apri su Amazon"}</p>
            </a>
          );
        })}
      </div>

      {books.length > HIGHLIGHTED_BOOKS_COUNT ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full sm:w-auto"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Riduci" : "Scoprili tutti"}
        </Button>
      ) : null}
    </Card>
  );
}
