import { NextResponse } from "next/server";

import { chatPromptSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { generateMenuFromPrompt } from "@/server/chat/menu-service";

export async function POST(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const body = await request.json();
  const parsed = chatPromptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  try {
    const response = await generateMenuFromPrompt({
      userId: user.id,
      prompt: parsed.data.prompt,
      sessionId: parsed.data.sessionId,
      saveMenu: parsed.data.saveMenu,
    });

    return NextResponse.json({ data: response });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore durante la generazione del menu";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
