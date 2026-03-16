import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserGender } from "@/lib/user-gender";

function isMissingGenderColumn(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };
  const haystack = [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return haystack.includes("gender") && (haystack.includes("column") || haystack.includes("schema cache"));
}

export async function updateProfileSettings(params: {
  userId: string;
  fullName: string;
  displayName: string;
  gender: UserGender;
}) {
  const admin = createSupabaseAdminClient();
  const fullName = params.fullName.trim();
  const displayName = params.displayName.trim();

  const { error } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      display_name: displayName,
      gender: params.gender,
    })
    .eq("id", params.userId);

  if (error && isMissingGenderColumn(error)) {
    const retry = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        display_name: displayName,
      })
      .eq("id", params.userId);

    if (retry.error) {
      throw retry.error;
    }

    return {
      fullName,
      displayName,
      gender: null,
      warning: "Nome aggiornato. Per salvare anche il genere, applica la migration 0010_profiles_gender.sql su Supabase.",
    };
  }

  if (error) {
    throw error;
  }

  return {
    fullName,
    displayName,
    gender: params.gender,
    warning: null,
  };
}
