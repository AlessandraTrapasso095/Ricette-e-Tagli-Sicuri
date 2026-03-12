import "server-only";

import { differenceInMonths } from "date-fns";

import { AUTH_INACTIVITY_TIMEOUT_MS } from "@/config/auth";
import { READER_BOOK_RECOMMENDATIONS, type RecommendedBook } from "@/config/recommended-books";
import { normalizeBookAnswer } from "@/lib/text/normalize-answer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type FeedingStyle = "classico" | "autosvezzamento" | "misto";

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

interface BonusDbRow {
  id: string;
  title: string;
  description: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  is_active: boolean;
  created_at: string;
  book_id: string;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface ChildRow {
  id: string;
  user_id: string;
  name: string;
  age_mode: "birth_date" | "months";
  birth_date: string | null;
  age_months: number | null;
  feeding_style: FeedingStyle;
  is_primary: boolean;
  created_at: string;
}

interface FailedAttemptRow {
  id: number;
  user_id: string;
  book_id: string;
  challenge_id: string | null;
  attempt_input: string | null;
  failure_reason: string | null;
  created_at: string;
}

interface AuthUserLike {
  id: string;
  email?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
}

interface SuggestedBookRow {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  isActive: boolean;
}

function toSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseFutureDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.getTime() > Date.now() ? date : null;
}

function getNameParts(fullName: string | null, email: string) {
  const clean = fullName?.trim();
  if (!clean) {
    const fallback = email.split("@")[0] ?? "Utente";
    return { firstName: fallback, lastName: "" };
  }

  const [firstName, ...rest] = clean.split(/\s+/);
  return {
    firstName,
    lastName: rest.join(" "),
  };
}

function getChildAgeMonths(child: ChildRow | null) {
  if (!child) {
    return null;
  }

  if (child.age_mode === "months") {
    return child.age_months ?? null;
  }

  if (!child.birth_date) {
    return null;
  }

  const birthDate = new Date(child.birth_date);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  return Math.max(0, differenceInMonths(new Date(), birthDate));
}

async function listAllAuthUsers() {
  const admin = createSupabaseAdminClient();
  const users: AuthUserLike[] = [];
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

    if (error) {
      throw error;
    }

    const pageUsers = (data?.users ?? []) as AuthUserLike[];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) {
      break;
    }
  }

  return users;
}

function isUserActiveNow(authUser: AuthUserLike | null) {
  if (!authUser?.last_sign_in_at) {
    return false;
  }

  const lastSignIn = new Date(authUser.last_sign_in_at);
  if (Number.isNaN(lastSignIn.getTime())) {
    return false;
  }

  if (parseFutureDate(authUser.banned_until)) {
    return false;
  }

  return Date.now() - lastSignIn.getTime() <= AUTH_INACTIVITY_TIMEOUT_MS;
}

function normalizeSuggestedBooks(rawValue: unknown): SuggestedBookRow[] {
  if (!Array.isArray(rawValue)) {
    return READER_BOOK_RECOMMENDATIONS.map((book) => ({
      id: book.id ?? crypto.randomUUID(),
      title: book.title,
      subtitle: book.subtitle ?? "Apri su Amazon",
      url: book.url,
      isActive: book.isActive ?? true,
    }));
  }

  const rows = rawValue
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
      const subtitle = typeof candidate.subtitle === "string" ? candidate.subtitle.trim() : "Apri su Amazon";
      const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
      const isActive = typeof candidate.isActive === "boolean" ? candidate.isActive : true;
      const id = typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : crypto.randomUUID();

      if (!title || !url) {
        return null;
      }

      return { id, title, subtitle, url, isActive } satisfies SuggestedBookRow;
    })
    .filter((row): row is SuggestedBookRow => row !== null);

  if (rows.length === 0) {
    return READER_BOOK_RECOMMENDATIONS.map((book) => ({
      id: book.id ?? crypto.randomUUID(),
      title: book.title,
      subtitle: book.subtitle ?? "Apri su Amazon",
      url: book.url,
      isActive: book.isActive ?? true,
    }));
  }

  return rows;
}

async function getProfilesMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("profiles").select("id, email, full_name, created_at").in("id", userIds);

  if (error) {
    throw error;
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
}

