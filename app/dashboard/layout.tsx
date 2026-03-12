import type { ReactNode } from "react";

import { DisclaimerGate } from "@/components/disclaimer/disclaimer-gate";
import { LogoutButton } from "@/components/dashboard/logout-button";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getDisclaimerStatus } from "@/lib/disclaimer/get-disclaimer-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveConfiguredAppBaseUrl } from "@/server/auth/auth-url";
import { requireUser } from "@/server/auth/session";
import { sendWelcomeEmailOnce } from "@/server/auth/transactional-email-service";

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

  const isEmailConfirmed = Boolean(user.email_confirmed_at);
  const appBaseUrl = resolveConfiguredAppBaseUrl();
  if (isEmailConfirmed && user.email && appBaseUrl) {
    try {
      await sendWelcomeEmailOnce({
        userId: user.id,
        email: user.email,
        fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
        dashboardUrl: `${appBaseUrl}/dashboard`,
      });
    } catch (error) {
      console.error("Welcome email retry non inviata", { userId: user.id, error });
    }
  }

  const disclaimerStatus = await getDisclaimerStatus(user.id);

  return (
    <DisclaimerGate initialAccepted={disclaimerStatus.accepted}>
      <DashboardShell rightTop={<LogoutButton />}>{children}</DashboardShell>
    </DisclaimerGate>
  );
}
