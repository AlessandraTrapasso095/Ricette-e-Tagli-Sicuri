import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { ensureApiAdminOrResponse, getApiUserOrResponse } from "@/server/auth/api-auth";
import { runDataRetentionCleanup } from "@/server/security/data-retention-service";

export const dynamic = "force-dynamic";

function hasValidInternalSecret(request: Request) {
  const configuredSecret = getEnv("INTERNAL_CRON_SECRET");
  if (!configuredSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;

  return token === configuredSecret;
}

async function executeCleanup(request: Request) {
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";

  let actorUserId: string | null = null;
  let trigger: "internal_secret" | "admin_session" = "internal_secret";

  if (!hasValidInternalSecret(request)) {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const adminResponse = await ensureApiAdminOrResponse(user.id, user.email);
    if (adminResponse) {
      return adminResponse;
    }

    actorUserId = user.id;
    trigger = "admin_session";
  }

  const result = await runDataRetentionCleanup({
    dryRun,
    actorUserId,
  });

  return NextResponse.json({
    data: {
      ...result,
      trigger,
    },
  });
}

export async function GET(request: Request) {
  try {
    return await executeCleanup(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore durante il cleanup dati.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    return await executeCleanup(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore durante il cleanup dati.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
