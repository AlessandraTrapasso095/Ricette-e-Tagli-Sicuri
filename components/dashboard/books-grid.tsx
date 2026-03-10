"use client";

import { useRouter } from "next/navigation";

import { BookUnlockCard } from "@/components/forms/book-unlock-card";

interface BooksGridProps {
  books: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    unlocked: boolean;
    unlockedAt: string | null;
  }[];
}

export function BooksGrid({ books }: BooksGridProps) {
  const router = useRouter();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {books.map((book) => (
        <BookUnlockCard key={book.id} book={book} onUnlocked={() => router.refresh()} />
      ))}
    </div>
  );
}
