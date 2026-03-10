import { NextResponse } from "next/server";

import { chatPromptSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { generateMenuFromPrompt } from "@/server/chat/menu-service";

export async function POST(request: Request) {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true, requireChatAccess: true });
    if (!user) {
      return unauthorizedResponse;
    }

    const body = await request.json();
    const parsed = chatPromptSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
    }

    const response = await generateMenuFromPrompt({
      userId: user.id,
      prompt: parsed.data.prompt,
      sessionId: parsed.data.sessionId,
      sourceSessionId: parsed.data.sourceSessionId,
      saveMenu: parsed.data.saveMenu,
    });

    return NextResponse.json({ data: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore durante la generazione del menu";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
