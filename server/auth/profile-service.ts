import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function ensureUserProfileExists(userId: string) {
  const admin = createSupabaseAdminClient();

  const { data: existingProfile, error: existingError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingProfile) {
    return;
  }

  const { data: authUserResult, error: authUserError } = await admin.auth.admin.getUserById(userId);
  if (authUserError) {
    throw authUserError;
  }

  const user = authUserResult?.user;
  const fallbackEmail = `${userId}@local.invalid`;

  const { error: insertError } = await admin.from("profiles").insert({
    id: userId,
    email: user?.email ?? fallbackEmail,
    full_name: typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
    gender:
      user?.user_metadata?.gender === "maschio" || user?.user_metadata?.gender === "femmina"
        ? user.user_metadata.gender
        : null,
  });

  if (insertError) {
    throw insertError;
  }
}
