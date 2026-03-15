"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import type { BroadcastHistoryItem } from "@/types/domain";

interface AdminBroadcastHistoryProps {
  history: BroadcastHistoryItem[];
}

export function AdminBroadcastHistory({ history }: AdminBroadcastHistoryProps) {
  const [openItemId, setOpenItemId] = useState<number | null>(history[0]?.id ?? null);

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        Nessuna comunicazione inviata finora.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item) => {
        const isOpen = openItemId === item.id;

        return (
          <div key={item.id} className="rounded-2xl border border-zinc-200">
            <button
              type="button"
              className="flex w-full flex-wrap items-start justify-between gap-3 p-4 text-left"
              onClick={() => setOpenItemId((current) => (current === item.id ? null : item.id))}
            >
              <div>
                <p className="text-base font-semibold text-zinc-900">{item.subject}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Inviata il {new Date(item.sentAt).toLocaleString("it-IT")} • {item.recipients} destinatari
                </p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-rose-700">
                  {isOpen ? "Nascondi contenuto" : "Apri contenuto"}
                </p>
              </div>
              <Badge variant={item.category === "promotions" ? "warning" : "neutral"}>{item.categoryLabel}</Badge>
            </button>

            {isOpen ? (
              <div className="border-t border-zinc-200 px-4 py-4">
                <div className="rounded-2xl bg-zinc-50 p-4 text-sm leading-6 whitespace-pre-wrap text-zinc-700">
                  {item.message ?? "Contenuto non disponibile per questa comunicazione storica."}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
