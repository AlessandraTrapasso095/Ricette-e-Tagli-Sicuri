import "server-only";

import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasActiveAdminRole } from "@/server/auth/admin-guard";

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
  const isAdmin = await hasActiveAdminRole(user.id, user.email);

  if (!isAdmin) {
    redirect("/dashboard");
  }

  return user;
}
