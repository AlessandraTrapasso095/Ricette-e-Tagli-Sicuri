"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthAuthButtons } from "@/components/forms/oauth-auth-buttons";
import { registerSchema } from "@/lib/validation/forms";

type RegisterValues = z.infer<typeof registerSchema>;
type RegisterErrorCode = "EMAIL_ALREADY_REGISTERED" | "INVALID_PASSWORD" | "REGISTRATION_FAILED";

export function RegisterForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<RegisterErrorCode | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setLoading(true);
    setErrorMessage(null);
    setErrorCode(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await response.json();

      if (!response.ok) {
        setErrorMessage(json.error ?? "Registrazione non riuscita.");
        setErrorCode(typeof json.code === "string" ? (json.code as RegisterErrorCode) : null);
        return;
      }

      setSuccessMessage(
        json.data?.usedFallbackEmail
          ? "Registrazione completata. Controlla la tua email per verificare l'account."
          : "Registrazione completata. Ti abbiamo inviato un'email di conferma.",
      );
      form.reset();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Registrazione non riuscita.");
      setErrorCode(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-1">
        <label htmlFor="register-fullname" className="text-sm font-medium text-zinc-700">
          Nome e cognome
        </label>
        <Input id="register-fullname" placeholder="Mario Rossi" {...form.register("fullName")} />
        {form.formState.errors.fullName ? (
          <p className="text-xs text-red-600">{form.formState.errors.fullName.message}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="register-email" className="text-sm font-medium text-zinc-700">
          Email
        </label>
        <Input id="register-email" type="email" placeholder="nome@email.it" {...form.register("email")} />
        {form.formState.errors.email ? (
          <p className="text-xs text-red-600">{form.formState.errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="register-password" className="text-sm font-medium text-zinc-700">
          Password
        </label>
        <Input id="register-password" type="password" placeholder="********" {...form.register("password")} />
        {form.formState.errors.password ? (
          <p className="text-xs text-red-600">{form.formState.errors.password.message}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="register-confirm-password" className="text-sm font-medium text-zinc-700">
          Conferma password
        </label>
        <Input
          id="register-confirm-password"
          type="password"
          placeholder="********"
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-xs text-red-600">{form.formState.errors.confirmPassword.message}</p>
        ) : null}
      </div>

      {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
      {errorCode === "EMAIL_ALREADY_REGISTERED" ? (
        <p className="text-sm text-rose-700">
          Vai su{" "}
          <Link href="/login" className="font-semibold text-rose-700 underline hover:text-rose-800">
            Accedi
          </Link>{" "}
          e usa il reset password.
        </p>
      ) : null}
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creazione account..." : "Crea il tuo account"}
      </Button>

      <OAuthAuthButtons mode="register" />

      <p className="text-center text-sm text-zinc-500">
        Hai già un account?{" "}
        <Link href="/login" className="font-semibold text-rose-600 hover:text-rose-700">
          Accedi
        </Link>
      </p>
    </form>
  );
}
