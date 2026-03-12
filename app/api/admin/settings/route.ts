import { NextResponse } from "next/server";

import { adminReaderSettingsSchema } from "@/lib/validation/forms";
import { ensureApiAdminOrResponse, getApiUserOrResponse } from "@/server/auth/api-auth";
import { getReaderFacingName, updateReaderFacingName } from "@/server/settings/app-settings-service";

export async function GET() {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
    if (adminGuard) {
      return adminGuard;
    }

    const readerDisplayName = await getReaderFacingName();
    return NextResponse.json({ data: { readerDisplayName } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore caricamento impostazioni.";
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
    const parsed = adminReaderSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido." }, { status: 400 });
    }

    const updated = await updateReaderFacingName({
      displayName: parsed.data.readerDisplayName,
      adminUserId: user.id,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore salvataggio impostazioni.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
