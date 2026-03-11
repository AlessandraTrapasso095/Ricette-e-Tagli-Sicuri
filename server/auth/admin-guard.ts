import "server-only";

import { isAdminEmail } from "@/config/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function hasActiveAdminRole(userId: string, email?: string | null) {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (!error && data) {
    return true;
  }

  if (!isAdminEmail(email)) {
    return false;
  }

  try {
    const { error: upsertError } = await admin.from("admin_users").upsert(
      {
        user_id: userId,
        role: "admin",
        is_active: true,
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
