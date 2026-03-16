import { NextResponse } from "next/server";

import { childProfileSchema } from "@/lib/validation/forms";
import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { deleteChildProfiles, getPrimaryChildProfile, savePrimaryChildProfile } from "@/server/children/child-service";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true });
  if (!user) {
    return unauthorizedResponse;
  }

  const profile = await getPrimaryChildProfile(user.id);
  return NextResponse.json({ data: profile });
}

export async function POST(request: Request) {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true });
  if (!user) {
    return unauthorizedResponse;
  }

  const body = await request.json();
  const parsed = childProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
  }

  const saved = await savePrimaryChildProfile({
    userId: user.id,
    name: parsed.data.name,
    ageMode: parsed.data.ageMode,
    birthDate: parsed.data.birthDate,
    ageMonths: parsed.data.ageMonths,
    feedingStyle: parsed.data.feedingStyle,
    allergies: parsed.data.allergies,
    foodsToAvoid: parsed.data.foodsToAvoid,
    foodsIntroduced: parsed.data.foodsIntroduced,
    notes: parsed.data.notes,
  });

  return NextResponse.json({ data: saved });
}

export async function DELETE() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true });
  if (!user) {
    return unauthorizedResponse;
  }

  await deleteChildProfiles(user.id);
  return NextResponse.json({ success: true });
}
