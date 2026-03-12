import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_INACTIVITY_TIMEOUT_MS, supabaseCookieOptions } from "@/config/auth";

const INACTIVITY_COOKIE_NAME = "rts-last-activity";

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const now = Date.now();
    const lastActivityRaw = request.cookies.get(INACTIVITY_COOKIE_NAME)?.value;

    if (lastActivityRaw) {
      const lastActivity = Number(lastActivityRaw);
      if (Number.isFinite(lastActivity) && now - lastActivity > AUTH_INACTIVITY_TIMEOUT_MS) {
        await supabase.auth.signOut();

        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("reason", "timeout");

        const timeoutResponse = NextResponse.redirect(loginUrl);
        timeoutResponse.cookies.delete(INACTIVITY_COOKIE_NAME);
        return timeoutResponse;
      }
    }

    response.cookies.set(INACTIVITY_COOKIE_NAME, String(now), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

  } else {
    response.cookies.delete(INACTIVITY_COOKIE_NAME);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
