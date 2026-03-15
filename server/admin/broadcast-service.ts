import "server-only";

import { broadcastAudienceLabels, type BroadcastAudienceCategory } from "@/config/notification-preferences";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/server/email/transactional-sender";
import type { BroadcastHistoryItem } from "@/types/domain";

interface BroadcastAuditLogRow {
  id: number;
  created_at: string;
  details: {
    category?: string;
    categoryLabel?: string;
    subject?: string;
    recipients?: number;
    message?: string;
  } | null;
}

function formatUnknownError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const maybeMessage = "message" in error && typeof error.message === "string" ? error.message.trim() : "";
    const maybeDetails = "details" in error && typeof error.details === "string" ? error.details.trim() : "";
    const maybeHint = "hint" in error && typeof error.hint === "string" ? error.hint.trim() : "";

    const parts = [maybeMessage, maybeDetails, maybeHint].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" ");
    }
  }

  return fallback;
}

function isMissingNotificationPreferenceColumn(error: unknown) {
  const message = formatUnknownError(error, "").toLowerCase();
  return (
    message.includes("receive_communications") ||
    message.includes("receive_promotions") ||
    message.includes("column") && message.includes("does not exist")
  );
}

function isValidRecipientEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || trimmed.endsWith("@local.invalid")) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function mapBroadcastAuditRow(row: BroadcastAuditLogRow): BroadcastHistoryItem | null {
  const category = row.details?.category === "promotions" ? "promotions" : "communications";
  const subject = typeof row.details?.subject === "string" ? row.details.subject.trim() : "";

  if (!subject) {
    return null;
  }

  return {
    id: row.id,
    sentAt: row.created_at,
    category,
    categoryLabel: row.details?.categoryLabel ?? broadcastAudienceLabels[category],
    subject,
    recipients: typeof row.details?.recipients === "number" ? row.details.recipients : 0,
    message: typeof row.details?.message === "string" && row.details.message.trim() ? row.details.message.trim() : null,
  };
}

export async function getBroadcastHistory(limit = 20) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("audit_logs")
    .select("id, created_at, details")
    .eq("entity", "broadcast")
    .eq("action", "email_broadcast_sent")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return ((data ?? []) as BroadcastAuditLogRow[])
    .map((row) => mapBroadcastAuditRow(row))
    .filter((row): row is BroadcastHistoryItem => row !== null);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBroadcastEmail(params: {
  subject: string;
  message: string;
  adminUserId: string;
  category: BroadcastAudienceCategory;
}) {
  const admin = createSupabaseAdminClient();
  const audienceColumn =
    params.category === "promotions" ? "receive_promotions" : "receive_communications";

  let profiles:
    | {
        id: string;
        email: string | null;
      }[]
    | null = null;
  let usedPreferencesFallback = false;

  {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email")
      .neq("email", "")
      .eq(audienceColumn, true);

    if (error) {
      if (isMissingNotificationPreferenceColumn(error)) {
        usedPreferencesFallback = true;
        const fallbackQuery = await admin
          .from("profiles")
          .select("id, email")
          .neq("email", "");

        if (fallbackQuery.error) {
          throw new Error(formatUnknownError(fallbackQuery.error, "Impossibile caricare i destinatari della comunicazione."));
        }

        profiles = fallbackQuery.data;
      } else {
        throw new Error(formatUnknownError(error, "Impossibile caricare i destinatari della comunicazione."));
      }
    } else {
      profiles = data;
    }
  }

  const rawRecipients = [...new Set((profiles ?? []).map((profile) => profile.email?.trim()).filter(Boolean))] as string[];
  const recipients = rawRecipients.filter((email) => isValidRecipientEmail(email));
  const skippedInvalidRecipients = rawRecipients.length - recipients.length;

  if (recipients.length === 0) {
    throw new Error(
      skippedInvalidRecipients > 0
        ? "Nessun destinatario valido: alcuni profili hanno email mancanti o non valide."
        : "Nessun destinatario disponibile per questa comunicazione.",
    );
  }

  const safeMessageHtml = escapeHtml(params.message).replace(/\n/g, "<br/>");
  let sentRecipients = 0;
  let failedRecipients = 0;
  let lastErrorMessage: string | null = null;

  for (const email of recipients) {
    try {
      await sendTransactionalEmail({
        to: email,
        subject: params.subject,
        html: `<p style="white-space:normal">${safeMessageHtml}</p>`,
      });
      sentRecipients += 1;
    } catch (error) {
      failedRecipients += 1;
      lastErrorMessage = error instanceof Error ? error.message : "Invio email non riuscito.";
    }
  }

  if (sentRecipients === 0) {
    throw new Error(lastErrorMessage ?? "Nessuna email inviata. Verifica provider e mittente.");
  }

  const { data: auditRow } = await admin
    .from("audit_logs")
    .insert({
      actor_user_id: params.adminUserId,
      entity: "broadcast",
      entity_id: null,
      action: "email_broadcast_sent",
      details: {
        category: params.category,
        categoryLabel: broadcastAudienceLabels[params.category],
        subject: params.subject,
        recipients: sentRecipients,
        message: params.message,
        failedRecipients,
        skippedInvalidRecipients,
        usedPreferencesFallback,
      },
    })
    .select("id, created_at, details")
    .single();

  return {
    recipients: sentRecipients,
    failedRecipients,
    skippedInvalidRecipients,
    usedPreferencesFallback,
    historyEntry: auditRow ? mapBroadcastAuditRow(auditRow as BroadcastAuditLogRow) : null,
  };
}
