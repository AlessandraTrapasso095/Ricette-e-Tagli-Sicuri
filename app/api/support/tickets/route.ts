import { NextResponse } from "next/server";

import { supportTicketSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { createSupportTicket, getUserSupportTickets } from "@/server/support/support-service";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const tickets = await getUserSupportTickets(user.id);
  return NextResponse.json({ data: tickets });
}

export async function POST(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const body = await request.json();
  const parsed = supportTicketSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const ticket = await createSupportTicket({
    userId: user.id,
    name: parsed.data.name,
    email: parsed.data.email,
    category: parsed.data.category,
    message: parsed.data.message,
    bookSlug: parsed.data.bookSlug,
  });

  return NextResponse.json({ data: ticket });
}
