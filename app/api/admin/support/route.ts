import { NextResponse } from "next/server";

import { adminSupportTicketFiltersSchema, adminSupportTicketUpdateSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse, ensureApiAdminOrResponse } from "@/server/auth/api-auth";
import { getAdminSupportTickets, updateAdminSupportTicketStatus } from "@/server/support/support-service";

export async function GET(request: Request) {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
    if (adminGuard) {
      return adminGuard;
    }

    const searchParams = new URL(request.url).searchParams;
    const parsedFilters = adminSupportTicketFiltersSchema.safeParse({
      status: searchParams.get("status") ?? "all",
      category: searchParams.get("category") ?? "all",
      q: searchParams.get("q") ?? undefined,
    });

    if (!parsedFilters.success) {
      return NextResponse.json({ error: parsedFilters.error.issues[0]?.message ?? "Filtri non validi." }, { status: 400 });
    }

    const tickets = await getAdminSupportTickets({
      status: parsedFilters.data.status === "all" ? undefined : parsedFilters.data.status,
      category: parsedFilters.data.category === "all" ? undefined : parsedFilters.data.category,
      q: parsedFilters.data.q,
    });
    return NextResponse.json({ data: tickets });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore caricamento ticket supporto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
    if (adminGuard) {
      return adminGuard;
    }

    const body = await request.json();
    const parsed = adminSupportTicketUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido." }, { status: 400 });
    }

    const updated = await updateAdminSupportTicketStatus({
      ticketId: parsed.data.ticketId,
      status: parsed.data.status,
      adminNotes: parsed.data.adminNotes,
      replyMessage: parsed.data.replyMessage,
      notifyUser: parsed.data.notifyUser,
      adminUserId: user.id,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore aggiornamento ticket supporto";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
