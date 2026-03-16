import "server-only";

import { toArrayFromCsv } from "@/lib/utils";
import type { ChildProfile } from "@/types/domain";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizeChildProfile(profile: ChildProfile): ChildProfile {
  return {
    ...profile,
    allergies: toArrayFromCsv(profile.allergies ?? []),
    foods_to_avoid: toArrayFromCsv(profile.foods_to_avoid ?? []),
    foods_introduced: toArrayFromCsv(profile.foods_introduced ?? []),
  };
}

export async function getPrimaryChildProfile(userId: string): Promise<ChildProfile | null> {
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("children")
    .select("*")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const profile = Array.isArray(data) ? data[0] : null;
  return profile ? normalizeChildProfile(profile as ChildProfile) : null;
}

export async function savePrimaryChildProfile(params: {
  userId: string;
  name: string;
  ageMode: "birth_date" | "months";
  birthDate?: string;
  ageMonths?: number;
  feedingStyle: "classico" | "autosvezzamento" | "misto";
  allergies?: string;
  foodsToAvoid?: string;
  foodsIntroduced?: string;
  notes?: string;
}) {
  const admin = createSupabaseAdminClient();

  const payload = {
    user_id: params.userId,
    name: params.name,
    age_mode: params.ageMode,
    birth_date: params.ageMode === "birth_date" ? params.birthDate : null,
    age_months: params.ageMode === "months" ? params.ageMonths : null,
    feeding_style: params.feedingStyle,
    allergies: toArrayFromCsv(params.allergies ?? ""),
    foods_to_avoid: toArrayFromCsv(params.foodsToAvoid ?? ""),
    foods_introduced: toArrayFromCsv(params.foodsIntroduced ?? ""),
    notes: params.notes ?? null,
    is_primary: true,
  };

  const { data: existing } = await admin
    .from("children")
    .select("id")
    .eq("user_id", params.userId)
    .eq("is_primary", true)
    .maybeSingle();

  if (existing) {
    const { data, error } = await admin.from("children").update(payload).eq("id", existing.id).select("*").single();

    if (error) {
      throw error;
    }

    return normalizeChildProfile(data as ChildProfile);
  }

  const { data, error } = await admin.from("children").insert(payload).select("*").single();

  if (error) {
    throw error;
  }

  return normalizeChildProfile(data as ChildProfile);
}

export async function deleteChildProfiles(userId: string) {
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("children").delete().eq("user_id", userId);

  if (error) {
    throw error;
  }
}
