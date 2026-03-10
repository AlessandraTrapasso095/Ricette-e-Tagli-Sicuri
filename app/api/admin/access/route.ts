import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUserOrResponse, ensureApiAdminOrResponse } from "@/server/auth/api-auth";
import { revokeBookAccess } from "@/server/books/book-access-service";

const revokeSchema = z.object({
  targetUserId: z.string().uuid(),
  bookId: z.string().uuid(),
  reason: z.string().max(300).optional(),
});

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
  const parsed = revokeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  await revokeBookAccess({
    adminUserId: user.id,
    targetUserId: parsed.data.targetUserId,
    bookId: parsed.data.bookId,
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true });
}
