import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAppBaseUrl } from "@/server/auth/auth-url";
import { sendWelcomeEmailOnce } from "@/server/auth/transactional-email-service";
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
  const event = requestUrl.searchParams.get("event");
  const supabase = await createSupabaseServerClient();

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && event === "signup-confirmed" && user.email) {
    const baseUrl = resolveAppBaseUrl(request);
    const dashboardUrl = `${baseUrl}/dashboard`;
    const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;

    try {
      await sendWelcomeEmailOnce({
        userId: user.id,
        email: user.email,
        fullName,
        dashboardUrl,
      });
    } catch (error) {
      console.error("Welcome email non inviata", { userId: user.id, error });
    }
  }

  const fallbackPath = user ? await getPostLoginPath(user.id, user.email) : "/dashboard";
  const next =
    user && requestedNext === "/dashboard" && fallbackPath === "/admin"
      ? "/admin"
      : requestedNext ?? fallbackPath;

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
