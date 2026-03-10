import "server-only";

import { normalizeBookAnswer } from "@/lib/text/normalize-answer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface UserUnlockedBookRow {
  user_id: string;
  book_id: string;
  status: "active" | "revoked";
}

interface BookMiniRow {
  id: string;
  slug: string;
  title: string;
}

interface ChallengeDbRow {
  id: string;
  page_number: number;
  prompt_text: string;
  is_active: boolean;
  created_at: string;
  book_id: string;
}

export async function getAdminStats() {
  const admin = createSupabaseAdminClient();

  const [usersRes, booksRes, unlockRes, ticketsRes, attemptsRes] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("books").select("id", { count: "exact", head: true }),
    admin.from("user_books").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "inviato"),
    admin.from("access_attempt_logs").select("id", { count: "exact", head: true }).eq("result", "failed"),
  ]);

  return {
    users: usersRes.count ?? 0,
    books: booksRes.count ?? 0,
    unlockedBooks: unlockRes.count ?? 0,
    pendingTickets: ticketsRes.count ?? 0,
    failedAttempts: attemptsRes.count ?? 0,
  };
}

export async function getAdminBooks() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("books")
    .select("id, slug, title, description, cover_url, challenge_max_attempts, challenge_cooldown_minutes, is_active, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function upsertAdminBook(payload: {
  slug: string;
  title: string;
  description?: string;
  coverUrl?: string;
  challengeMaxAttempts: number;
  challengeCooldownMinutes: number;
  isActive: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("books")
    .upsert(
      {
        slug: payload.slug,
        title: payload.title,
        description: payload.description ?? null,
        cover_url: payload.coverUrl || null,
        challenge_max_attempts: payload.challengeMaxAttempts,
        challenge_cooldown_minutes: payload.challengeCooldownMinutes,
        is_active: payload.isActive,
      },
      { onConflict: "slug" },
    )
    .select("id, slug")
    .single();

  if (error || !data) {
    throw new Error("Non riesco a salvare il libro.");
  }

  return data;
}

export async function getAdminChallenges() {
  const admin = createSupabaseAdminClient();

  const { data: challengeRows, error } = await admin
    .from("book_access_challenges")
    .select("id, page_number, prompt_text, is_active, created_at, book_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  const rows = (challengeRows ?? []) as ChallengeDbRow[];
  if (rows.length === 0) {
    return [];
  }

  const uniqueBookIds = [...new Set(rows.map((row) => row.book_id))];
  const { data: books, error: booksError } = await admin
    .from("books")
    .select("id, slug, title")
    .in("id", uniqueBookIds);

  if (booksError) {
    throw booksError;
  }

  const booksById = new Map(((books ?? []) as BookMiniRow[]).map((book) => [book.id, book]));

  return rows
    .map((row) => {
      const book = booksById.get(row.book_id);
      if (!book) {
        return null;
      }

      return {
        id: row.id,
        page_number: row.page_number,
        prompt_text: row.prompt_text,
        is_active: row.is_active,
        created_at: row.created_at,
        books: book,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function createAdminChallenge(payload: {
  bookId: string;
  pageNumber: number;
  promptText: string;
  acceptedAnswer: string;
  isActive: boolean;
  adminUserId?: string;
}) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("book_access_challenges")
    .insert({
      book_id: payload.bookId,
      page_number: payload.pageNumber,
      prompt_text: payload.promptText,
      accepted_answer: payload.acceptedAnswer,
      accepted_answer_normalized: normalizeBookAnswer(payload.acceptedAnswer),
      is_active: payload.isActive,
      created_by: payload.adminUserId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Impossibile creare la challenge.");
  }

  return data;
}

export async function toggleChallengeStatus(challengeId: string, isActive: boolean) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("book_access_challenges").update({ is_active: isActive }).eq("id", challengeId);

  if (error) {
    throw new Error("Impossibile aggiornare lo stato challenge.");
  }
}

export async function getAdminUsersOverview() {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select("id, email, full_name, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  if (!data?.length) {
    return [];
  }

  const userIds = data.map((user) => user.id);

  const { data: unlockedRows } = await admin
    .from("user_books")
    .select("user_id, book_id, status")
    .in("user_id", userIds)
    .eq("status", "active");

  const { data: failed } = await admin
    .from("access_attempt_logs")
    .select("user_id, result")
    .in("user_id", userIds)
    .eq("result", "failed");

  const unlocked = (unlockedRows ?? []) as UserUnlockedBookRow[];
  const uniqueBookIds = [...new Set(unlocked.map((entry) => entry.book_id))];
  const { data: books } = uniqueBookIds.length
    ? await admin.from("books").select("id, slug, title").in("id", uniqueBookIds)
    : { data: [] as BookMiniRow[] };

  const booksById = new Map(((books ?? []) as BookMiniRow[]).map((book) => [book.id, book]));

  const unlockedCount = new Map<string, number>();
  const unlockedRowsByUser = new Map<string, { id: string; slug: string; title: string }[]>();

  unlocked.forEach((entry) => {
    unlockedCount.set(entry.user_id, (unlockedCount.get(entry.user_id) ?? 0) + 1);
    const book = booksById.get(entry.book_id);
    if (!book) {
      return;
    }

    const existing = unlockedRowsByUser.get(entry.user_id) ?? [];
    unlockedRowsByUser.set(entry.user_id, [...existing, book]);
  });

  const failedCount = new Map<string, number>();
  (failed ?? []).forEach((entry) => {
    failedCount.set(entry.user_id, (failedCount.get(entry.user_id) ?? 0) + 1);
  });

  return data.map((user) => ({
    ...user,
    unlockedBooks: unlockedCount.get(user.id) ?? 0,
    unlockedBookRows: unlockedRowsByUser.get(user.id) ?? [],
    failedAttempts: failedCount.get(user.id) ?? 0,
  }));
}
