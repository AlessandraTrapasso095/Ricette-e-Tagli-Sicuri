import { NextResponse } from "next/server";

import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { markUserSupportTicketReplyAsRead } from "@/server/support/support-service";

interface RouteContext {
  params: Promise<{
    ticketId: string;
  }>;
}

export async function POST(_: Request, context: RouteContext) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true, requireSupportAccess: true });
  if (!user) {
    return unauthorizedResponse;
  }

  try {
    const { ticketId } = await context.params;
    const result = await markUserSupportTicketReplyAsRead(ticketId, user.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore aggiornamento ticket.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
