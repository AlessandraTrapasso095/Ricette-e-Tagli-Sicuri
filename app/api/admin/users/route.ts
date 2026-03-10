import { NextResponse } from "next/server";

import { getApiUserOrResponse, ensureApiAdminOrResponse } from "@/server/auth/api-auth";
import { getAdminUsersOverview } from "@/server/admin/admin-service";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id);
  if (adminGuard) {
    return adminGuard;
  }

  const users = await getAdminUsersOverview();
  return NextResponse.json({ data: users });
}
