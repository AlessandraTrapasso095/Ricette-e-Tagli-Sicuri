"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const recoverySchema = z
  .object({
    password: z.string().min(8, "La nuova password deve contenere almeno 8 caratteri."),
    confirmPassword: z.string().min(8, "Conferma la nuova password."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Le password non coincidono.",
  });

type RecoveryValues = z.infer<typeof recoverySchema>;

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [ready, setReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<RecoveryValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const currentUrl = new URL(window.location.href);
      const hashParams = new URLSearchParams(currentUrl.hash.replace(/^#/, ""));
      const code = currentUrl.searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      let session: Session | null = null;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          session = data.session ?? null;
        }
      } else if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          session = data.session ?? null;
        }
      }

      if (!session) {
        const { data } = await supabase.auth.getSession();
        session = data.session ?? null;
      }

      if (!active) {
        return;
      }

      if (session) {
        window.history.replaceState({}, document.title, currentUrl.pathname);
      }

      setReady(Boolean(session));
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setReady(Boolean(session));
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(values: RecoveryValues) {
    setSaving(true);
    setStatus(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        throw error;
      }

      form.reset();
      setStatus("Password aggiornata correttamente. Ora puoi accedere con la nuova password.");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Impossibile aggiornare la password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-14 sm:px-6 lg:px-8">
      <Card className="w-full">
        <h1 className="font-heading text-3xl text-rose-900">Imposta una nuova password</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Apri il link ricevuto via email e scegli una nuova password per il tuo account.
        </p>

        {ready === null ? (
          <p className="mt-6 text-sm text-zinc-600">Verifica del link in corso...</p>
        ) : ready ? (
          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Nuova password</label>
              <Input type="password" placeholder="********" {...form.register("password")} />
              {form.formState.errors.password ? (
                <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">Conferma password</label>
              <Input type="password" placeholder="********" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword ? (
                <p className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>

            {status ? <p className="text-sm text-zinc-700">{status}</p> : null}

            <Button className="w-full" type="submit" disabled={saving}>
              {saving ? "Aggiornamento..." : "Salva nuova password"}
            </Button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-zinc-600">
              Il link di recupero non è valido oppure è scaduto. Richiedi una nuova email di reset dalla pagina di accesso.
            </p>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
            >
              Torna al login
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
