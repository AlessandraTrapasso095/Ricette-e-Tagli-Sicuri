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

export function resolveConfiguredAppBaseUrl() {
  const explicit = parseHttpUrl(getEnv("AUTH_REDIRECT_BASE_URL")) ?? parseHttpUrl(getEnv("APP_BASE_URL"));
  return explicit?.origin ?? null;
}

export function resolveAppBaseUrl(request: Request) {
  const explicit = resolveConfiguredAppBaseUrl();
  if (explicit) {
    return explicit;
  }

  return new URL(request.url).origin;
}
