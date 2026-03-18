import "server-only";

import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { escapeHtml } from "@/lib/utils";
import { sendTransactionalEmail } from "@/server/email/transactional-sender";

const GDPR_DELETE_MARKER = "[GDPR_DELETE_REQUEST]";

export async function exportUserPrivacyData(userId: string) {
  const admin = createSupabaseAdminClient();

  const [
    profile,
    children,
    userBooks,
    bonusDownloads,
    supportTickets,
    menuSessions,
    menuMessages,
    savedMenus,
    accessAttempts,
    disclaimers,
    emailEvents,
    auditLogs,
  ] =
    await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      admin.from("children").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      admin
        .from("user_books")
        .select("book_id, status, unlocked_at, revoked_at, books(title, slug)")
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false }),
      admin.from("bonus_download_logs").select("*").eq("user_id", userId).order("downloaded_at", { ascending: false }),
      admin.from("support_tickets").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      admin.from("menu_sessions").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      admin.from("menu_messages").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      admin.from("saved_menus").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      admin.from("access_attempt_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      admin.from("disclaimer_acceptances").select("*").eq("user_id", userId).order("accepted_at", { ascending: false }),
      admin.from("user_email_events").select("*").eq("user_id", userId).order("sent_at", { ascending: false }),
      admin
        .from("audit_logs")
        .select("*")
        .or(`actor_user_id.eq.${userId},entity_id.eq.${userId}`)
        .order("created_at", { ascending: false }),
    ]);

  await admin.from("audit_logs").insert({
    actor_user_id: userId,
    entity: "privacy_requests",
    entity_id: userId,
    action: "data_export_requested",
    details: {
      format: "json",
      exported_at: new Date().toISOString(),
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    userId,
    profile: profile.data ?? null,
    children: children.data ?? [],
    unlockedBooks: userBooks.data ?? [],
    bonusDownloads: bonusDownloads.data ?? [],
    supportTickets: supportTickets.data ?? [],
    menuSessions: menuSessions.data ?? [],
    menuMessages: menuMessages.data ?? [],
    savedMenus: savedMenus.data ?? [],
    accessAttemptLogs: accessAttempts.data ?? [],
    disclaimerAcceptances: disclaimers.data ?? [],
    userEmailEvents: emailEvents.data ?? [],
    auditLogs: auditLogs.data ?? [],
  };
}

export async function requestUserAccountDeletion(userId: string) {
  const admin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile?.email) {
    throw new Error("Impossibile recuperare il profilo utente per la richiesta privacy.");
  }

  const { data: existing } = await admin
    .from("support_tickets")
    .select("id, status, created_at")
    .eq("user_id", userId)
    .eq("category", "altro")
    .ilike("message", `${GDPR_DELETE_MARKER}%`)
    .in("status", ["inviato", "in_lavorazione"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    return {
      alreadyRequested: true,
      ticketId: existing.id,
    };
  }

  const message = `${GDPR_DELETE_MARKER}
L'utente richiede la cancellazione dell'account e dei dati personali associati.

Richiesta generata dalla sezione Impostazioni > Privacy e dati.
Email account: ${profile.email}`;

  const { data: createdTicket, error: ticketError } = await admin
    .from("support_tickets")
    .insert({
      user_id: userId,
      name: profile.full_name ?? "Utente Area Lettori",
      email: profile.email,
      category: "altro",
      message,
      status: "inviato",
      book_id: null,
    })
    .select("id")
    .single();

  if (ticketError || !createdTicket) {
    throw new Error("Impossibile registrare la richiesta di cancellazione.");
  }

  await admin.from("audit_logs").insert({
    actor_user_id: userId,
    entity: "privacy_requests",
    entity_id: userId,
    action: "account_deletion_requested",
    details: {
      ticket_id: createdTicket.id,
      email: profile.email,
    },
  });

  const supportTarget = getEnv("SUPPORT_TARGET_EMAIL") ?? "ricettetaglisicuri@gmail.com";
  const safeName = escapeHtml(profile.full_name ?? "Utente Area Lettori");
  const safeEmail = escapeHtml(profile.email);

  try {
    await sendTransactionalEmail({
      to: supportTarget,
      subject: `[Privacy] Richiesta cancellazione account ${createdTicket.id}`,
      replyTo: profile.email,
      html: `
        <h2>Richiesta cancellazione account</h2>
        <p><strong>Ticket:</strong> ${createdTicket.id}</p>
        <p><strong>Nome:</strong> ${safeName}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p>Richiesta inserita dalla sezione privacy dell'account.</p>
      `,
    });
  } catch {
    // Non bloccare il workflow utente se l'email di notifica fallisce.
  }

  return {
    alreadyRequested: false,
    ticketId: createdTicket.id,
  };
}
