import "server-only";

import { SUPPORT_ACCESS_REQUIRED_MESSAGE } from "@/config/support-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface UnlockedSupportBook {
  slug: string;
  title: string;
}

interface UserSupportAccessStatus {
  hasAccess: boolean;
  unlockedBooks: UnlockedSupportBook[];
}

interface UserBookWithJoin {
  books:
    | {
        slug: string;
        title: string;
      }
    | {
        slug: string;
        title: string;
      }[]
    | null;
}

export async function getUserSupportAccessStatus(userId: string): Promise<UserSupportAccessStatus> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("user_books")
    .select("books!inner(slug,title)")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  const unlockedBooks = ((data ?? []) as UserBookWithJoin[])
    .flatMap((row) => {
      if (!row.books) {
        return [];
      }

      const books = Array.isArray(row.books) ? row.books : [row.books];
      return books.map((book) => ({ slug: book.slug, title: book.title }));
    })
    .filter((book, index, list) => list.findIndex((item) => item.slug === book.slug) === index);

  return {
    hasAccess: unlockedBooks.length > 0,
    unlockedBooks,
  };
}

export async function ensureUserHasSupportAccess(userId: string) {
  const status = await getUserSupportAccessStatus(userId);
  if (!status.hasAccess) {
    throw new Error(SUPPORT_ACCESS_REQUIRED_MESSAGE);
  }

  return status;
}
