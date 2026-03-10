"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminBookSchema } from "@/lib/validation/forms";

type AdminBookValues = z.infer<typeof adminBookSchema>;

interface AdminBookFormProps {
  onSaved?: () => void;
}

export function AdminBookForm({ onSaved }: AdminBookFormProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<AdminBookValues>({
    resolver: zodResolver(adminBookSchema),
    defaultValues: {
      slug: "",
      title: "",
      description: "",
      coverUrl: "",
      challengeMaxAttempts: 5,
      challengeCooldownMinutes: 30,
      isActive: true,
    },
  });

  async function onSubmit(values: AdminBookValues) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Errore salvataggio libro");
      }

      setStatus("Libro salvato correttamente.");
      onSaved?.();
      form.reset({
        ...values,
        slug: "",
        title: "",
        description: "",
        coverUrl: "",
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Errore salvataggio libro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardTitle>Nuovo libro / modifica via slug</CardTitle>
      <CardDescription>Inserisci uno slug esistente per aggiornare un libro già presente.</CardDescription>

      <form className="mt-4 grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
        <Input placeholder="Slug (es. ricette-e-tagli-sicuri)" {...form.register("slug")} />
        <Input placeholder="Titolo" {...form.register("title")} />
        <Textarea placeholder="Descrizione" {...form.register("description")} />
        <Input placeholder="URL copertina (opzionale)" {...form.register("coverUrl")} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number"
            min={1}
            max={20}
            placeholder="Tentativi max"
            {...form.register("challengeMaxAttempts", { valueAsNumber: true })}
          />
          <Input
            type="number"
            min={1}
            max={1440}
            placeholder="Cooldown minuti"
            {...form.register("challengeCooldownMinutes", { valueAsNumber: true })}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" className="rounded" {...form.register("isActive")} />
          Libro attivo
        </label>

        {status ? <p className="text-sm text-zinc-700">{status}</p> : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Salvataggio..." : "Salva libro"}
        </Button>
      </form>
    </Card>
  );
}
