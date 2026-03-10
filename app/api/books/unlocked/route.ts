import { NextResponse } from "next/server";

import { getApiUserOrResponse } from "@/server/auth/api-auth";
import { getUserUnlockedBooks } from "@/server/books/book-access-service";

export async function GET() {
  const { user, unauthorizedResponse } = await getApiUserOrResponse({ requireDisclaimer: true });
  if (!user) {
    return unauthorizedResponse;
  }

  const books = await getUserUnlockedBooks(user.id);
  return NextResponse.json({ data: books });
}
