import "server-only";

import { NextResponse } from "next/server";

import { CHAT_ACCESS_REQUIRED_MESSAGE } from "@/config/chat-access";
import { SUPPORT_ACCESS_REQUIRED_MESSAGE } from "@/config/support-access";
import { getDisclaimerStatus } from "@/lib/disclaimer/get-disclaimer-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasActiveAdminRole } from "@/server/auth/admin-guard";
import { getUserChatAccessStatus } from "@/server/chat/chat-access";
import { getUserSupportAccessStatus } from "@/server/support/support-access";

export async function getApiUserOrResponse(options?: {
  requireDisclaimer?: boolean;
  requireChatAccess?: boolean;
  requireSupportAccess?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      unauthorizedResponse: NextResponse.json({ error: "Non autorizzato" }, { status: 401 }),
    };
  }

  if (options?.requireDisclaimer) {
    const disclaimerStatus = await getDisclaimerStatus(user.id);
    if (!disclaimerStatus.accepted) {
      return {
        user: null,
        unauthorizedResponse: NextResponse.json(
          { error: "Devi prima accettare l'avvertenza importante per usare questa funzione." },
          { status: 403 },
        ),
      };
    }
  }

  if (options?.requireChatAccess) {
    const chatAccess = await getUserChatAccessStatus(user.id);
    if (!chatAccess.hasAccess) {
      return {
        user: null,
        unauthorizedResponse: NextResponse.json({ error: CHAT_ACCESS_REQUIRED_MESSAGE }, { status: 403 }),
      };
    }
  }

  if (options?.requireSupportAccess) {
    const supportAccess = await getUserSupportAccessStatus(user.id);
    if (!supportAccess.hasAccess) {
      return {
        user: null,
        unauthorizedResponse: NextResponse.json({ error: SUPPORT_ACCESS_REQUIRED_MESSAGE }, { status: 403 }),
      };
    }
  }

  return {
    user,
    unauthorizedResponse: null,
  };
}

export async function ensureApiAdminOrResponse(userId: string, email?: string | null) {
  const isAdmin = await hasActiveAdminRole(userId, email);

  if (!isAdmin) {
    return NextResponse.json({ error: "Accesso admin richiesto" }, { status: 403 });
  }

  return null;
}
