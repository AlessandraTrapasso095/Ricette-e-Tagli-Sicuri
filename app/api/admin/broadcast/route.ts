import { NextResponse } from "next/server";

import { adminBroadcastSchema } from "@/lib/validation/forms";
import { sendBroadcastEmail } from "@/server/admin/broadcast-service";
import { ensureApiAdminOrResponse, getApiUserOrResponse } from "@/server/auth/api-auth";

export async function POST(request: Request) {
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
    const parsed = adminBroadcastSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
    }

    const result = await sendBroadcastEmail({
      subject: parsed.data.subject,
      message: parsed.data.message,
      adminUserId: user.id,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invio comunicazione non riuscito";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
