"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { childProfileSchema } from "@/lib/validation/forms";

type ChildProfileValues = z.infer<typeof childProfileSchema>;

export function ChildProfileForm() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<ChildProfileValues>({
    resolver: zodResolver(childProfileSchema),
    defaultValues: {
      name: "",
      ageMode: "birth_date",
      birthDate: "",
      ageMonths: undefined,
      feedingStyle: "misto",
      allergies: "",
      foodsToAvoid: "",
      foodsIntroduced: "",
      notes: "",
    },
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
        notes: json.data.notes ?? "",
      });
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [form]);

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

  return (
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

        <div>
          <label className="text-sm font-medium text-zinc-700">Note</label>
          <Textarea placeholder="Preferenze o note utili" {...form.register("notes")} />
        </div>

        {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}

        <Button type="submit" disabled={loading}>
          {loading ? "Salvataggio..." : "Salva profilo"}
        </Button>
      </form>
    </Card>
  );
}
