import { NextResponse } from "next/server";
import { z } from "zod";

import { adminChallengeSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse, ensureApiAdminOrResponse } from "@/server/auth/api-auth";
import { createAdminChallenge, getAdminChallenges, toggleChallengeStatus } from "@/server/admin/admin-service";

const toggleSchema = z.object({
  challengeId: z.string().uuid(),
  isActive: z.boolean(),
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

  const challenges = await getAdminChallenges();
  return NextResponse.json({ data: challenges });
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
  const parsed = adminChallengeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const created = await createAdminChallenge({
    bookId: parsed.data.bookId,
    pageNumber: parsed.data.pageNumber,
    promptText: parsed.data.promptText,
    acceptedAnswer: parsed.data.acceptedAnswer,
    isActive: parsed.data.isActive ?? true,
    adminUserId: user.id,
  });

  return NextResponse.json({ data: created });
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
  const parsed = toggleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  await toggleChallengeStatus(parsed.data.challengeId, parsed.data.isActive);
  return NextResponse.json({ ok: true });
}
