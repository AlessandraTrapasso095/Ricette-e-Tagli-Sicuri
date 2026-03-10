import { NextResponse } from "next/server";

import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { getMenuSessions, getSessionMessages } from "@/server/chat/menu-service";

export async function GET(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  if (sessionId) {
    const messages = await getSessionMessages(user.id, sessionId);
    return NextResponse.json({ data: messages });
  }

  const sessions = await getMenuSessions(user.id);
  return NextResponse.json({ data: sessions });
}
