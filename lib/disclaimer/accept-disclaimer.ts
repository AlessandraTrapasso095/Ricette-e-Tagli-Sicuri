import "server-only";

import { DISCLAIMER_VERSION } from "@/config/disclaimer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface AcceptDisclaimerParams {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function extractIpAddress(rawIp: string | null | undefined) {
  if (!rawIp) {
    return null;
  }

  const first = rawIp.split(",")[0]?.trim();
  return first || null;
}

export async function acceptDisclaimer(params: AcceptDisclaimerParams) {
  const admin = createSupabaseAdminClient();

  const payload = {
    user_id: params.userId,
    disclaimer_version: DISCLAIMER_VERSION,
    accepted_at: new Date().toISOString(),
    ip_address: extractIpAddress(params.ipAddress),
    user_agent: params.userAgent ?? null,
  };

  const { error } = await admin.from("disclaimer_acceptances").upsert(payload, {
    onConflict: "user_id,disclaimer_version",
  });

  if (error) {
    throw error;
  }

  return {
    accepted: true,
    version: DISCLAIMER_VERSION,
  };
}
