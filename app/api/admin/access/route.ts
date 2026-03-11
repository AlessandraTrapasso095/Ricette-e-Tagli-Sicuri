import { NextResponse } from "next/server";

import { adminBookAccessSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse, ensureApiAdminOrResponse } from "@/server/auth/api-auth";
import { grantBookAccess, revokeBookAccess } from "@/server/books/book-access-service";

export async function POST(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
  if (adminGuard) {
    return adminGuard;
  }

  const body = await request.json();
  const parsed = adminBookAccessSchema.safeParse(body);

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

export async function PUT(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
  if (adminGuard) {
    return adminGuard;
  }

  const body = await request.json();
  const parsed = adminBookAccessSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  await grantBookAccess({
    adminUserId: user.id,
    targetUserId: parsed.data.targetUserId,
    bookId: parsed.data.bookId,
    reason: parsed.data.reason,
  });

  return NextResponse.json({ ok: true });
}
