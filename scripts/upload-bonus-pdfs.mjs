import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";

const SOURCE_ROOT = "/Users/alessandratrapasso/Desktop/Personale/Lavoro/RICETTE E TAGLI SICURI";

const bonusFiles = [
  {
    slug: "ricette-e-tagli-sicuri",
    title: "Bonus PDF - Ricette e Tagli Sicuri",
    description: "Schede pratiche e bonus operativi.",
    filename: "Bonus speciale ricette e tagli sicuri.pdf.pdf",
  },
  {
    slug: "ricette-e-autosvezzamento-felice",
    title: "Bonus PDF - Autosvezzamento Felice",
    description: "Ricette guidate e varianti sicure.",
    filename: "autosvezzamento felice bonus.pdf",
  },
  {
    slug: "ricette-e-svezzamento-classico",
    title: "Bonus PDF - Svezzamento Classico",
    description: "Piano rapido e checklist utili.",
    filename: "svezzamento classico bonus.pdf",
  },
  {
    slug: "colazione-e-merenda",
    title: "Bonus PDF - Colazione e Merenda",
    description: "Ricette veloci e organizzazione settimanale.",
    filename: "bonus colazione e merenda.pdf",
  },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variabile mancante: ${name}`);
  }
  return value;
}

async function ensureBucket(supabase, bucketName) {
  const { data, error } = await supabase.storage.getBucket(bucketName);
  if (!error && data) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucketName, {
    public: false,
    allowedMimeTypes: ["application/pdf"],
    fileSizeLimit: 10 * 1024 * 1024,
  });

  if (createError && !createError.message.includes("already exists")) {
    throw createError;
  }
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const bucket = "bonus-files";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureBucket(supabase, bucket);

  const slugs = bonusFiles.map((item) => item.slug);
  const { data: books, error: booksError } = await supabase.from("books").select("id, slug").in("slug", slugs);
  if (booksError) {
    throw booksError;
  }

  const booksBySlug = new Map((books ?? []).map((book) => [book.slug, book.id]));
  const missing = slugs.filter((slug) => !booksBySlug.has(slug));
  if (missing.length > 0) {
    throw new Error(`Libri non trovati nel database: ${missing.join(", ")}`);
  }

  for (const item of bonusFiles) {
    const sourcePath = path.join(SOURCE_ROOT, item.filename);
    const file = await fs.readFile(sourcePath);
    const storagePath = `${item.slug}/bonus-principale.pdf`;
    const bookId = booksBySlug.get(item.slug);

    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
      contentType: "application/pdf",
      upsert: true,
      cacheControl: "3600",
    });

    if (uploadError) {
      throw new Error(`Upload fallito (${item.slug}): ${uploadError.message}`);
    }

    const { error: upsertError } = await supabase.from("bonus_files").upsert(
      {
        book_id: bookId,
        title: item.title,
        description: item.description,
        storage_bucket: bucket,
        storage_path: storagePath,
        mime_type: "application/pdf",
        is_active: true,
      },
      { onConflict: "book_id,storage_path" },
    );

    if (upsertError) {
      throw new Error(`Upsert DB fallito (${item.slug}): ${upsertError.message}`);
    }

    process.stdout.write(`OK ${item.slug} -> ${storagePath}\n`);
  }

  const { data: bonusRows, error: verifyError } = await supabase
    .from("bonus_files")
    .select("title, storage_path, storage_bucket, is_active, books!inner(slug)")
    .in("books.slug", slugs)
    .order("created_at", { ascending: true });

  if (verifyError) {
    throw verifyError;
  }

  process.stdout.write("\nVerifica bonus_files:\n");
  for (const row of bonusRows ?? []) {
    process.stdout.write(`- ${row.books.slug}: ${row.title} | ${row.storage_bucket}/${row.storage_path}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
