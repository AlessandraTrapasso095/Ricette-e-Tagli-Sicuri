import { NextResponse } from "next/server";

import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { getRandomChallengeForBook } from "@/server/books/book-access-service";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_: Request, context: RouteContext) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const { slug } = await context.params;

  try {
    const challenge = await getRandomChallengeForBook(user.id, slug);
    return NextResponse.json({ data: challenge });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore nel recupero challenge";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
