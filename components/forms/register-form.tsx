"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { registerSchema } from "@/lib/validation/forms";

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      gender: "femmina",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setLoading(true);
    setErrorMessage(null);
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
        return;
      }

      setSuccessMessage(
        "Se l'indirizzo inserito è valido, riceverai un'email per completare la registrazione o per proseguire con l'accesso. Controlla anche nello spam.",
      );
      form.reset();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Registrazione non riuscita.");
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
        <label htmlFor="register-gender" className="text-sm font-medium text-zinc-700">
          Genere
        </label>
        <Select id="register-gender" defaultValue="" {...form.register("gender")}>
          <option value="" disabled>
            Seleziona maschio o femmina
          </option>
          <option value="femmina">Femmina</option>
          <option value="maschio">Maschio</option>
        </Select>
        {form.formState.errors.gender ? (
          <p className="text-xs text-red-600">{form.formState.errors.gender.message}</p>
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
      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creazione account..." : "Crea il tuo account"}
      </Button>

      <p className="text-center text-sm text-zinc-500">
        Hai già un account?{" "}
        <Link href="/login" className="font-semibold text-rose-600 hover:text-rose-700">
          Accedi
        </Link>
      </p>
    </form>
  );
}
