import "server-only";

import { Resend } from "resend";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

interface CreateSupportTicketInput {
  userId: string;
  name: string;
  email: string;
  category: "accesso" | "bonus" | "chat_menu" | "tecnico" | "altro";
  message: string;
  bookSlug?: string;
}

interface UserSupportTicketRow {
  id: string;
  category: string;
  status: string;
  message: string;
  created_at: string;
  books: {
    slug: string;
    title: string;
  } | null;
}

interface AdminSupportTicketRow {
  id: string;
  name: string;
  email: string;
  category: string;
  status: string;
  message: string;
  created_at: string;
  books: {
    slug: string;
    title: string;
  } | null;
}

function createResendClient() {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

export async function createSupportTicket(input: CreateSupportTicketInput) {
  const admin = createSupabaseAdminClient();
  const { bookSlug } = input;

  let bookId: string | null = null;
  let bookTitle: string | null = null;

  if (bookSlug) {
    const { data: book } = await admin
      .from("books")
      .select("id, title")
      .eq("slug", bookSlug)
      .eq("is_active", true)
      .maybeSingle();

    bookId = book?.id ?? null;
    bookTitle = book?.title ?? null;
  }

  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({
      user_id: input.userId,
      name: input.name,
      email: input.email,
      category: input.category,
      message: input.message,
      book_id: bookId,
      status: "inviato",
    })
    .select("id, created_at")
    .single();

  if (error || !ticket) {
    throw new Error("Non sono riuscito a creare il ticket di supporto.");
  }

  const resend = createResendClient();
  const from = getEnv("RESEND_FROM_EMAIL") ?? "noreply@ricetteetaglisicuri.it";
  const supportTarget = getEnv("SUPPORT_TARGET_EMAIL") ?? "supporto@ricetteetaglisicuri.it";

  if (resend) {
    const safeBookName = bookTitle ?? "Non specificato";

    await resend.emails.send({
      from,
      to: supportTarget,
      subject: `[Area Lettori] Nuovo ticket ${ticket.id}`,
      html: `
        <h2>Nuovo ticket supporto</h2>
        <p><strong>ID:</strong> ${ticket.id}</p>
        <p><strong>Nome:</strong> ${input.name}</p>
        <p><strong>Email:</strong> ${input.email}</p>
        <p><strong>Categoria:</strong> ${input.category}</p>
        <p><strong>Libro:</strong> ${safeBookName}</p>
        <p><strong>Messaggio:</strong><br/>${input.message.replace(/\n/g, "<br/>")}</p>
      `,
    });

    await resend.emails.send({
      from,
      to: input.email,
      subject: "Abbiamo ricevuto la tua richiesta",
      html: `
        <h2>Richiesta ricevuta</h2>
        <p>Ciao ${input.name},</p>
        <p>abbiamo ricevuto la tua richiesta di supporto (${ticket.id}). Ti risponderemo il prima possibile.</p>
      `,
    });
  }

  return {
    id: ticket.id,
    status: "inviato",
  };
}

export async function getUserSupportTickets(userId: string) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("support_tickets")
    .select("id, category, status, message, created_at, book_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const bookIds = rows.map((row) => row.book_id).filter(Boolean) as string[];

  const { data: books } = bookIds.length
    ? await admin.from("books").select("id, slug, title").in("id", bookIds)
    : { data: [] as { id: string; slug: string; title: string }[] };

  const booksById = new Map((books ?? []).map((book) => [book.id, { slug: book.slug, title: book.title }]));

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    status: row.status,
    message: row.message,
    created_at: row.created_at,
    books: row.book_id ? booksById.get(row.book_id) ?? null : null,
  })) as UserSupportTicketRow[];
}

export async function getAdminSupportTickets() {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("support_tickets")
    .select("id, name, email, category, status, message, created_at, book_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const bookIds = rows.map((row) => row.book_id).filter(Boolean) as string[];

  const { data: books } = bookIds.length
    ? await admin.from("books").select("id, slug, title").in("id", bookIds)
    : { data: [] as { id: string; slug: string; title: string }[] };

  const booksById = new Map((books ?? []).map((book) => [book.id, { slug: book.slug, title: book.title }]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    category: row.category,
    status: row.status,
    message: row.message,
    created_at: row.created_at,
    books: row.book_id ? booksById.get(row.book_id) ?? null : null,
  })) as AdminSupportTicketRow[];
}
