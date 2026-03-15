import "server-only";

import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getUserNotificationPreferences } from "@/server/account/notification-preferences-service";
import { resolveConfiguredAppBaseUrl } from "@/server/auth/auth-url";
import { sendTransactionalEmail } from "@/server/email/transactional-sender";

interface CreateSupportTicketInput {
  userId: string;
  name: string;
  email: string;
  category: SupportTicketCategory;
  message: string;
  bookSlug?: string;
}

interface ReplyToSupportTicketInput {
  ticketId: string;
  userId: string;
  message: string;
}

type SupportTicketCategory = "accesso" | "bonus" | "chat_menu" | "tecnico" | "altro";
type SupportTicketStatus = "inviato" | "in_lavorazione" | "risolto" | "chiuso";
type SupportMessageRole = "user" | "admin";

interface TicketBookRelation {
  slug: string;
  title: string;
}

interface SupportTicketMessageSourceRow {
  id: string;
  message: string;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
}

interface UserSupportTicketDbRow extends SupportTicketMessageSourceRow {
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  book_id: string | null;
  name: string;
  email: string;
}

interface AdminSupportTicketDbRow extends SupportTicketMessageSourceRow {
  name: string;
  email: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  book_id: string | null;
}

interface AuditLogRow {
  entity_id: string | null;
  action: string;
  actor_user_id: string | null;
  created_at: string;
  details: {
    role?: SupportMessageRole;
    content?: string;
  } | null;
}

export interface SupportTicketMessage {
  sender: "utente" | "admin";
  content: string;
  created_at: string;
}

export interface UserSupportTicketRow {
  id: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  message: string;
  created_at: string;
  updated_at: string;
  admin_notes: string | null;
  hasUnreadAdminReply: boolean;
  canUserReply: boolean;
  messages: SupportTicketMessage[];
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
  messages: SupportTicketMessage[];
  books: TicketBookRelation | null;
}

interface AdminSupportTicketFilters {
  status?: SupportTicketStatus;
  category?: SupportTicketCategory;
  q?: string;
}

async function getTicketBooksMap(bookIds: string[]) {
  const admin = createSupabaseAdminClient();

  if (bookIds.length === 0) {
    return new Map<string, TicketBookRelation>();
  }

  const { data: books } = await admin.from("books").select("id, slug, title").in("id", bookIds);
  return new Map((books ?? []).map((book) => [book.id, { slug: book.slug, title: book.title }]));
}

async function getSupportMessageLogMap(ticketIds: string[]) {
  const admin = createSupabaseAdminClient();

  if (ticketIds.length === 0) {
    return new Map<string, SupportTicketMessage[]>();
  }

  const { data, error } = await admin
    .from("audit_logs")
    .select("entity_id, action, actor_user_id, created_at, details")
    .eq("entity", "support_tickets")
    .in("entity_id", ticketIds)
    .eq("action", "support_ticket_message")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const messagesByTicket = new Map<string, SupportTicketMessage[]>();

  for (const row of (data ?? []) as AuditLogRow[]) {
    if (!row.entity_id || !row.details?.content || !row.details.role) {
      continue;
    }

    const message: SupportTicketMessage = {
      sender: row.details.role === "admin" ? "admin" : "utente",
      content: row.details.content,
      created_at: row.created_at,
    };

    messagesByTicket.set(row.entity_id, [...(messagesByTicket.get(row.entity_id) ?? []), message]);
  }

  return messagesByTicket;
}

