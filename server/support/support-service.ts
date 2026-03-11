import "server-only";

import { Resend } from "resend";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEnv } from "@/lib/env";

const DEFAULT_PLATFORM_FROM_EMAIL = "ricettetaglisicuri@gmail.com";

interface CreateSupportTicketInput {
  userId: string;
  name: string;
  email: string;
  category: SupportTicketCategory;
  message: string;
  bookSlug?: string;
}

type SupportTicketCategory = "accesso" | "bonus" | "chat_menu" | "tecnico" | "altro";
type SupportTicketStatus = "inviato" | "in_lavorazione" | "risolto" | "chiuso";

interface TicketBookRelation {
  slug: string;
  title: string;
}

interface UserSupportTicketDbRow {
  id: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  message: string;
  created_at: string;
  book_id: string | null;
}

interface AdminSupportTicketDbRow {
  id: string;
  name: string;
  email: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  message: string;
  created_at: string;
  book_id: string | null;
  admin_notes: string | null;
}

export interface UserSupportTicketRow {
  id: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  message: string;
  created_at: string;
  books: TicketBookRelation | null;
}

export interface AdminSupportTicketRow {
  id: string;
  name: string;
  email: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  message: string;
  created_at: string;
  admin_notes: string | null;
  books: TicketBookRelation | null;
}

interface AdminSupportTicketFilters {
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  q?: string;
}

function createResendClient() {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

async function getTicketBooksMap(bookIds: string[]) {
  const admin = createSupabaseAdminClient();

  if (bookIds.length === 0) {
    return new Map<string, TicketBookRelation>();
  }

  const { data: books } = await admin.from("books").select("id, slug, title").in("id", bookIds);
  return new Map((books ?? []).map((book) => [book.id, { slug: book.slug, title: book.title }]));
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
  const from = getEnv("RESEND_FROM_EMAIL") ?? DEFAULT_PLATFORM_FROM_EMAIL;
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

  const rows = (data ?? []) as UserSupportTicketDbRow[];
  const bookIds = rows.map((row) => row.book_id).filter(Boolean) as string[];
  const booksById = await getTicketBooksMap(bookIds);

  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    status: row.status,
    message: row.message,
    created_at: row.created_at,
    books: row.book_id ? booksById.get(row.book_id) ?? null : null,
  }));
}

export async function getAdminSupportTickets(filters?: AdminSupportTicketFilters) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("support_tickets")
    .select("id, name, email, category, status, message, created_at, book_id, admin_notes")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let rows = (data ?? []) as AdminSupportTicketDbRow[];

  const normalizedSearch = filters?.q?.trim().toLowerCase();
  if (normalizedSearch) {
    rows = rows.filter((row) => {
      return [row.name, row.email, row.message].some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }

  const bookIds = rows.map((row) => row.book_id).filter(Boolean) as string[];
  const booksById = await getTicketBooksMap(bookIds);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    category: row.category,
    status: row.status,
    message: row.message,
    created_at: row.created_at,
    admin_notes: row.admin_notes,
    books: row.book_id ? booksById.get(row.book_id) ?? null : null,
  }));
}

export async function updateAdminSupportTicketStatus(params: {
  ticketId: string;
  status: SupportTicketStatus;
  adminUserId: string;
  adminNotes?: string;
  replyMessage?: string;
  notifyUser?: boolean;
}) {
  const admin = createSupabaseAdminClient();

  const { data: currentTicket, error: currentError } = await admin
    .from("support_tickets")
    .select("id, status, admin_notes, email, name")
    .eq("id", params.ticketId)
    .maybeSingle();

  if (currentError || !currentTicket) {
    throw new Error("Ticket non trovato.");
  }

  const payload: { status: SupportTicketStatus; admin_notes?: string | null } = {
    status: params.status,
  };

  if (params.adminNotes !== undefined) {
    payload.admin_notes = params.adminNotes.trim() ? params.adminNotes.trim() : null;
  }

  if (params.replyMessage?.trim()) {
    const currentNotes = payload.admin_notes ?? currentTicket.admin_notes ?? "";
    const replyBlock = `Risposta admin (${new Date().toLocaleString("it-IT")}): ${params.replyMessage.trim()}`;
    payload.admin_notes = currentNotes ? `${currentNotes}\n\n${replyBlock}` : replyBlock;
  }

  const { data: updated, error: updateError } = await admin
    .from("support_tickets")
    .update(payload)
    .eq("id", params.ticketId)
    .select("id, name, email, category, status, message, created_at, book_id, admin_notes")
    .single();

  if (updateError || !updated) {
    throw new Error("Impossibile aggiornare lo stato del ticket.");
  }

  const booksById = await getTicketBooksMap(updated.book_id ? [updated.book_id] : []);

  if (params.notifyUser && params.replyMessage?.trim()) {
    const resend = createResendClient();
    if (!resend) {
      throw new Error("Email non inviata: configura RESEND_API_KEY.");
    }

    const from = getEnv("RESEND_FROM_EMAIL") ?? DEFAULT_PLATFORM_FROM_EMAIL;
    await resend.emails.send({
      from,
      to: updated.email,
      subject: "Risposta al tuo ticket - Ricette e Tagli Sicuri",
      html: `
        <h2>Abbiamo risposto alla tua richiesta</h2>
        <p>Ciao ${updated.name},</p>
        <p>${params.replyMessage.trim().replace(/\n/g, "<br/>")}</p>
      `,
    });
  }

  try {
    await admin.from("audit_logs").insert({
      actor_user_id: params.adminUserId,
      entity: "support_tickets",
      entity_id: params.ticketId,
      action: "admin_update_status",
      details: {
        fromStatus: currentTicket.status,
        toStatus: params.status,
        previousAdminNotes: currentTicket.admin_notes,
        newAdminNotes: payload.admin_notes ?? currentTicket.admin_notes,
        notifiedUser: Boolean(params.notifyUser && params.replyMessage?.trim()),
      },
    });
  } catch (error) {
    console.error("Impossibile registrare audit log ticket supporto", { ticketId: params.ticketId, error });
  }

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    category: updated.category,
    status: updated.status,
    message: updated.message,
    created_at: updated.created_at,
    admin_notes: updated.admin_notes,
    books: updated.book_id ? booksById.get(updated.book_id) ?? null : null,
  } as AdminSupportTicketRow;
}
