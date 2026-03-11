import type { ReactNode } from "react";

import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdmin } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
