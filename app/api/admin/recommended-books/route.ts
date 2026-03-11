import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminRecommendedBooks, saveAdminRecommendedBooks } from "@/server/admin/admin-service";
import { ensureApiAdminOrResponse, getApiUserOrResponse } from "@/server/auth/api-auth";

const recommendedBookRowSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().min(3).max(180),
  subtitle: z.string().min(2).max(240),
  url: z.string().url(),
  isActive: z.boolean(),
});

const recommendedBookPayloadSchema = z.object({
  books: z.array(recommendedBookRowSchema).max(100),
});

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
  if (adminGuard) {
    return adminGuard;
  }

  const books = await getAdminRecommendedBooks();
  return NextResponse.json({ data: books });
}

export async function PUT(request: Request) {
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
    const parsed = recommendedBookPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
    }

    const saved = await saveAdminRecommendedBooks(parsed.data.books, user.id);
    return NextResponse.json({ data: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Salvataggio libri consigliati non riuscito";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
