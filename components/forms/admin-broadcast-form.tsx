"use client";

import { useState } from "react";

import {
  broadcastAudienceLabels,
  type BroadcastAudienceCategory,
} from "@/config/notification-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BroadcastHistoryItem } from "@/types/domain";

interface AdminBroadcastFormProps {
  onSent?: (entry: BroadcastHistoryItem | null) => void;
}

export function AdminBroadcastForm({ onSent }: AdminBroadcastFormProps) {
  const [category, setCategory] = useState<BroadcastAudienceCategory>("communications");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function sendBroadcast() {
    setStatusMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject,
          message,
        }),
      });
      const rawResponse = await response.text();
      let json: Record<string, unknown> | null = null;

      try {
        json = rawResponse ? (JSON.parse(rawResponse) as Record<string, unknown>) : null;
      } catch {
        json = null;
      }

      if (!response.ok) {
        throw new Error(
          typeof json?.error === "string"
            ? json.error
            : rawResponse || "Invio email non riuscito.",
        );
      }

      const data = (json?.data as Record<string, unknown> | undefined) ?? {};
      const sentRecipients = typeof data.recipients === "number" ? data.recipients : 0;
      const failedRecipients = typeof data.failedRecipients === "number" ? data.failedRecipients : 0;
      const skippedInvalidRecipients = typeof data.skippedInvalidRecipients === "number" ? data.skippedInvalidRecipients : 0;
      const usedPreferencesFallback = data.usedPreferencesFallback === true;
      const statusParts = [`Comunicazione inviata a ${sentRecipients} utenti.`];

      if (skippedInvalidRecipients > 0) {
        statusParts.push(`${skippedInvalidRecipients} email non valide saltate.`);
      }
      if (failedRecipients > 0) {
        statusParts.push(`${failedRecipients} invii non riusciti.`);
      }
      if (usedPreferencesFallback) {
        statusParts.push("Preferenze notifiche non trovate nel database: invio eseguito su tutti i profili con email valida.");
      }

      setStatusMessage(statusParts.join(" "));
      onSent?.((data.historyEntry as BroadcastHistoryItem | null | undefined) ?? null);
      setSubject("");
      setMessage("");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Invio email non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 grid gap-3">
      <div>
        <label className="text-sm font-medium text-zinc-700">Tipo comunicazione</label>
        <select
          value={category}
          className="mt-1 h-12 w-full rounded-2xl border border-rose-100 bg-white px-4 text-sm text-zinc-800 outline-none transition focus:border-rose-400"
          onChange={(event) => setCategory(event.target.value as BroadcastAudienceCategory)}
        >
          {Object.entries(broadcastAudienceLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Oggetto email" />
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Messaggio per tutti gli utenti (novità, sconti, comunicazioni)"
        rows={7}
      />
      <p className="text-xs text-zinc-500">Mittente: ricettetaglisicuri@gmail.com</p>
      <p className="text-xs text-zinc-500">La spedizione rispetta le preferenze salvate dagli utenti nelle impostazioni notifiche.</p>
      {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}
      <Button type="button" disabled={loading} onClick={sendBroadcast}>
        {loading ? "Invio..." : "Invia comunicazione a tutti"}
      </Button>
    </div>
  );
}
