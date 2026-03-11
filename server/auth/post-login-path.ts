import "server-only";

import { hasActiveAdminRole } from "@/server/auth/admin-guard";

export async function getPostLoginPath(userId: string, email?: string | null) {
  const isAdmin = await hasActiveAdminRole(userId, email);
  return isAdmin ? "/admin" : "/dashboard";
}
