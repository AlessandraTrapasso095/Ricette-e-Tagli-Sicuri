"use client";

import { useState } from "react";

import type { BroadcastHistoryItem } from "@/types/domain";

import { AdminBroadcastForm } from "./admin-broadcast-form";
import { AdminBroadcastHistory } from "./admin-broadcast-history";

interface AdminBroadcastPanelProps {
  initialHistory: BroadcastHistoryItem[];
}

export function AdminBroadcastPanel({ initialHistory }: AdminBroadcastPanelProps) {
  const [history, setHistory] = useState(initialHistory);

  return (
    <div className="mt-3 space-y-5 sm:mt-4 sm:space-y-6">
      <AdminBroadcastForm
        onSent={(entry) => {
          if (!entry) {
            return;
          }

          setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 20));
        }}
      />

      <div className="border-t border-zinc-200 pt-5 sm:pt-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-rose-900 sm:text-lg">Storico comunicazioni</h3>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Elenco delle comunicazioni inviate in precedenza agli utenti.
          </p>
        </div>
        <AdminBroadcastHistory history={history} />
      </div>
    </div>
  );
}
