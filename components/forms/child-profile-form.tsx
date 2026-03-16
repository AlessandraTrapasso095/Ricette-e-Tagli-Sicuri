"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { childProfileSchema } from "@/lib/validation/forms";

type ChildProfileValues = z.infer<typeof childProfileSchema>;

const EMPTY_CHILD_PROFILE_VALUES: ChildProfileValues = {
  name: "",
  ageMode: "birth_date",
  birthDate: "",
  ageMonths: undefined,
  feedingStyle: "misto",
  allergies: "",
  foodsToAvoid: "",
  foodsIntroduced: "",
};

export function ChildProfileForm() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const form = useForm<ChildProfileValues>({
    resolver: zodResolver(childProfileSchema),
    defaultValues: EMPTY_CHILD_PROFILE_VALUES,
  });

  const ageMode = form.watch("ageMode");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const response = await fetch("/api/children/profile", { method: "GET" });
      const json = await response.json();

      if (!mounted || !response.ok || !json.data) {
        return;
      }

      form.reset({
        name: json.data.name ?? "",
        ageMode: json.data.age_mode,
        birthDate: json.data.birth_date ?? "",
        ageMonths: json.data.age_months ?? undefined,
        feedingStyle: json.data.feeding_style,
        allergies: (json.data.allergies ?? []).join(", "),
        foodsToAvoid: (json.data.foods_to_avoid ?? []).join(", "),
        foodsIntroduced: (json.data.foods_introduced ?? []).join(", "),
      });
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [form]);

  useEffect(() => {
    if (!showResetConfirm) {
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [showResetConfirm]);

  async function onSubmit(values: ChildProfileValues) {
    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/children/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Errore salvataggio profilo");
      }

      setStatusMessage("Profilo bambino aggiornato con successo.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore salvataggio profilo");
    } finally {
      setLoading(false);
    }
  }

  async function confirmResetProfile() {
    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/children/profile", {
        method: "DELETE",
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Errore reset profilo");
      }

      form.reset(EMPTY_CHILD_PROFILE_VALUES);
      setShowResetConfirm(false);
      setStatusMessage("Profilo bambino resettato con successo.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore reset profilo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card>
        <CardTitle>Profilo bambino</CardTitle>
        <CardDescription>
          Configura il profilo per ricevere menu coerenti con età, stile di svezzamento e preferenze.
        </CardDescription>

        <form className="mt-5 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div>
            <label className="text-sm font-medium text-zinc-700">Nome</label>
            <Input placeholder="Nome bambino" {...form.register("name")} />
            {form.formState.errors.name ? <p className="text-xs text-red-600">{form.formState.errors.name.message}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700">Modalità età</label>
              <Select {...form.register("ageMode")}>
                <option value="birth_date">Data di nascita</option>
                <option value="months">Età in mesi</option>
              </Select>
            </div>
            {ageMode === "birth_date" ? (
              <div>
                <label className="text-sm font-medium text-zinc-700">Data di nascita</label>
                <Input type="date" {...form.register("birthDate")} />
                {form.formState.errors.birthDate ? (
                  <p className="text-xs text-red-600">{form.formState.errors.birthDate.message}</p>
                ) : null}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-zinc-700">Età (mesi)</label>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  {...form.register("ageMonths", {
                    setValueAs: (value) => (value === "" ? undefined : Number(value)),
                  })}
                />
                {form.formState.errors.ageMonths ? (
                  <p className="text-xs text-red-600">{form.formState.errors.ageMonths.message}</p>
                ) : null}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Stile di svezzamento</label>
            <Select {...form.register("feedingStyle")}>
              <option value="classico">Classico</option>
              <option value="autosvezzamento">Autosvezzamento</option>
              <option value="misto">Misto</option>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Allergie/intolleranze (separate da virgola)</label>
            <Input placeholder="es. uovo, frutta secca" {...form.register("allergies")} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Alimenti da evitare (virgola)</label>
            <Input placeholder="es. sale aggiunto" {...form.register("foodsToAvoid")} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700">Alimenti già introdotti (virgola)</label>
            <Input placeholder="es. mela, zucchina" {...form.register("foodsIntroduced")} />
          </div>

          {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}

          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Button className="w-full sm:w-auto" type="submit" disabled={loading}>
              {loading ? "Salvataggio..." : "Salva profilo"}
            </Button>
            <Button
              className="w-full sm:w-auto"
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => setShowResetConfirm(true)}
            >
              Resetta profilo
            </Button>
          </div>
        </form>
      </Card>

      {showResetConfirm ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(255,250,248,0.82)] px-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-child-profile-title"
            className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Conferma reset</p>
            <h3 id="reset-child-profile-title" className="mt-2 font-heading text-2xl font-semibold text-rose-900">
              Resettare il profilo bambino?
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-zinc-700">
              Tutti i campi del profilo bambino verranno svuotati. Potrai inserirli di nuovo in qualsiasi momento.
            </p>

            <div className="mt-5 grid gap-3 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={loading}
                onClick={() => setShowResetConfirm(false)}
              >
                Annulla
              </Button>
              <Button type="button" className="w-full sm:w-auto" disabled={loading} onClick={confirmResetProfile}>
                {loading ? "Reset in corso..." : "Conferma reset"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
