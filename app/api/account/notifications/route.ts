import { NextResponse } from "next/server";

import { notificationPreferencesSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { updateUserNotificationPreferences } from "@/server/account/notification-preferences-service";

export async function PATCH(request: Request) {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true });
    if (!user) {
      return unauthorizedResponse;
    }

    const body = await request.json();
    const parsed = notificationPreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido." }, { status: 400 });
    }

    const preferences = await updateUserNotificationPreferences(user.id, parsed.data);

    return NextResponse.json({
      data: preferences,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore aggiornamento notifiche.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
