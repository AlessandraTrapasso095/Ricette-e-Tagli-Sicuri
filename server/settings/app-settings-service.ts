import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const READER_FACING_NAME_KEY = "reader_facing_name";
const DEFAULT_READER_FACING_NAME = "Lorena Mariani";

function normalizeReaderName(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length >= 2 ? trimmed : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { displayName?: unknown };
  if (typeof candidate.displayName !== "string") {
    return null;
  }

  const trimmed = candidate.displayName.trim();
  return trimmed.length >= 2 ? trimmed : null;
}

export async function getReaderFacingName() {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("app_settings").select("value").eq("key", READER_FACING_NAME_KEY).maybeSingle();

  return normalizeReaderName(data?.value) ?? DEFAULT_READER_FACING_NAME;
}

export async function updateReaderFacingName(params: { displayName: string; adminUserId: string }) {
  const admin = createSupabaseAdminClient();
  const nextValue = params.displayName.trim();

  if (nextValue.length < 2) {
    throw new Error("Il nome visibile ai lettori deve avere almeno 2 caratteri.");
  }

  const { error } = await admin.from("app_settings").upsert(
    {
      key: READER_FACING_NAME_KEY,
      value: {
        displayName: nextValue,
      },
      description: "Nome mostrato ai lettori nell'header del brand.",
      updated_by: params.adminUserId,
    },
    { onConflict: "key" },
  );

  if (error) {
    throw error;
  }

  return {
    displayName: nextValue,
  };
}
