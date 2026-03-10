import "server-only";

import { DISCLAIMER_VERSION } from "@/config/disclaimer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface DisclaimerStatus {
  accepted: boolean;
  acceptedAt: string | null;
  version: string;
}

export async function getDisclaimerStatus(userId: string): Promise<DisclaimerStatus> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("disclaimer_acceptances")
    .select("accepted_at")
    .eq("user_id", userId)
    .eq("disclaimer_version", DISCLAIMER_VERSION)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    accepted: Boolean(data?.accepted_at),
    acceptedAt: data?.accepted_at ?? null,
    version: DISCLAIMER_VERSION,
  };
}