export async function getAdminStats() {
  const admin = createSupabaseAdminClient();

  const [usersRes, unlockRes, ticketsRes, attemptsRes] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("user_books").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "inviato"),
    admin.from("access_attempt_logs").select("id", { count: "exact", head: true }).eq("result", "failed"),
  ]);

  let activeUsers = 0;
  try {
    const authUsers = await listAllAuthUsers();
    activeUsers = authUsers.filter((authUser) => isUserActiveNow(authUser)).length;
  } catch {
    activeUsers = 0;
  }

  return {
    users: usersRes.count ?? 0,
    unlockedBooks: unlockRes.count ?? 0,
    activeUsers,
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

export async function createAdminBook(payload: { title: string; subtitle?: string; link?: string }) {
  const admin = createSupabaseAdminClient();

  const baseSlug = toSlug(payload.title) || `libro-${Date.now()}`;
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const { data: existing } = await admin.from("books").select("id").eq("slug", slug).maybeSingle();
    if (!existing) {
      break;
    }
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const { data: lastBook } = await admin
    .from("books")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (lastBook?.sort_order ?? 0) + 1;

  const { data, error } = await admin
    .from("books")
    .insert({
      slug,
      title: payload.title,
      description: payload.subtitle?.trim() ? payload.subtitle.trim() : null,
      cover_url: payload.link?.trim() ? payload.link.trim() : null,
      sort_order: sortOrder,
      challenge_max_attempts: 5,
      challenge_cooldown_minutes: 30,
      is_active: true,
    })
    .select("id, slug, title")
    .single();

  if (error || !data) {
    throw new Error("Impossibile creare il libro.");
  }

  return data;
}

export async function updateAdminBook(payload: {
  bookId: string;
  title: string;
  subtitle?: string;
  link?: string;
  isActive: boolean;
}) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("books")
    .update({
      title: payload.title,
      description: payload.subtitle?.trim() ? payload.subtitle.trim() : null,
      cover_url: payload.link?.trim() ? payload.link.trim() : null,
      is_active: payload.isActive,
    })
    .eq("id", payload.bookId)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("Impossibile aggiornare il libro.");
  }

  return data;
}

export async function deleteAdminBook(bookId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("books").delete().eq("id", bookId);

  if (error) {
    throw new Error("Impossibile eliminare il libro.");
  }
}

export async function getAdminBonusFiles() {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("bonus_files")
    .select("id, title, description, storage_bucket, storage_path, mime_type, is_active, created_at, book_id")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as BonusDbRow[];
  if (rows.length === 0) {
    return [];
  }

  const bookIds = [...new Set(rows.map((row) => row.book_id))];
  const { data: books, error: booksError } = await admin
    .from("books")
    .select("id, slug, title")
    .in("id", bookIds);

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
        title: row.title,
        description: row.description,
        storage_bucket: row.storage_bucket,
        storage_path: row.storage_path,
        mime_type: row.mime_type,
        is_active: row.is_active,
        created_at: row.created_at,
        books: book,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function upsertAdminBonusFile(payload: {
  id?: string;
  bookId: string;
  title: string;
  description?: string;
  storageBucket?: string;
  storagePath?: string;
  mimeType?: string;
  isActive: boolean;
}) {
  const admin = createSupabaseAdminClient();
  let storageBucket = payload.storageBucket ?? "bonus-files";
  let storagePath = payload.storagePath;
  let mimeType = payload.mimeType ?? "application/pdf";

  if (payload.id && !storagePath) {
    const { data: existing } = await admin
      .from("bonus_files")
      .select("storage_bucket, storage_path, mime_type")
      .eq("id", payload.id)
      .maybeSingle();

    storageBucket = existing?.storage_bucket ?? storageBucket;
    storagePath = existing?.storage_path ?? storagePath;
    mimeType = existing?.mime_type ?? mimeType;
  }

  if (!storagePath) {
    throw new Error("File PDF obbligatorio.");
  }

  const { data, error } = await admin
    .from("bonus_files")
    .upsert(
      {
        id: payload.id,
        book_id: payload.bookId,
        title: payload.title,
        description: payload.description?.trim() ? payload.description.trim() : null,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        mime_type: mimeType,
        is_active: payload.isActive,
      },
      payload.id ? { onConflict: "id" } : { onConflict: "book_id,storage_path" },
    )
    .select("id, title, book_id")
    .single();

  if (error || !data) {
    throw new Error("Non riesco a salvare il bonus PDF.");
  }

  return data;
}

export async function toggleAdminBonusStatus(bonusId: string, isActive: boolean) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("bonus_files").update({ is_active: isActive }).eq("id", bonusId);

  if (error) {
    throw new Error("Impossibile aggiornare lo stato bonus.");
  }
}

export async function deleteAdminBonusFile(bonusId: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("bonus_files").delete().eq("id", bonusId);

  if (error) {
    throw new Error("Impossibile eliminare il bonus.");
  }
}

