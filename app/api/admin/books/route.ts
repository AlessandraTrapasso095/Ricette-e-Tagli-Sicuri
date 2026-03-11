import { NextResponse } from "next/server";

import { adminBookCreateSchema, adminBookDeleteSchema, adminBookUpdateSchema } from "@/lib/validation/forms";
import { createAdminBook, deleteAdminBook, getAdminBooks, updateAdminBook } from "@/server/admin/admin-service";
import { ensureApiAdminOrResponse, getApiUserOrResponse } from "@/server/auth/api-auth";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
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

  const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
  if (adminGuard) {
    return adminGuard;
  }

  const body = await request.json();
  const parsed = adminBookCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const result = await createAdminBook({
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    link: parsed.data.link,
  });

  return NextResponse.json({ data: result });
}

export async function PATCH(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
  if (adminGuard) {
    return adminGuard;
  }

  const body = await request.json();
  const parsed = adminBookUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  await updateAdminBook({
    bookId: parsed.data.bookId,
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    link: parsed.data.link,
    isActive: parsed.data.isActive,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
  if (adminGuard) {
    return adminGuard;
  }

  const body = await request.json();
  const parsed = adminBookDeleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  await deleteAdminBook(parsed.data.bookId);
  return NextResponse.json({ ok: true });
}
