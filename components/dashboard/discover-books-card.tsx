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
    <Card className="space-y-4 border-0 bg-transparent p-0 shadow-none sm:border sm:border-rose-100 sm:bg-white sm:p-6 sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
      <CardTitle className="text-2xl">Scopri anche gli altri libri</CardTitle>

      <div className="space-y-3">
        {visibleBooks.map((book, index) => {
          const isHighlighted = expanded || index < HIGHLIGHTED_BOOKS_COUNT;

          return (
            <a
              key={book.id ?? `${book.title}-${book.url}`}
              href={book.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block rounded-3xl px-4 py-4 text-sm transition ${
                isHighlighted
                  ? "border border-rose-100 bg-rose-50/70 text-rose-900 hover:bg-rose-100"
                  : "border border-zinc-100 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <p className="font-semibold">{book.title}</p>
              <p className="mt-1 text-xs opacity-80">{book.subtitle ?? "Apri su Amazon"}</p>
            </a>
          );
        })}
      </div>

      {books.length > HIGHLIGHTED_BOOKS_COUNT ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full rounded-2xl py-3 font-bold sm:w-auto"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Riduci" : "Scoprili tutti"}
        </Button>
      ) : null}
    </Card>
  );
}