export async function getAdminChallenges() {
  const admin = createSupabaseAdminClient();

  const { data: challengeRows, error } = await admin
    .from("book_access_challenges")
    .select("id, page_number, prompt_text, is_active, created_at, book_id")
    .order("created_at", { ascending: false })
    .limit(500);

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
    .limit(500);

  if (error) {
    throw error;
  }

  const profiles = (data ?? []) as ProfileRow[];
  if (profiles.length === 0) {
    return [];
  }

  const userIds = profiles.map((user) => user.id);

  const [childrenRes, unlockedRes, failedRes] = await Promise.all([
    admin
      .from("children")
      .select("id, user_id, name, age_mode, birth_date, age_months, feeding_style, is_primary, created_at")
      .in("user_id", userIds),
    admin.from("user_books").select("user_id, book_id, status").in("user_id", userIds).eq("status", "active"),
    admin.from("access_attempt_logs").select("user_id, result").in("user_id", userIds).eq("result", "failed"),
  ]);

  const children = (childrenRes.data ?? []) as ChildRow[];
  const childrenByUser = new Map<string, ChildRow>();
  for (const child of children) {
    const existing = childrenByUser.get(child.user_id);
    if (!existing) {
      childrenByUser.set(child.user_id, child);
      continue;
    }

    if (!existing.is_primary && child.is_primary) {
      childrenByUser.set(child.user_id, child);
      continue;
    }

    if (existing.is_primary === child.is_primary && child.created_at > existing.created_at) {
      childrenByUser.set(child.user_id, child);
    }
  }

  const unlocked = (unlockedRes.data ?? []) as UserUnlockedBookRow[];
  const uniqueBookIds = [...new Set(unlocked.map((entry) => entry.book_id))];
  const { data: books } = uniqueBookIds.length
    ? await admin.from("books").select("id, slug, title").in("id", uniqueBookIds)
    : { data: [] as BookMiniRow[] };

  const booksById = new Map(((books ?? []) as BookMiniRow[]).map((book) => [book.id, book]));
  const unlockedCount = new Map<string, number>();
  const unlockedRowsByUser = new Map<string, { id: string; slug: string; title: string }[]>();

  for (const entry of unlocked) {
    unlockedCount.set(entry.user_id, (unlockedCount.get(entry.user_id) ?? 0) + 1);
    const book = booksById.get(entry.book_id);
    if (!book) {
      continue;
    }

    const existing = unlockedRowsByUser.get(entry.user_id) ?? [];
    unlockedRowsByUser.set(entry.user_id, [...existing, book]);
  }

  const failedCount = new Map<string, number>();
  for (const entry of failedRes.data ?? []) {
    failedCount.set(entry.user_id, (failedCount.get(entry.user_id) ?? 0) + 1);
  }

  let authUsersById = new Map<string, AuthUserLike>();
  try {
    const authUsers = await listAllAuthUsers();
    authUsersById = new Map(authUsers.map((authUser) => [authUser.id, authUser]));
  } catch {
    authUsersById = new Map();
  }

  return profiles.map((user) => {
    const child = childrenByUser.get(user.id) ?? null;
    const names = getNameParts(user.full_name, user.email);
    const authUser = authUsersById.get(user.id) ?? null;
    const bannedUntil = parseFutureDate(authUser?.banned_until)?.toISOString() ?? null;

    return {
      ...user,
      firstName: names.firstName,
      lastName: names.lastName,
      childName: child?.name ?? null,
      childAgeMonths: getChildAgeMonths(child),
      childFeedingStyle: child?.feeding_style ?? null,
      unlockedBooks: unlockedCount.get(user.id) ?? 0,
      unlockedBookRows: unlockedRowsByUser.get(user.id) ?? [],
      failedAttempts: failedCount.get(user.id) ?? 0,
      lastSignInAt: authUser?.last_sign_in_at ?? null,
      bannedUntil,
      isSuspended: Boolean(bannedUntil),
      isActiveNow: isUserActiveNow(authUser),
    };
  });
}

