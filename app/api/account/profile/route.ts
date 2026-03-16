import { NextResponse } from "next/server";

import { accountProfileSettingsSchema } from "@/lib/validation/forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getApiUserOrResponse } from "@/server/auth/api-auth";

export async function PATCH(request: Request) {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true });
    if (!user) {
      return unauthorizedResponse;
    }

    const body = await request.json();
    const parsed = accountProfileSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName.trim(),
        display_name: parsed.data.displayName.trim(),
        gender: parsed.data.gender,
      })
      .eq("id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: {
        fullName: parsed.data.fullName.trim(),
        displayName: parsed.data.displayName.trim(),
        gender: parsed.data.gender,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore aggiornamento profilo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
