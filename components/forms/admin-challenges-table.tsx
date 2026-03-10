"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

interface ChallengeRow {
  id: string;
  page_number: number;
  prompt_text: string;
  is_active: boolean;
  books: {
    id: string;
    slug: string;
    title: string;
  };
}

interface AdminChallengesTableProps {
  initialChallenges: ChallengeRow[];
}

export function AdminChallengesTable({ initialChallenges }: AdminChallengesTableProps) {
  const [rows, setRows] = useState(initialChallenges);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function toggleRow(row: ChallengeRow) {
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/challenges", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: row.id, isActive: !row.is_active }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Errore aggiornamento challenge");
      }

      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, is_active: !item.is_active } : item)));
      setStatusMessage("Stato challenge aggiornato.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore aggiornamento challenge");
    }
  }

  return (
    <Card>
      <CardTitle>Challenge accesso</CardTitle>
      <CardDescription>Attiva/disattiva challenge e monitora la copertura per libro.</CardDescription>

      {statusMessage ? <p className="mt-2 text-sm text-zinc-700">{statusMessage}</p> : null}

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-zinc-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{row.books.title}</p>
            <p className="mt-1 text-sm font-medium text-zinc-800">Pagina {row.page_number}</p>
            <p className="text-sm text-zinc-600">{row.prompt_text}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs font-semibold ${row.is_active ? "text-emerald-700" : "text-zinc-500"}`}>
                {row.is_active ? "Attiva" : "Disattivata"}
              </span>
              <Button variant="secondary" onClick={() => toggleRow(row)}>
                {row.is_active ? "Disattiva" : "Attiva"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
