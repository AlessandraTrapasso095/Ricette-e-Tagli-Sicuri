"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function AdminBroadcastForm() {
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
          subject,
          message,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Invio email non riuscito.");
      }

      setStatusMessage(`Comunicazione inviata a ${json.data?.recipients ?? 0} utenti.`);
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
      <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Oggetto email" />
      <Textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Messaggio per tutti gli utenti (novità, sconti, comunicazioni)"
        rows={7}
      />
      <p className="text-xs text-zinc-500">Mittente: ricettetaglisicuri@gmail.com</p>
      {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}
      <Button type="button" disabled={loading} onClick={sendBroadcast}>
        {loading ? "Invio..." : "Invia comunicazione a tutti"}
      </Button>
    </div>
  );
}
