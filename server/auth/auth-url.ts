import "server-only";

import { getEnv } from "@/lib/env";

function parseHttpUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    parsed.hash = "";
    parsed.search = "";
    return parsed;
  } catch {
    return null;
  }
}

export function resolveAppBaseUrl(request: Request) {
  const explicit = parseHttpUrl(getEnv("AUTH_REDIRECT_BASE_URL")) ?? parseHttpUrl(getEnv("APP_BASE_URL"));
  if (explicit) {
    return explicit.origin;
  }

  return new URL(request.url).origin;
}
