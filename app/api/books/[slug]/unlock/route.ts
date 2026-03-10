import { NextResponse } from "next/server";

import { unlockBookSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { attemptBookUnlock } from "@/server/books/book-access-service";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const { slug } = await context.params;
  const body = await request.json();
  const parsed = unlockBookSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const result = await attemptBookUnlock({
    userId: user.id,
    bookSlug: slug,
    challengeId: parsed.data.challengeId,
    answer: parsed.data.answer,
    meta: {
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    },
  });

  if (result.status === "error") {
    return NextResponse.json({ error: result.message, status: result.status }, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
