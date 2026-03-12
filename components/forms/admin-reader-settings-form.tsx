"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminReaderSettingsFormProps {
  initialReaderDisplayName: string;
}

export function AdminReaderSettingsForm({ initialReaderDisplayName }: AdminReaderSettingsFormProps) {
  const [readerDisplayName, setReaderDisplayName] = useState(initialReaderDisplayName);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saveSettings() {
    setStatusMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          readerDisplayName,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Salvataggio impostazioni non riuscito.");
      }

      setReaderDisplayName(json.data?.displayName ?? readerDisplayName);
      setStatusMessage("Nome visibile ai lettori aggiornato.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Salvataggio impostazioni non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div>
        <label className="text-sm font-medium text-zinc-700">Nome visibile ai lettori</label>
        <Input
          value={readerDisplayName}
          onChange={(event) => setReaderDisplayName(event.target.value)}
          placeholder="Es. Lorena Mariani"
        />
        <p className="mt-1 text-xs text-zinc-500">Questo nome viene mostrato sotto il brand nei layout visibili ai lettori.</p>
      </div>

      {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}

      <Button type="button" disabled={loading} onClick={saveSettings}>
        {loading ? "Salvo..." : "Salva impostazioni"}
      </Button>
    </div>
  );
}
