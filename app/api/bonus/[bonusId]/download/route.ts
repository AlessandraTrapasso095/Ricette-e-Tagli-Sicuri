import { NextResponse } from "next/server";

import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { generateBonusDownloadUrl } from "@/server/bonus/bonus-service";

interface RouteContext {
  params: Promise<{ bonusId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true });
  if (!user) {
    return unauthorizedResponse;
  }

  const { bonusId } = await context.params;

  try {
    const url = await generateBonusDownloadUrl({
      userId: user.id,
      bonusId,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download non disponibile";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
