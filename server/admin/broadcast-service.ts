import "server-only";

import { Resend } from "resend";

import { getEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_BROADCAST_FROM = "ricettetaglisicuri@gmail.com";

export async function sendBroadcastEmail(params: { subject: string; message: string; adminUserId: string }) {
  const resendApiKey = getEnv("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("Configura RESEND_API_KEY per inviare email agli utenti.");
  }

  const admin = createSupabaseAdminClient();
  const resend = new Resend(resendApiKey);

  const { data: profiles, error } = await admin.from("profiles").select("id, email").neq("email", "");
  if (error) {
    throw error;
  }

  const recipients = [...new Set((profiles ?? []).map((profile) => profile.email).filter(Boolean))];
  if (recipients.length === 0) {
    return { recipients: 0 };
  }

  const from = DEFAULT_BROADCAST_FROM;

  for (const email of recipients) {
    await resend.emails.send({
      from,
      to: email,
      subject: params.subject,
      html: `<p style="white-space:pre-line">${params.message}</p>`,
    });
  }

  await admin.from("audit_logs").insert({
    actor_user_id: params.adminUserId,
    entity: "broadcast",
    entity_id: null,
    action: "email_broadcast_sent",
    details: {
      subject: params.subject,
      recipients: recipients.length,
    },
  });

  return { recipients: recipients.length };
}
