"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/validation/forms";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginValues) {
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        throw error;
      }

      let destination = "/dashboard";
      try {
        const targetResponse = await fetch("/api/auth/post-login-path", {
          method: "GET",
          cache: "no-store",
        });
        if (targetResponse.ok) {
          const targetJson = (await targetResponse.json()) as { path?: string };
          if (targetJson.path === "/admin" || targetJson.path === "/dashboard") {
            destination = targetJson.path;
          }
        }
      } catch {
        destination = "/dashboard";
      }

      router.push(destination);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Credenziali non valide.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-1">
        <label htmlFor="login-email" className="text-sm font-medium text-zinc-700">
          Email
        </label>
        <Input id="login-email" type="email" placeholder="nome@email.it" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="login-password" className="text-sm font-medium text-zinc-700">
          Password
        </label>
        <Input id="login-password" type="password" placeholder="********" {...form.register("password")} />
        {form.formState.errors.password ? (
          <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Accesso in corso..." : "Accedi"}
      </Button>

      <p className="text-center text-sm text-zinc-500">
        Non hai un account?{" "}
        <Link href="/register" className="font-semibold text-rose-600 hover:text-rose-700">
          Registrati ora
        </Link>
      </p>
    </form>
  );
}
