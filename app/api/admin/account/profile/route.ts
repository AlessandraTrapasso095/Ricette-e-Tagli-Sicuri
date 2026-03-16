import { NextResponse } from "next/server";

import { accountProfileSettingsSchema } from "@/lib/validation/forms";
import { ensureApiAdminOrResponse, getApiUserOrResponse } from "@/server/auth/api-auth";
import { updateProfileSettings } from "@/server/account/profile-settings-service";

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
    const parsed = accountProfileSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido." }, { status: 400 });
    }

    const result = await updateProfileSettings({
      userId: user.id,
      fullName: parsed.data.fullName,
      displayName: parsed.data.displayName,
      gender: parsed.data.gender,
    });

    return NextResponse.json({
      data: {
        fullName: result.fullName,
        displayName: result.displayName,
        gender: result.gender,
        warning: result.warning,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore aggiornamento profilo admin.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
