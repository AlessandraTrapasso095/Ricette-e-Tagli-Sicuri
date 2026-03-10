import type { ReactNode } from "react";

import { LogoutButton } from "@/components/dashboard/logout-button";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/server/auth/session";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();

  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: (user.user_metadata?.full_name as string | undefined) ?? null,
    },
    { onConflict: "id" },
  );

  return <DashboardShell rightTop={<LogoutButton />}>{children}</DashboardShell>;
}
