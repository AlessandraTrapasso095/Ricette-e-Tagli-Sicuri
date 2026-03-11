import { NextResponse } from "next/server";
import { z } from "zod";

import { adminBonusDeleteSchema, adminBonusStatusSchema } from "@/lib/validation/forms";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { deleteAdminBonusFile, getAdminBonusFiles, toggleAdminBonusStatus, upsertAdminBonusFile } from "@/server/admin/admin-service";
import { ensureApiAdminOrResponse, getApiUserOrResponse } from "@/server/auth/api-auth";

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

const multipartBonusSchema = z.object({
  id: z.string().uuid().optional(),
  bookId: z.string().uuid("Libro non valido."),
  title: z.string().min(3, "Titolo troppo breve.").max(140, "Titolo troppo lungo."),
  description: z.string().max(2000, "Descrizione troppo lunga.").optional(),
  isActive: z.boolean(),
});

export async function GET() {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
    if (adminGuard) {
      return adminGuard;
    }

    const bonus = await getAdminBonusFiles();
    return NextResponse.json({ data: bonus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore caricamento bonus";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
    if (adminGuard) {
      return adminGuard;
    }

    const formData = await request.formData();
    const id = formData.get("id");
    const bookId = formData.get("bookId");
    const title = formData.get("title");
    const description = formData.get("description");
    const isActiveRaw = formData.get("isActive");
    const file = formData.get("file");

    const parsed = multipartBonusSchema.safeParse({
      id: typeof id === "string" && id.length > 0 ? id : undefined,
      bookId: typeof bookId === "string" ? bookId : "",
      title: typeof title === "string" ? title : "",
      description: typeof description === "string" ? description : undefined,
      isActive: isActiveRaw === "true",
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
    }

    let uploadedPath: string | undefined;
    let mimeType: string | undefined;

    if (file instanceof File && file.size > 0) {
      const admin = createSupabaseAdminClient();
      const { data: book, error: bookError } = await admin.from("books").select("slug").eq("id", parsed.data.bookId).single();

      if (bookError || !book) {
        return NextResponse.json({ error: "Libro non valido per upload bonus." }, { status: 400 });
      }

      const safeFileName = sanitizeFileName(file.name || "bonus.pdf");
      uploadedPath = `${book.slug}/${Date.now()}-${safeFileName}`;
      mimeType = file.type || "application/pdf";

      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await admin.storage.from("bonus-files").upload(uploadedPath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

      if (uploadError) {
        return NextResponse.json({ error: "Upload PDF non riuscito." }, { status: 400 });
      }
    }

    const result = await upsertAdminBonusFile({
      id: parsed.data.id,
      bookId: parsed.data.bookId,
      title: parsed.data.title,
      description: parsed.data.description,
      storageBucket: "bonus-files",
      storagePath: uploadedPath,
      mimeType,
      isActive: parsed.data.isActive,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore salvataggio bonus";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
    if (adminGuard) {
      return adminGuard;
    }

    const body = await request.json();
    const parsed = adminBonusStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
    }

    await toggleAdminBonusStatus(parsed.data.bonusId, parsed.data.isActive);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore aggiornamento bonus";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, unauthorizedResponse } = await getApiUserOrResponse();
    if (!user) {
      return unauthorizedResponse;
    }

    const adminGuard = await ensureApiAdminOrResponse(user.id, user.email);
    if (adminGuard) {
      return adminGuard;
    }

    const body = await request.json();
    const parsed = adminBonusDeleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input non valido" }, { status: 400 });
    }

    await deleteAdminBonusFile(parsed.data.bonusId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Errore eliminazione bonus";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
