"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supportTicketSchema } from "@/lib/validation/forms";

type SupportTicketValues = z.infer<typeof supportTicketSchema>;

interface SupportTicketFormProps {
  userEmail: string;
  userName: string;
  books: { slug: string; title: string }[];
}

export function SupportTicketForm({ userEmail, userName, books }: SupportTicketFormProps) {
  const router = useRouter();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<SupportTicketValues>({
    resolver: zodResolver(supportTicketSchema),
    defaultValues: {
      name: userName,
      email: userEmail,
      category: "altro",
      bookSlug: "",
      message: "",
    },
  });

  async function onSubmit(values: SupportTicketValues) {
    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Errore invio ticket");
      }

      setStatusMessage("Richiesta inviata con successo. Ti risponderemo presto.");
      form.setValue("message", "");
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore invio ticket");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardTitle>Hai bisogno di supporto?</CardTitle>
      <CardDescription>
        Invia una richiesta tecnica relativa al sito: accesso, bonus PDF, chat menu, ticket o problemi di funzionamento.
        Riceverai conferma email e il ticket sarà tracciato in dashboard.
      </CardDescription>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Il supporto e&apos; riservato a richieste tecniche sull&apos;Area Lettori. Per informazioni personali o richieste non legate
        al funzionamento del sito, usa gli altri canali dedicati.
      </div>

      <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700">Nome</label>
            <Input {...form.register("name")} />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Email</label>
            <Input type="email" readOnly aria-readonly="true" className="bg-zinc-50 text-zinc-500" {...form.register("email")} />
            <p className="mt-1 text-xs text-zinc-500">L&apos;email usata per il ticket e&apos; quella verificata del tuo account.</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700">Categoria</label>
            <Select {...form.register("category")}>
              <option value="accesso">Accesso Area Lettori</option>
              <option value="bonus">Bonus PDF</option>
              <option value="chat_menu">Chat Menu</option>
              <option value="tecnico">Problema tecnico</option>
              <option value="altro">Altro</option>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-700">Libro di riferimento</label>
            <Select {...form.register("bookSlug")}>
              <option value="">Non specificato</option>
              {books.map((book) => (
                <option key={book.slug} value={book.slug}>
                  {book.title}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-zinc-700">Messaggio</label>
          <Textarea placeholder="Descrivi la tua richiesta" {...form.register("message")} />
          {form.formState.errors.message ? (
            <p className="text-xs text-red-600">{form.formState.errors.message.message}</p>
          ) : null}
        </div>

        {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Invio..." : "Invia richiesta"}
        </Button>
      </form>
    </Card>
  );
}