export async function setAdminUserSuspension(params: {
  adminUserId: string;
  userId: string;
  duration: "1h" | "24h" | "168h" | "permanent" | "none";
}) {
  const admin = createSupabaseAdminClient();

  const durationValue = params.duration === "permanent" ? "876000h" : params.duration;
  const banDuration = params.duration === "none" ? "none" : durationValue;

  const { data, error } = await admin.auth.admin.updateUserById(params.userId, {
    ban_duration: banDuration,
  });

  if (error) {
    throw new Error("Impossibile aggiornare la sospensione utente.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: params.adminUserId,
    entity: "profiles",
    entity_id: params.userId,
    action: params.duration === "none" ? "account_unsuspended" : "account_suspended",
    details: {
      duration: params.duration,
    },
  });

  const hoursByDuration: Record<Exclude<typeof params.duration, "none">, number> = {
    "1h": 1,
    "24h": 24,
    "168h": 168,
    permanent: 876000,
  };

  const fallbackBannedUntil =
    params.duration === "none" ? null : new Date(Date.now() + hoursByDuration[params.duration] * 60 * 60 * 1000).toISOString();
  const fromAuth = parseFutureDate(data.user?.banned_until)?.toISOString() ?? null;

  return {
    isSuspended: params.duration !== "none",
    bannedUntil: params.duration === "none" ? null : fromAuth ?? fallbackBannedUntil,
  };
}

export async function getAdminUnlockedBooksSummary() {
  const admin = createSupabaseAdminClient();
  const [booksRes, userBooksRes] = await Promise.all([
    admin.from("books").select("id, slug, title, is_active, sort_order").order("sort_order", { ascending: true }),
    admin.from("user_books").select("book_id, user_id").eq("status", "active"),
  ]);

  if (booksRes.error) {
    throw booksRes.error;
  }

  if (userBooksRes.error) {
    throw userBooksRes.error;
  }

  const counts = new Map<string, number>();
  for (const row of userBooksRes.data ?? []) {
    counts.set(row.book_id, (counts.get(row.book_id) ?? 0) + 1);
  }

  return (booksRes.data ?? []).map((book) => ({
    id: book.id,
    slug: book.slug,
    title: book.title,
    isActive: book.is_active,
    unlockedUsers: counts.get(book.id) ?? 0,
  }));
}

export async function getAdminActiveUsersOverview() {
  const users = await getAdminUsersOverview();
  return users.filter((user) => user.isActiveNow);
}

export async function getAdminFailedAttemptsOverview() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("access_attempt_logs")
    .select("id, user_id, book_id, challenge_id, attempt_input, failure_reason, created_at")
    .eq("result", "failed")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as FailedAttemptRow[];
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const bookIds = [...new Set(rows.map((row) => row.book_id))];
  const challengeIds = [...new Set(rows.map((row) => row.challenge_id).filter(Boolean) as string[])];

  const [profilesById, booksRes, challengesRes] = await Promise.all([
    getProfilesMap(userIds),
    bookIds.length ? admin.from("books").select("id, title").in("id", bookIds) : Promise.resolve({ data: [], error: null }),
    challengeIds.length
      ? admin.from("book_access_challenges").select("id, page_number").in("id", challengeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (booksRes.error) {
    throw booksRes.error;
  }
  if (challengesRes.error) {
    throw challengesRes.error;
  }

  const booksById = new Map((booksRes.data ?? []).map((book) => [book.id, book]));
  const challengesById = new Map((challengesRes.data ?? []).map((challenge) => [challenge.id, challenge]));

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    const names = profile ? getNameParts(profile.full_name, profile.email) : { firstName: "Utente", lastName: "" };
    const book = booksById.get(row.book_id);
    const challenge = row.challenge_id ? challengesById.get(row.challenge_id) : null;

    return {
      id: row.id,
      createdAt: row.created_at,
      userId: row.user_id,
      userName: `${names.firstName}${names.lastName ? ` ${names.lastName}` : ""}`.trim(),
      userEmail: profile?.email ?? "",
      bookTitle: book?.title ?? "Libro non trovato",
      pageNumber: challenge?.page_number ?? null,
      attemptInput: row.attempt_input,
      reason: row.failure_reason ?? "Risposta non valida",
    };
  });
}

export async function getAdminRecommendedBooks() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("app_settings").select("value").eq("key", "recommended_books").maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeSuggestedBooks(data?.value);
}

export async function saveAdminRecommendedBooks(books: SuggestedBookRow[], adminUserId?: string) {
  const admin = createSupabaseAdminClient();
  const normalized = books.map((book) => ({
    id: book.id || crypto.randomUUID(),
    title: book.title.trim(),
    subtitle: book.subtitle.trim(),
    url: book.url.trim(),
    isActive: Boolean(book.isActive),
  }));

  const { error } = await admin.from("app_settings").upsert(
    {
      key: "recommended_books",
      value: normalized,
      description: "Lista libri consigliati in dashboard utente.",
      updated_by: adminUserId ?? null,
    },
    { onConflict: "key" },
  );

  if (error) {
    throw new Error("Impossibile salvare i libri consigliati.");
  }

  return normalized;
}

export type AdminSuggestedBook = SuggestedBookRow;
export type AdminDashboardRecommendedBook = RecommendedBook;
