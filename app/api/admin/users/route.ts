import { NextResponse } from "next/server";

import { adminUserMenuResetSchema, adminUserSuspendSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse, ensureApiAdminOrResponse } from "@/server/auth/api-auth";
import { getAdminUsersOverview, resetAdminUserMenuChat, setAdminUserSuspension } from "@/server/admin/admin-service";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();
  if (!user) {
    return unauthorizedResponse;
  }

  const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
  if (adminGuard) {
    return adminGuard;
  }

  const users = await getAdminUsersOverview();
  return NextResponse.json({ data: users });
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
  const parsed = adminUserSuspendSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const result = await setAdminUserSuspension({
    adminUserId: user.id,
    userId: parsed.data.userId,
    duration: parsed.data.duration,
  });

  return NextResponse.json({ data: result });
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
  const parsed = adminUserMenuResetSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const result = await resetAdminUserMenuChat({
    adminUserId: user.id,
    userId: parsed.data.userId,
  });

  return NextResponse.json({ data: result });
}
