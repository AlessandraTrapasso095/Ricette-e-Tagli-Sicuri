"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AccountPrivacyActions() {
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [confirmDeletion, setConfirmDeletion] = useState(false);

  async function exportData() {
    setExporting(true);
    setExportStatus(null);

    try {
      const response = await fetch("/api/account/privacy/export", {
        method: "GET",
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error ?? "Esportazione dati non riuscita.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const contentDisposition = response.headers.get("Content-Disposition");
      const fileNameMatch = contentDisposition?.match(/filename="([^"]+)"/);
      link.href = downloadUrl;
      link.download = fileNameMatch?.[1] ?? "ricette-tagli-sicuri-export.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setExportStatus("Esportazione completata. Il file JSON è stato scaricato.");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Esportazione dati non riuscita.");
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    if (!confirmDeletion) {
      setDeleteStatus("Conferma prima di voler inviare la richiesta di cancellazione account.");
      return;
    }

    setRequestingDeletion(true);
    setDeleteStatus(null);

    try {
      const response = await fetch("/api/account/privacy/deletion-request", {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Richiesta di cancellazione non riuscita.");
      }

      setDeleteStatus(
        json.data?.alreadyRequested
          ? `Esiste già una richiesta aperta. Ticket: ${json.data.ticketId}.`
          : `Richiesta inviata correttamente. Ticket: ${json.data.ticketId}.`,
      );
      setConfirmDeletion(false);
    } catch (error) {
      setDeleteStatus(error instanceof Error ? error.message : "Richiesta di cancellazione non riuscita.");
    } finally {
      setRequestingDeletion(false);
    }
  }

  return (
    <div className="mt-5 space-y-6">
      <section className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-600">Privacy e dati</h3>
        <p className="text-sm text-zinc-600">
          Puoi esportare una copia dei tuoi dati in formato JSON oppure inviare una richiesta di cancellazione
          account. La cancellazione viene presa in carico manualmente per evitare eliminazioni accidentali.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" variant="secondary" disabled={exporting} onClick={exportData}>
            {exporting ? "Esportazione..." : "Esporta i miei dati"}
          </Button>
          <Button type="button" variant="danger" disabled={requestingDeletion} onClick={requestDeletion}>
            {requestingDeletion ? "Invio richiesta..." : "Richiedi cancellazione account"}
          </Button>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
            checked={confirmDeletion}
            onChange={(event) => setConfirmDeletion(event.target.checked)}
          />
          <span className="text-sm text-zinc-700">
            Confermo di voler inviare una richiesta di cancellazione account e dei dati associati. La richiesta non
            esegue una cancellazione immediata automatica.
          </span>
        </label>

        {exportStatus ? <p className="text-sm text-zinc-700">{exportStatus}</p> : null}
        {deleteStatus ? <p className="text-sm text-zinc-700">{deleteStatus}</p> : null}
      </section>
    </div>
  );
}
