import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface BonusFileRow {
  id: string;
  title: string;
  description: string | null;
  storage_bucket: string;
  storage_path: string;
  book_id: string;
}

interface BookRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
}

export async function getAvailableBonusFiles(userId: string) {
  const admin = createSupabaseAdminClient();

  const { data: userBooks, error: userBooksError } = await admin
    .from("user_books")
    .select("book_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (userBooksError) {
    throw userBooksError;
  }

  const bookIds = (userBooks ?? []).map((row) => row.book_id);
  if (bookIds.length === 0) {
    return [];
  }

  const { data: bonusRows, error: bonusError } = await admin
    .from("bonus_files")
    .select("id, title, description, storage_bucket, storage_path, book_id")
    .eq("is_active", true)
    .in("book_id", bookIds);

  if (bonusError) {
    throw bonusError;
  }

  const { data: books, error: booksError } = await admin
    .from("books")
    .select("id, slug, title, description")
    .in("id", bookIds);

  if (booksError) {
    throw booksError;
  }

  const booksById = new Map(((books ?? []) as BookRow[]).map((book) => [book.id, book]));

  return ((bonusRows ?? []) as BonusFileRow[])
    .map((row) => {
      const book = booksById.get(row.book_id);
      if (!book) {
        return null;
      }

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        book,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function generateBonusDownloadUrl(params: {
  userId: string;
  bonusId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  const admin = createSupabaseAdminClient();

  const { data: bonus, error } = await admin
    .from("bonus_files")
    .select("id, storage_bucket, storage_path, book_id")
    .eq("id", params.bonusId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !bonus) {
    throw new Error("Bonus non trovato.");
  }

  const { data: userBook } = await admin
    .from("user_books")
    .select("id")
    .eq("user_id", params.userId)
    .eq("book_id", bonus.book_id)
    .eq("status", "active")
    .maybeSingle();

  if (!userBook) {
    throw new Error("Non sei autorizzato a scaricare questo bonus.");
  }

  const { data: signed, error: signedError } = await admin.storage
    .from(bonus.storage_bucket)
    .createSignedUrl(bonus.storage_path, 60);

  if (signedError || !signed?.signedUrl) {
    throw new Error("Impossibile generare il link di download.");
  }

  await admin.from("bonus_download_logs").insert({
    user_id: params.userId,
    bonus_file_id: bonus.id,
    ip_address: params.ipAddress ?? null,
    user_agent: params.userAgent ?? null,
  });

  return signed.signedUrl;
}
