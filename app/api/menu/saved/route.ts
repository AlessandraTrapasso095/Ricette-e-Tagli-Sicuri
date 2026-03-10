import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { getSavedMenus, saveMenuFromMessage } from "@/server/chat/menu-service";

const saveSchema = z.object({
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  title: z.string().min(3).max(120).optional(),
});

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true, requireChatAccess: true });
  if (!user) {
    return unauthorizedResponse;
  }

  const menus = await getSavedMenus(user.id);
  return NextResponse.json({ data: menus });
}

export async function POST(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true, requireChatAccess: true });
  if (!user) {
    return unauthorizedResponse;
  }

  const body = await request.json();
  const parsed = saveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const saved = await saveMenuFromMessage({
    userId: user.id,
    sessionId: parsed.data.sessionId,
    messageId: parsed.data.messageId,
    title: parsed.data.title,
  });

  return NextResponse.json({ data: saved });
}
