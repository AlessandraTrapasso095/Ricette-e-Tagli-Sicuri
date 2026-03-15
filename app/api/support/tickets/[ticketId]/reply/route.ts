import { NextResponse } from "next/server";

import { supportTicketReplySchema } from "@/lib/validation/forms";
import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { replyToSupportTicket } from "@/server/support/support-service";

interface RouteContext {
  params: Promise<{
    ticketId: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true, requireSupportAccess: true });
  if (!user) {
    return unauthorizedResponse;
  }

  try {
    const body = await request.json();
    const parsed = supportTicketReplySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido." }, { status: 400 });
    }

    const { ticketId } = await context.params;
    const result = await replyToSupportTicket({
      ticketId,
      userId: user.id,
      message: parsed.data.message,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore invio risposta ticket.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
