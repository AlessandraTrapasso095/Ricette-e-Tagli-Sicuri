import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/server/email/transactional-sender";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendBroadcastEmail(params: { subject: string; message: string; adminUserId: string }) {
  const admin = createSupabaseAdminClient();

  const { data: profiles, error } = await admin.from("profiles").select("id, email").neq("email", "");
  if (error) {
    throw error;
  }

  const recipients = [...new Set((profiles ?? []).map((profile) => profile.email).filter(Boolean))];
  if (recipients.length === 0) {
    return { recipients: 0 };
  }

  const safeMessageHtml = escapeHtml(params.message).replace(/\n/g, "<br/>");

  for (const email of recipients) {
    await sendTransactionalEmail({
      to: email,
      subject: params.subject,
      html: `<p style="white-space:normal">${safeMessageHtml}</p>`,
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
