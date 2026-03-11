import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPostLoginPath } from "@/server/auth/post-login-path";

function sanitizeNextPath(next: string | null) {
  if (!next) {
    return null;
  }

  if (!next.startsWith("/") || next.startsWith("//")) {
    return null;
  }

  return next;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = sanitizeNextPath(requestUrl.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fallbackPath = user ? await getPostLoginPath(user.id, user.email) : "/dashboard";
  const next =
    user && requestedNext === "/dashboard" && fallbackPath === "/admin"
      ? "/admin"
      : requestedNext ?? fallbackPath;

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
