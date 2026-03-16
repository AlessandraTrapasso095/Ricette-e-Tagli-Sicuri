import "server-only";

import { getEnv } from "@/lib/env";
import { getWelcomeEmailSubject, getWelcomeParticiple, type OptionalUserGender } from "@/lib/user-gender";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { escapeHtml } from "@/lib/utils";
import { sendTransactionalEmail } from "@/server/email/transactional-sender";
import { getReaderFacingName } from "@/server/settings/app-settings-service";

function sanitizeName(name?: string | null) {
  const clean = name?.trim();
  if (!clean) {
    return "ciao";
  }

  const [firstName] = clean.split(/\s+/);
  return firstName || "ciao";
}

function safeText(value?: string | null) {
  return escapeHtml((value ?? "").trim());
}

function getLogoUrl() {
  const explicitLogoUrl = getEnv("EMAIL_LOGO_URL");
  if (explicitLogoUrl) {
    return explicitLogoUrl;
  }

  const appBaseUrl = getEnv("APP_BASE_URL");
  if (!appBaseUrl) {
    return null;
  }

  return `${appBaseUrl.replace(/\/$/, "")}/brand/logo-ricette-tagli-sicuri.png`;
}

function emailLayout({
  title,
  body,
  ctaLabel,
  ctaHref,
  readerFacingName,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  readerFacingName: string;
}) {
  const logoUrl = getLogoUrl();
  const ctaHtml =
    ctaLabel && ctaHref
      ? `
        <p style="margin: 24px 0 0;">
          <a href="${ctaHref}" style="display:inline-block;background:#e11d48;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">
            ${ctaLabel}
          </a>
        </p>
      `
      : "";

  return `
    <div style="background:#fff7fb;padding:24px 12px;font-family:Arial,sans-serif;color:#3f3f46;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #fbcfe8;border-radius:18px;padding:24px;">
        <table role="presentation" style="border-collapse:collapse;margin:0 0 16px;">
          <tr>
            ${
              logoUrl
                ? `<td style="vertical-align:middle;padding-right:10px;">
              <img src="${logoUrl}" alt="Logo Ricette e Tagli Sicuri" width="40" height="40" style="display:block;border-radius:9999px;" />
            </td>`
                : ""
            }
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:17px;line-height:1.2;color:#881337;font-weight:700;">Ricette e Tagli Sicuri</p>
              <p style="margin:2px 0 0;font-size:12px;line-height:1.2;color:#be185d;">di ${safeText(readerFacingName)}</p>
            </td>
          </tr>
        </table>
        <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#881337;">${safeText(title)}</h1>
        <div style="font-size:15px;line-height:1.7;color:#3f3f46;">${body}</div>
        ${ctaHtml}
        <p style="margin:24px 0 0;font-size:12px;color:#71717a;">
          Se non hai richiesto tu questa operazione, puoi ignorare questa email.
        </p>
      </div>
    </div>
  `;
}

export async function sendSignupVerificationEmail(params: {
  email: string;
  fullName?: string | null;
  gender?: OptionalUserGender;
  confirmLink: string;
}) {
  const readerFacingName = await getReaderFacingName();
  const name = safeText(sanitizeName(params.fullName));
  const safeReaderFacingName = safeText(readerFacingName);
  const body = `
    <p style="margin:0 0 12px;">Ciao ${name},</p>
    <p style="margin:0 0 12px;">
      Conferma la tua email per poter accedere al sito e non perdere i vantaggi esclusivi riservati per te.
    </p>
    <p style="margin:0 0 12px;">
      Clicca sul pulsante qui sotto per confermare il tuo account.
    </p>
    <p style="margin:0;">
      Ti aspetto in piattaforma, un abbraccio<br />
      ${safeReaderFacingName}
    </p>
  `;

  await sendTransactionalEmail({
    to: params.email,
    subject: "Conferma il tuo account - Ricette e Tagli Sicuri",
    html: emailLayout({
      title: "Conferma la tua email",
      body,
      ctaLabel: "Conferma la tua email",
      ctaHref: params.confirmLink,
      readerFacingName,
    }),
  });
}

export async function sendWelcomeEmailOnce(params: {
  userId: string;
  email: string;
  fullName?: string | null;
  gender?: OptionalUserGender;
  dashboardUrl: string;
}) {
  const readerFacingName = await getReaderFacingName();
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("user_email_events")
    .select("id")
    .eq("user_id", params.userId)
    .eq("event_type", "welcome_email")
    .maybeSingle();

  if (existing) {
    return { sent: false, reason: "already_sent" as const };
  }

  const name = safeText(sanitizeName(params.fullName));
  const welcomeWord = getWelcomeParticiple(params.gender ?? null);
  const body = `
    <p style="margin:0 0 12px;">Ciao ${name},</p>
    <p style="margin:0 0 12px;">
      ${welcomeWord} nella tua Area Lettori di Ricette e Tagli Sicuri.
    </p>
    <p style="margin:0;">
      Ora puoi entrare nella dashboard, sbloccare i tuoi libri e accedere ai bonus dedicati.
    </p>
  `;

  await sendTransactionalEmail({
    to: params.email,
    subject: getWelcomeEmailSubject(params.gender ?? null),
    html: emailLayout({
      title: "Account attivato con successo",
      body,
      ctaLabel: "Apri la dashboard",
      ctaHref: params.dashboardUrl,
      readerFacingName,
    }),
  });

  const { error: insertError } = await admin.from("user_email_events").insert({
    user_id: params.userId,
    event_type: "welcome_email",
    payload: {
      email: params.email,
    },
  });

  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  return { sent: true as const };
}
