import { NextResponse } from "next/server";

import { adminBookSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse, ensureApiAdminOrResponse } from "@/server/auth/api-auth";
import { getAdminBooks, upsertAdminBook } from "@/server/admin/admin-service";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id);
  if (adminGuard) {
    return adminGuard;
  }

  const books = await getAdminBooks();
  return NextResponse.json({ data: books });
}

export async function POST(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id);
  if (adminGuard) {
    return adminGuard;
  }

  const body = await request.json();
  const parsed = adminBookSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const result = await upsertAdminBook({
    slug: parsed.data.slug,
    title: parsed.data.title,
    description: parsed.data.description,
    coverUrl: parsed.data.coverUrl,
    challengeMaxAttempts: parsed.data.challengeMaxAttempts,
    challengeCooldownMinutes: parsed.data.challengeCooldownMinutes,
    isActive: parsed.data.isActive ?? true,
  });

  return NextResponse.json({ data: result });
}
