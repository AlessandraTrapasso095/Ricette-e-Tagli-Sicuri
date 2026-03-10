import { NextResponse } from "next/server";

import { getApiUserOrResponse, ensureApiAdminOrResponse } from "@/server/auth/api-auth";
import { getAdminSupportTickets } from "@/server/support/support-service";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id);
  if (adminGuard) {
    return adminGuard;
  }

  const tickets = await getAdminSupportTickets();
  return NextResponse.json({ data: tickets });
}
