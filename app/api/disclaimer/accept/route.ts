import { NextResponse } from "next/server";

import { acceptDisclaimer } from "@/lib/disclaimer/accept-disclaimer";
import { getApiUserOrResponse } from "@/server/auth/api-auth";

export async function POST(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  try {
    const result = await acceptDisclaimer({
      userId: user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossibile registrare l'accettazione del disclaimer.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
