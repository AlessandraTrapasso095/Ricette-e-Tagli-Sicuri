import "server-only";

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getApiUserOrResponse() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      unauthorizedResponse: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }),
    };
  }

  return {
    user,
    unauthorizedResponse: null,
  };
}

export async function ensureApiAdminOrResponse(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Accesso admin richiesto" }, { status: 403 });
  }

  return null;
}
