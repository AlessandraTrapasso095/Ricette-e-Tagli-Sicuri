import type { CookieOptionsWithName } from "@supabase/ssr";

const isProd = process.env.NODE_ENV === "production";

export const supabaseCookieOptions: CookieOptionsWithName = {
  name: "rts-auth",
  path: "/",
  sameSite: "lax",
  secure: isProd,
};

export const AUTH_INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
