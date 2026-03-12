import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getRequiredEnv } from "@/lib/env";
import { registerSchema } from "@/lib/validation/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendSignupVerificationEmail } from "@/server/auth/transactional-email-service";
import { resolveAppBaseUrl } from "@/server/auth/auth-url";
import { hasCustomEmailTransport } from "@/server/email/transactional-sender";

function buildEmailRedirectTo(request: Request) {
  const baseUrl = resolveAppBaseUrl(request);
  return `${baseUrl}/auth/callback?next=/dashboard&event=signup-confirmed`;
}

type RegisterErrorCode = "EMAIL_ALREADY_REGISTERED" | "INVALID_PASSWORD" | "REGISTRATION_FAILED";

function mapRegisterError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return {
      code: "EMAIL_ALREADY_REGISTERED" as const,
      message: "Utente già iscritto, hai dimenticato la password?",
    };
  }

  if (normalized.includes("password")) {
    return {
      code: "INVALID_PASSWORD" as const,
      message: "La password non rispetta i requisiti richiesti.",
    };
  }

  return {
    code: "REGISTRATION_FAILED" as const,
    message: "Registrazione non riuscita. Riprova tra poco.",
  };
}

function extractActionLinkFromGenerateLinkResponse(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const candidate = data as {
    properties?: {
      action_link?: string;
    };
  };

  return typeof candidate.properties?.action_link === "string" ? candidate.properties.action_link : null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function isEmailAlreadyRegistered(email: string) {
  const admin = createSupabaseAdminClient();
  const normalizedEmail = normalizeEmail(email);
  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profileData?.id) {
    return true;
  }

  // Fallback robusto: alcuni account possono esistere in auth.users ma non essere ancora sincronizzati in profiles.
  let page = 1;
  const perPage = 200;
  const maxPages = 20;

  while (page <= maxPages) {
    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (usersError) {
      throw usersError;
    }

    const users = usersData?.users ?? [];
    if (users.some((user) => normalizeEmail(user.email ?? "") === normalizedEmail)) {
      return true;
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return false;
}

async function fallbackSignupWithSupabaseDefaultEmail(params: {
  email: string;
  password: string;
  fullName: string;
  redirectTo: string;
}) {
  const supabase = createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      emailRedirectTo: params.redirectTo,
      data: {
        full_name: params.fullName,
      },
    },
  });

  if (error) {
    throw error;
  }

  return {
    userId: data.user?.id ?? null,
    usedFallbackEmail: true,
  };
}

async function resendWithSupabaseDefaultEmailTemplate(params: { email: string; redirectTo: string }) {
  const supabase = createClient(getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"), getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.auth.resend({
    email: params.email,
    type: "signup",
    options: {
      emailRedirectTo: params.redirectTo,
    },
  });

  if (error) {
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Input non valido.", code: "REGISTRATION_FAILED" as RegisterErrorCode },
        { status: 400 },
      );
    }

    if (await isEmailAlreadyRegistered(parsed.data.email)) {
      return NextResponse.json(
        { error: "Utente già iscritto, hai dimenticato la password?", code: "EMAIL_ALREADY_REGISTERED" as RegisterErrorCode },
        { status: 409 },
      );
    }

    const redirectTo = buildEmailRedirectTo(request);
    if (!hasCustomEmailTransport()) {
      const fallbackResult = await fallbackSignupWithSupabaseDefaultEmail({
        email: parsed.data.email,
        password: parsed.data.password,
        fullName: parsed.data.fullName,
        redirectTo,
      });

      if (fallbackResult.userId) {
        const admin = createSupabaseAdminClient();
        await admin
          .from("profiles")
          .update({
            full_name: parsed.data.fullName,
          })
          .eq("id", fallbackResult.userId);
      }

      return NextResponse.json({
        data: {
          usedFallbackEmail: true,
        },
      });
    }

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "signup",
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
        },
        redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    const actionLink = extractActionLinkFromGenerateLinkResponse(data);
    if (!actionLink) {
      throw new Error("Impossibile generare il link di conferma email.");
    }

    if (data?.user?.id) {
      await admin
        .from("profiles")
        .update({
          full_name: parsed.data.fullName,
        })
        .eq("id", data.user.id);
    }

    try {
      await sendSignupVerificationEmail({
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        confirmLink: actionLink,
      });
    } catch {
      await resendWithSupabaseDefaultEmailTemplate({
        email: parsed.data.email,
        redirectTo,
      });

      return NextResponse.json({
        data: {
          usedFallbackEmail: true,
        },
      });
    }

    return NextResponse.json({
      data: {
        usedFallbackEmail: false,
      },
    });
  } catch (error) {
    const mapped = error instanceof Error ? mapRegisterError(error.message) : mapRegisterError("unknown_error");
    return NextResponse.json({ error: mapped.message, code: mapped.code }, { status: 400 });
  }
}