function buildTicketMessages(row: SupportTicketMessageSourceRow, loggedMessages: SupportTicketMessage[]) {
  const messages = [...loggedMessages];
  const hasUserMessageLog = messages.some((message) => message.sender === "utente");
  const hasAdminMessageLog = messages.some((message) => message.sender === "admin");

  if (!hasUserMessageLog && row.message.trim()) {
    messages.unshift({
      sender: "utente",
      content: row.message,
      created_at: row.created_at,
    });
  }

  if (!hasAdminMessageLog && row.admin_notes?.trim()) {
    messages.push({
      sender: "admin",
      content: row.admin_notes,
      created_at: row.updated_at,
    });
  }

  return messages.sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

function getLastMessageSender(messages: SupportTicketMessage[]) {
  if (messages.length === 0) {
    return null;
  }

  return messages[messages.length - 1]?.sender ?? null;
}

async function getSupportReplyStateMap(ticketIds: string[], userId: string) {
  const admin = createSupabaseAdminClient();

  if (ticketIds.length === 0) {
    return new Map<string, boolean>();
  }

  const { data, error } = await admin
    .from("audit_logs")
    .select("entity_id, action, actor_user_id, created_at, details")
    .eq("entity", "support_tickets")
    .in("entity_id", ticketIds)
    .in("action", ["support_ticket_reply_sent", "support_ticket_reply_read"])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const latestSentByTicket = new Map<string, string>();
  const latestReadByTicket = new Map<string, string>();

  for (const row of (data ?? []) as AuditLogRow[]) {
    if (!row.entity_id) {
      continue;
    }

    if (row.action === "support_ticket_reply_sent" && !latestSentByTicket.has(row.entity_id)) {
      latestSentByTicket.set(row.entity_id, row.created_at);
    }

    if (
      row.action === "support_ticket_reply_read" &&
      row.actor_user_id === userId &&
      !latestReadByTicket.has(row.entity_id)
    ) {
      latestReadByTicket.set(row.entity_id, row.created_at);
    }
  }

  return new Map(
    ticketIds.map((ticketId) => {
      const latestSent = latestSentByTicket.get(ticketId);
      const latestRead = latestReadByTicket.get(ticketId);
      const hasUnreadAdminReply = Boolean(latestSent && (!latestRead || new Date(latestRead) < new Date(latestSent)));

      return [ticketId, hasUnreadAdminReply];
    }),
  );
}

async function logSupportTicketMessage(params: {
  ticketId: string;
  actorUserId: string;
  role: SupportMessageRole;
  content: string;
}) {
  const admin = createSupabaseAdminClient();

  await admin.from("audit_logs").insert({
    actor_user_id: params.actorUserId,
    entity: "support_tickets",
    entity_id: params.ticketId,
    action: "support_ticket_message",
    details: {
      role: params.role,
      content: params.content,
    },
  });
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

  await logSupportTicketMessage({
    ticketId: ticket.id,
    actorUserId: input.userId,
    role: "user",
    content: input.message.trim(),
  });

  const supportTarget = getEnv("SUPPORT_TARGET_EMAIL") ?? "supporto@ricetteetaglisicuri.it";
  const safeBookName = bookTitle ?? "Non specificato";

  try {
    await sendTransactionalEmail({
      to: supportTarget,
      subject: `[Area Lettori] Nuovo ticket ${ticket.id}`,
      replyTo: input.email,
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

    await sendTransactionalEmail({
      to: input.email,
      subject: "Abbiamo ricevuto la tua richiesta",
      html: `
        <h2>Richiesta ricevuta</h2>
        <p>Ciao ${input.name},</p>
        <p>abbiamo ricevuto la tua richiesta di supporto (${ticket.id}). Ti risponderemo il prima possibile.</p>
      `,
    });
  } catch (error) {
    console.error("Errore invio email ticket supporto", { ticketId: ticket.id, error });
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
    .select("id, name, email, category, status, message, created_at, updated_at, book_id, admin_notes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as UserSupportTicketDbRow[];
  const bookIds = rows.map((row) => row.book_id).filter(Boolean) as string[];
  const ticketIds = rows.map((row) => row.id);
  const booksById = await getTicketBooksMap(bookIds);
  const unreadReplyByTicket = await getSupportReplyStateMap(ticketIds, userId);
  const messageLogByTicket = await getSupportMessageLogMap(ticketIds);

  return rows.map((row) => {
    const messages = buildTicketMessages(row, messageLogByTicket.get(row.id) ?? []);
    const lastSender = getLastMessageSender(messages);

    return {
      id: row.id,
      category: row.category,
      status: row.status,
      message: row.message,
      created_at: row.created_at,
      updated_at: row.updated_at,
      admin_notes: row.admin_notes,
      hasUnreadAdminReply: unreadReplyByTicket.get(row.id) ?? false,
      canUserReply: row.status !== "chiuso" && lastSender === "admin",
      messages,
      books: row.book_id ? booksById.get(row.book_id) ?? null : null,
    };
  });
}

export async function getAdminSupportTickets(filters?: AdminSupportTicketFilters) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("support_tickets")
    .select("id, name, email, category, status, message, created_at, updated_at, book_id, admin_notes")
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

  const rows = (data ?? []) as AdminSupportTicketDbRow[];
  const bookIds = rows.map((row) => row.book_id).filter(Boolean) as string[];
  const ticketIds = rows.map((row) => row.id);
  const booksById = await getTicketBooksMap(bookIds);
  const messageLogByTicket = await getSupportMessageLogMap(ticketIds);

  let result = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    category: row.category,
    status: row.status,
    message: row.message,
    created_at: row.created_at,
    admin_notes: row.admin_notes,
    messages: buildTicketMessages(row, messageLogByTicket.get(row.id) ?? []),
    books: row.book_id ? booksById.get(row.book_id) ?? null : null,
  })) as AdminSupportTicketRow[];

  const normalizedSearch = filters?.q?.trim().toLowerCase();
  if (normalizedSearch) {
    result = result.filter((row) =>
      [row.name, row.email, ...row.messages.map((message) => message.content)].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      ),
    );
  }

  return result;
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
  const trimmedReply = params.replyMessage?.trim();

  const { data: currentTicket, error: currentError } = await admin
    .from("support_tickets")
    .select("id, user_id, status, admin_notes, email, name")
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

  if (trimmedReply) {
    const currentNotes = payload.admin_notes ?? currentTicket.admin_notes ?? "";
    const replyBlock = `Risposta admin (${new Date().toLocaleString("it-IT")}): ${trimmedReply}`;
    payload.admin_notes = currentNotes ? `${currentNotes}\n\n${replyBlock}` : replyBlock;
  }

  const { data: updated, error: updateError } = await admin
    .from("support_tickets")
    .update(payload)
    .eq("id", params.ticketId)
    .select("id, user_id, name, email, category, status, message, created_at, updated_at, book_id, admin_notes")
    .single();

  if (updateError || !updated) {
    throw new Error("Impossibile aggiornare lo stato del ticket.");
  }

  const userNotificationPreferences = trimmedReply
    ? await getUserNotificationPreferences(currentTicket.user_id)
    : null;
  const shouldNotifyUserByEmail = Boolean(params.notifyUser && trimmedReply && userNotificationPreferences?.ticketUpdates);

  if (trimmedReply) {
    await logSupportTicketMessage({
      ticketId: params.ticketId,
      actorUserId: params.adminUserId,
      role: "admin",
      content: trimmedReply,
    });

    await admin.from("audit_logs").insert({
      actor_user_id: params.adminUserId,
      entity: "support_tickets",
      entity_id: params.ticketId,
      action: "support_ticket_reply_sent",
      details: {
        status: params.status,
        notifiedUser: shouldNotifyUserByEmail,
      },
    });
  }

  if (shouldNotifyUserByEmail && trimmedReply) {
    const appBaseUrl = resolveConfiguredAppBaseUrl();
    const supportUrl = appBaseUrl ? `${appBaseUrl}/dashboard/supporto` : null;

    await sendTransactionalEmail({
      to: updated.email,
      subject: "Risposta al tuo ticket - Ricette e Tagli Sicuri",
      html: `
        <h2>Abbiamo risposto alla tua richiesta</h2>
        <p>Ciao ${updated.name},</p>
        <p>${trimmedReply.replace(/\n/g, "<br/>")}</p>
        <p>Puoi visualizzare la risposta anche nella sezione Ticket della tua Area Lettori.</p>
        ${
          supportUrl
            ? `<p><a href="${supportUrl}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">Apri i tuoi ticket</a></p>`
            : ""
        }
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
        notifiedUser: shouldNotifyUserByEmail,
      },
    });
  } catch (error) {
    console.error("Impossibile registrare audit log ticket supporto", { ticketId: params.ticketId, error });
  }

  const booksById = await getTicketBooksMap(updated.book_id ? [updated.book_id] : []);
  const updatedMessageMap = await getSupportMessageLogMap([updated.id]);
  const messages = buildTicketMessages(updated, updatedMessageMap.get(updated.id) ?? []);

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    category: updated.category,
    status: updated.status,
    message: updated.message,
    created_at: updated.created_at,
    admin_notes: updated.admin_notes,
    messages,
    books: updated.book_id ? booksById.get(updated.book_id) ?? null : null,
  } as AdminSupportTicketRow;
}

export async function markUserSupportTicketReplyAsRead(ticketId: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const tickets = await getUserSupportTickets(userId);
  const ticket = tickets.find((item) => item.id === ticketId);

  if (!ticket) {
    throw new Error("Ticket non trovato.");
  }

  if (!ticket.hasUnreadAdminReply) {
    return { marked: false as const };
  }

  await admin.from("audit_logs").insert({
    actor_user_id: userId,
    entity: "support_tickets",
    entity_id: ticketId,
    action: "support_ticket_reply_read",
    details: {},
  });

  return { marked: true as const };
}

export async function replyToSupportTicket(input: ReplyToSupportTicketInput) {
  const admin = createSupabaseAdminClient();
  const trimmedMessage = input.message.trim();
  const tickets = await getUserSupportTickets(input.userId);
  const ticket = tickets.find((item) => item.id === input.ticketId);

  if (!ticket) {
    throw new Error("Ticket non trovato.");
  }

  if (ticket.status === "chiuso") {
    throw new Error("Questo ticket e' chiuso.");
  }

  if (!ticket.canUserReply) {
    throw new Error("Puoi rispondere solo dopo un messaggio del supporto.");
  }

  const { data: updated, error: updateError } = await admin
    .from("support_tickets")
    .update({ status: "inviato" })
    .eq("id", input.ticketId)
    .eq("user_id", input.userId)
    .select("id, name, email")
    .single();

  if (updateError || !updated) {
    throw new Error("Impossibile inviare la risposta al ticket.");
  }

  await logSupportTicketMessage({
    ticketId: input.ticketId,
    actorUserId: input.userId,
    role: "user",
    content: trimmedMessage,
  });

  const supportTarget = getEnv("SUPPORT_TARGET_EMAIL") ?? "supporto@ricetteetaglisicuri.it";

  try {
    await sendTransactionalEmail({
      to: supportTarget,
      replyTo: updated.email,
      subject: `[Area Lettori] Nuova risposta ticket ${input.ticketId}`,
      html: `
        <h2>Nuova risposta utente</h2>
        <p><strong>ID ticket:</strong> ${input.ticketId}</p>
        <p><strong>Nome:</strong> ${updated.name}</p>
        <p><strong>Email:</strong> ${updated.email}</p>
        <p><strong>Messaggio:</strong><br/>${trimmedMessage.replace(/\n/g, "<br/>")}</p>
      `,
    });
  } catch (error) {
    console.error("Errore invio email risposta utente ticket", { ticketId: input.ticketId, error });
  }

  const refreshedTicket = (await getUserSupportTickets(input.userId)).find((item) => item.id === input.ticketId);
  if (!refreshedTicket) {
    throw new Error("Ticket non trovato dopo l'aggiornamento.");
  }

  return refreshedTicket;
}
