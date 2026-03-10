"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { adminChallengeSchema } from "@/lib/validation/forms";

type AdminChallengeValues = z.infer<typeof adminChallengeSchema>;

interface AdminChallengeFormProps {
  books: { id: string; title: string }[];
  onSaved?: () => void;
}

export function AdminChallengeForm({ books, onSaved }: AdminChallengeFormProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<AdminChallengeValues>({
    resolver: zodResolver(adminChallengeSchema),
    defaultValues: {
      bookId: books[0]?.id,
      pageNumber: 1,
      promptText: "",
      acceptedAnswer: "",
      isActive: true,
    },
  });

  async function onSubmit(values: AdminChallengeValues) {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Errore creazione challenge");
      }

      setStatus("Challenge creata con successo.");
      onSaved?.();
      form.reset({
        ...values,
        pageNumber: values.pageNumber + 1,
        promptText: "",
        acceptedAnswer: "",
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Errore creazione challenge");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardTitle>Nuova challenge</CardTitle>
      <CardDescription>Aggiungi challenge senza toccare il codice.</CardDescription>

      <form className="mt-4 grid gap-3" onSubmit={form.handleSubmit(onSubmit)}>
        <Select {...form.register("bookId")}>
          {books.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </Select>
        <Input type="number" min={1} placeholder="Numero pagina" {...form.register("pageNumber", { valueAsNumber: true })} />
        <Input placeholder="Testo challenge" {...form.register("promptText")} />
        <Input placeholder="Risposta accettata" {...form.register("acceptedAnswer")} />

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" className="rounded" {...form.register("isActive")} />
          Challenge attiva
        </label>

        {status ? <p className="text-sm text-zinc-700">{status}</p> : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Salvataggio..." : "Salva challenge"}
        </Button>
      </form>
    </Card>
  );
}
