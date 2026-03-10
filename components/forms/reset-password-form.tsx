"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const resetSchema = z.object({
  email: z.email("Inserisci una email valida."),
});

type ResetValues = z.infer<typeof resetSchema>;

export function ResetPasswordForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResetValues) {
    setLoading(true);
    setStatus(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/login`;

      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      setStatus("Ti abbiamo inviato le istruzioni per il reset password.");
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile inviare il reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mt-6 rounded-2xl border border-rose-100 bg-rose-50/50 p-4" onSubmit={form.handleSubmit(onSubmit)}>
      <p className="mb-3 text-sm font-medium text-rose-800">Password dimenticata?</p>
      <div className="space-y-2">
        <Input type="email" placeholder="Inserisci la tua email" {...form.register("email")} />
        {form.formState.errors.email ? <p className="text-xs text-red-600">{form.formState.errors.email.message}</p> : null}
      </div>

      {status ? <p className="mt-2 text-xs text-zinc-600">{status}</p> : null}

      <Button type="submit" variant="secondary" className="mt-3 w-full" disabled={loading}>
        {loading ? "Invio in corso..." : "Invia link reset"}
      </Button>
    </form>
  );
}
