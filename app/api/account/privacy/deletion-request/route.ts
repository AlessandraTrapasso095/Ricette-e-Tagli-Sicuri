import { NextResponse } from "next/server";

import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { requestUserAccountDeletion } from "@/server/account/privacy-service";

export async function POST() {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const result = await requestUserAccountDeletion(user.id);

    return NextResponse.json({
      data: {
        alreadyRequested: result.alreadyRequested,
        ticketId: result.ticketId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossibile registrare la richiesta di cancellazione.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
