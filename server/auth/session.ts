import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser(redirectPath = "/login") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(redirectPath);
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();

  const { data: adminRow, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !adminRow) {
    redirect("/dashboard");
  }

  return user;
}
