import "server-only";

import { CHAT_ACCESS_REQUIRED_MESSAGE, CHAT_UNLOCK_BOOK_SLUGS } from "@/config/chat-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface UnlockedChatBook {
  slug: string;
  title: string;
}

interface UserChatAccessStatus {
  hasAccess: boolean;
  unlockedEligibleBooks: UnlockedChatBook[];
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

export async function getUserChatAccessStatus(userId: string): Promise<UserChatAccessStatus> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("user_books")
    .select("books!inner(slug,title)")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("books.slug", [...CHAT_UNLOCK_BOOK_SLUGS]);

  if (error) {
    throw error;
  }

  const unlockedEligibleBooks = ((data ?? []) as UserBookWithJoin[])
    .flatMap((row) => {
      if (!row.books) {
        return [];
      }

      const books = Array.isArray(row.books) ? row.books : [row.books];
      return books.map((book) => ({ slug: book.slug, title: book.title }));
    });

  return {
    hasAccess: unlockedEligibleBooks.length > 0,
    unlockedEligibleBooks,
  };
}

export async function ensureUserHasChatAccess(userId: string) {
  const status = await getUserChatAccessStatus(userId);
  if (!status.hasAccess) {
    throw new Error(CHAT_ACCESS_REQUIRED_MESSAGE);
  }

  return status;
}
