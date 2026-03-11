import { NextResponse } from "next/server";

import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { getPostLoginPath } from "@/server/auth/post-login-path";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse();

  if (!user) {
    return unauthorizedResponse;
  }

  const path = await getPostLoginPath(user.id, user.email);
  return NextResponse.json({ path });
}
