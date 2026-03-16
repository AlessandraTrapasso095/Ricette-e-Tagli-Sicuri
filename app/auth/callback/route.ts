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
  let exchangeUser: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  } | null = null;

  if (code) {
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      exchangeUser = exchangeData.user ?? exchangeData.session?.user ?? null;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const effectiveUser = user ?? exchangeUser;

  if (effectiveUser && event === "signup-confirmed" && effectiveUser.email) {
    const baseUrl = resolveAppBaseUrl(request);
    const dashboardUrl = `${baseUrl}/dashboard`;
    const fullName =
      typeof effectiveUser.user_metadata?.full_name === "string" ? effectiveUser.user_metadata.full_name : null;
    const gender =
      effectiveUser.user_metadata?.gender === "maschio" || effectiveUser.user_metadata?.gender === "femmina"
        ? (effectiveUser.user_metadata.gender as "maschio" | "femmina")
        : null;

    try {
      await sendWelcomeEmailOnce({
        userId: effectiveUser.id,
        email: effectiveUser.email,
        fullName,
        gender,
        dashboardUrl,
      });
    } catch (error) {
      console.error("Welcome email non inviata", { userId: effectiveUser.id, error });
    }
  }

  const fallbackPath = effectiveUser ? await getPostLoginPath(effectiveUser.id, effectiveUser.email) : "/dashboard";
  const next =
    effectiveUser && requestedNext === "/dashboard" && fallbackPath === "/admin"
      ? "/admin"
      : requestedNext ?? fallbackPath;

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
