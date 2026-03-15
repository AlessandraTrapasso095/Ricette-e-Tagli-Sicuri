import { NextResponse } from "next/server";

import { adminBroadcastSchema } from "@/lib/validation/forms";
import { sendBroadcastEmail } from "@/server/admin/broadcast-service";
import { ensureApiAdminOrResponse, getApiUserOrResponse } from "@/server/auth/api-auth";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = "message" in error && typeof error.message === "string" ? error.message.trim() : "";
    const details = "details" in error && typeof error.details === "string" ? error.details.trim() : "";
    const hint = "hint" in error && typeof error.hint === "string" ? error.hint.trim() : "";

    return [message, details, hint].filter(Boolean).join(" ") || "Invio comunicazione non riuscito";
  }

  return "Invio comunicazione non riuscito";
}

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
      category: parsed.data.category,
      subject: parsed.data.subject,
      message: parsed.data.message,
      adminUserId: user.id,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = getErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
