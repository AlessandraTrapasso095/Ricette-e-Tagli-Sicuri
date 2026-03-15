import "server-only";

import nodemailer from "nodemailer";
import { Resend } from "resend";

import { getEnv } from "@/lib/env";

const DEFAULT_FROM_EMAIL = "ricettetaglisicuri@gmail.com";
const DEFAULT_FROM_NAME = "Ricette e Tagli Sicuri";

interface SendTransactionalEmailParams {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

function hasResendTransport() {
  return Boolean(getEnv("RESEND_API_KEY"));
}

function hasSmtpTransport() {
  return Boolean(getEnv("SMTP_HOST") && getEnv("SMTP_PORT") && getEnv("SMTP_USER") && getEnv("SMTP_PASSWORD"));
}

export function hasCustomEmailTransport() {
  return hasResendTransport() || hasSmtpTransport();
}

function buildFromAddress(transport: "resend" | "smtp") {
  const fromEmail =
    transport === "resend"
      ? getEnv("RESEND_FROM_EMAIL") ?? getEnv("SMTP_FROM_EMAIL") ?? getEnv("SMTP_USER") ?? DEFAULT_FROM_EMAIL
      : getEnv("SMTP_FROM_EMAIL") ?? getEnv("SMTP_USER") ?? getEnv("RESEND_FROM_EMAIL") ?? DEFAULT_FROM_EMAIL;
  const fromName = getEnv("SMTP_FROM_NAME") ?? DEFAULT_FROM_NAME;
  return `${fromName} <${fromEmail}>`;
}

async function sendWithResend(params: SendTransactionalEmailParams) {
  const apiKey = getEnv("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY mancante.");
  }

  const resend = new Resend(apiKey);
  const response = await resend.emails.send({
    from: buildFromAddress("resend"),
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  });

  if (response.error) {
    const message = response.error.message || "Invio email non riuscito tramite Resend.";
    if (message.toLowerCase().includes("api key is invalid")) {
      throw new Error("RESEND_API_KEY non valida. Aggiorna la chiave Resend oppure configura SMTP_PASSWORD per usare Gmail SMTP.");
    }

    throw new Error(message);
  }

  if (!response.data?.id) {
    throw new Error("Resend non ha confermato l'accettazione dell'email.");
  }
}

async function sendWithSmtp(params: SendTransactionalEmailParams) {
  const host = getEnv("SMTP_HOST");
  const portRaw = getEnv("SMTP_PORT");
  const user = getEnv("SMTP_USER");
  const password = getEnv("SMTP_PASSWORD");

  if (!host || !portRaw || !user || !password) {
    throw new Error("Configura SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASSWORD.");
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port)) {
    throw new Error("SMTP_PORT non valido.");
  }

  const secure = getEnv("SMTP_SECURE") ? getEnv("SMTP_SECURE") === "true" : port === 465;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass: password,
    },
  });

  await transporter.sendMail({
    from: buildFromAddress("smtp"),
    to: params.to,
    subject: params.subject,
    html: params.html,
    replyTo: params.replyTo,
  });
}

export async function sendTransactionalEmail(params: SendTransactionalEmailParams) {
  if (hasResendTransport()) {
    try {
      await sendWithResend(params);
      return;
    } catch (error) {
      if (!hasSmtpTransport()) {
        throw error;
      }
    }
  }

  if (hasSmtpTransport()) {
    await sendWithSmtp(params);
    return;
  }

  throw new Error("Nessun provider email configurato (RESEND o SMTP).");
}
