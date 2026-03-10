import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeBookAnswer } from "@/lib/text/normalize-answer";
import { formatRelativeMinutes } from "@/lib/utils";
import {
  buildCooldownUntil,
  countConsecutiveFailures,
  getActiveCooldown,
  isCorrectAnswer,
  type UnlockAttemptLog,
} from "@/server/books/unlock-engine";
import { ensureUserProfileExists } from "@/server/auth/profile-service";

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export interface BookUnlockChallengeResponse {
  challengeId: string;
  promptText: string;
  pageNumber: number;
  maxAttempts: number;
  cooldownMinutes: number;
}

export type AttemptUnlockResponse =
  | { status: "success"; message: string }
  | { status: "failed"; message: string; attemptsLeft: number }
  | { status: "cooldown"; message: string; cooldownUntil: string; minutesLeft: number }
  | { status: "error"; message: string };

interface UserUnlockedBookRow {
  status: "active" | "revoked";
  unlocked_at: string;
  book_id: string;
}

interface BookRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  challenge_max_attempts: number;
  challenge_cooldown_minutes: number;
  is_active: boolean;
}

async function getBookBySlug(slug: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("books")
    .select("id, slug, title, challenge_max_attempts, challenge_cooldown_minutes, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getBooksWithAccess(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data: books, error } = await admin
    .from("books")
    .select("id, slug, title, description, cover_url, challenge_max_attempts, challenge_cooldown_minutes, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const { data: unlockedRows, error: unlockedError } = await admin
    .from("user_books")
    .select("book_id, status, unlocked_at")
    .eq("user_id", userId);

  if (unlockedError) {
    throw unlockedError;
  }

  const unlockedByBookId = new Map(
    (unlockedRows ?? []).map((row) => [row.book_id, { status: row.status, unlockedAt: row.unlocked_at }]),
  );

  return (books ?? []).map((book) => {
    const unlocked = unlockedByBookId.get(book.id);

    return {
      ...book,
      unlocked: unlocked?.status === "active",
      unlockedAt: unlocked?.unlockedAt ?? null,
      accessStatus: unlocked?.status ?? null,
    };
  });
}

export async function getUserUnlockedBooks(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data: userBookRows, error } = await admin
    .from("user_books")
    .select("status, unlocked_at, book_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  const rows = (userBookRows ?? []) as UserUnlockedBookRow[];
  if (rows.length === 0) {
    return [];
  }

  const bookIds = rows.map((row) => row.book_id);
  const { data: books, error: booksError } = await admin
    .from("books")
    .select("id, slug, title, description, cover_url, challenge_max_attempts, challenge_cooldown_minutes, is_active")
    .in("id", bookIds);

  if (booksError) {
    throw booksError;
  }

  const booksById = new Map(((books ?? []) as BookRow[]).map((book) => [book.id, book]));

  return rows
    .map((row) => {
      const book = booksById.get(row.book_id);
      if (!book) {
        return null;
      }

      return {
        ...book,
        unlocked_at: row.unlocked_at,
        status: row.status,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function getRandomChallengeForBook(userId: string, bookSlug: string): Promise<BookUnlockChallengeResponse> {
  const admin = createSupabaseAdminClient();
  const book = await getBookBySlug(bookSlug);

  if (!book) {
    throw new Error("Libro non trovato.");
  }

  const { data: unlocked } = await admin
    .from("user_books")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", book.id)
    .eq("status", "active")
    .maybeSingle();

  if (unlocked) {
    throw new Error("Hai già sbloccato questo libro.");
  }

  const { data: logs, error: logsError } = await admin
    .from("access_attempt_logs")
    .select("result, created_at, cooldown_until")
    .eq("user_id", userId)
    .eq("book_id", book.id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (logsError) {
    throw logsError;
  }

  const cooldown = getActiveCooldown((logs ?? []) as UnlockAttemptLog[]);
  if (cooldown) {
    throw new Error(`Troppi tentativi. Riprova tra ${formatRelativeMinutes(cooldown.minutesLeft)}.`);
  }

  const { data: challenges, error: challengeError } = await admin
    .from("book_access_challenges")
    .select("id, prompt_text, page_number")
    .eq("book_id", book.id)
    .eq("is_active", true);

  if (challengeError) {
    throw challengeError;
  }

  if (!challenges || challenges.length === 0) {
    throw new Error("Challenge non disponibile per questo libro.");
  }

  const randomIndex = Math.floor(Math.random() * challenges.length);
  const challenge = challenges[randomIndex];

  return {
    challengeId: challenge.id,
    promptText: challenge.prompt_text,
    pageNumber: challenge.page_number,
    maxAttempts: book.challenge_max_attempts,
    cooldownMinutes: book.challenge_cooldown_minutes,
  };
}

export async function attemptBookUnlock(params: {
  userId: string;
  bookSlug: string;
  challengeId: string;
  answer: string;
  meta?: RequestMeta;
}): Promise<AttemptUnlockResponse> {
  const admin = createSupabaseAdminClient();
  const { userId, bookSlug, challengeId, answer, meta } = params;

  try {
    await ensureUserProfileExists(userId);
  } catch (error) {
    console.error("Errore creazione profilo utente prima dello sblocco", { userId, error });
    return { status: "error", message: "Errore profilo utente. Riprova tra poco." };
  }

  const book = await getBookBySlug(bookSlug);
  if (!book) {
    return { status: "error", message: "Libro non disponibile." };
  }

  const { data: existingAccess } = await admin
    .from("user_books")
    .select("id")
    .eq("user_id", userId)
    .eq("book_id", book.id)
    .eq("status", "active")
    .maybeSingle();

  if (existingAccess) {
    return { status: "success", message: "Libro già sbloccato." };
  }

  const { data: challenge, error: challengeError } = await admin
    .from("book_access_challenges")
    .select("id, accepted_answer_normalized, is_active")
    .eq("id", challengeId)
    .eq("book_id", book.id)
    .maybeSingle();

  if (challengeError || !challenge || !challenge.is_active) {
    return { status: "error", message: "Challenge non valida o scaduta. Richiedi una nuova challenge." };
  }

  const { data: recentLogs, error: logError } = await admin
    .from("access_attempt_logs")
    .select("result, created_at, cooldown_until")
    .eq("user_id", userId)
    .eq("book_id", book.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (logError) {
    return { status: "error", message: "Errore temporaneo. Riprova tra poco." };
  }

  const parsedLogs = (recentLogs ?? []) as UnlockAttemptLog[];
  const cooldown = getActiveCooldown(parsedLogs);
  if (cooldown) {
    return {
      status: "cooldown",
      message: `Troppi tentativi. Riprova tra ${formatRelativeMinutes(cooldown.minutesLeft)}.`,
      cooldownUntil: cooldown.cooldownUntil.toISOString(),
      minutesLeft: cooldown.minutesLeft,
    };
  }

  const normalizedInput = normalizeBookAnswer(answer);
  const isValid = isCorrectAnswer(answer, challenge.accepted_answer_normalized);

  if (isValid) {
    const upsertPayload = {
      user_id: userId,
      book_id: book.id,
      challenge_id: challenge.id,
      status: "active",
      unlocked_at: new Date().toISOString(),
      revoked_at: null,
      revoked_by: null,
    };

    const { error: upsertError } = await admin.from("user_books").upsert(upsertPayload, { onConflict: "user_id,book_id" });
    if (upsertError) {
      console.error("Errore salvataggio sblocco libro", {
        userId,
        bookSlug: book.slug,
        challengeId,
        error: upsertError.message,
      });
      return {
        status: "error",
        message: "Impossibile salvare lo sblocco del libro. Riprova tra poco.",
      };
    }

    const { error: successLogError } = await admin.from("access_attempt_logs").insert({
      user_id: userId,
      book_id: book.id,
      challenge_id: challenge.id,
      attempt_input: answer,
      attempt_input_normalized: normalizedInput,
      result: "success",
      ip_address: meta?.ipAddress ?? null,
      user_agent: meta?.userAgent ?? null,
    });

    if (successLogError) {
      console.error("Impossibile registrare log tentativo successo", {
        userId,
        bookSlug: book.slug,
        error: successLogError.message,
      });
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_user_id: userId,
      entity: "user_books",
      entity_id: `${userId}:${book.id}`,
      action: "book_unlocked",
      details: {
        bookSlug: book.slug,
        challengeId,
      },
    });

    if (auditError) {
      console.error("Impossibile registrare audit log sblocco libro", {
        userId,
        bookSlug: book.slug,
        error: auditError.message,
      });
    }

    return {
      status: "success",
      message: "Libro sbloccato con successo. Ora puoi accedere ai bonus dedicati.",
    };
  }

  await admin.from("access_attempt_logs").insert({
    user_id: userId,
    book_id: book.id,
    challenge_id: challenge.id,
    attempt_input: answer,
    attempt_input_normalized: normalizedInput,
    result: "failed",
    failure_reason: "invalid_answer",
    ip_address: meta?.ipAddress ?? null,
    user_agent: meta?.userAgent ?? null,
  });

  const failedAttempts = countConsecutiveFailures(parsedLogs) + 1;
  const attemptsLeft = Math.max(0, book.challenge_max_attempts - failedAttempts);

  if (failedAttempts >= book.challenge_max_attempts) {
    const cooldownUntil = buildCooldownUntil({
      cooldownMinutes: book.challenge_cooldown_minutes,
      maxAttempts: book.challenge_max_attempts,
    });

    await admin.from("access_attempt_logs").insert({
      user_id: userId,
      book_id: book.id,
      challenge_id: challenge.id,
      result: "cooldown",
      failure_reason: "too_many_attempts",
      cooldown_until: cooldownUntil.toISOString(),
      ip_address: meta?.ipAddress ?? null,
      user_agent: meta?.userAgent ?? null,
    });

    return {
      status: "cooldown",
      message: `Hai raggiunto il limite di tentativi. Riprova tra ${book.challenge_cooldown_minutes} minuti.`,
      cooldownUntil: cooldownUntil.toISOString(),
      minutesLeft: book.challenge_cooldown_minutes,
    };
  }

  return {
    status: "failed",
    message: "Risposta non corretta. Controlla meglio il libro e riprova.",
    attemptsLeft,
  };
}

export async function revokeBookAccess(params: {
  adminUserId: string;
  targetUserId: string;
  bookId: string;
  reason?: string;
}) {
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("user_books")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: params.adminUserId,
      notes: params.reason ?? null,
    })
    .eq("user_id", params.targetUserId)
    .eq("book_id", params.bookId);

  if (error) {
    throw error;
  }

  await admin.from("audit_logs").insert({
    actor_user_id: params.adminUserId,
    entity: "user_books",
    entity_id: `${params.targetUserId}:${params.bookId}`,
    action: "book_access_revoked",
    details: {
      reason: params.reason ?? null,
    },
  });
}
