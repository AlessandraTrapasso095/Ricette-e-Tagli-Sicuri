"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SupportTicketStatus = "inviato" | "in_lavorazione" | "risolto" | "chiuso";
type SupportTicketCategory = "accesso" | "bonus" | "chat_menu" | "tecnico" | "altro";
type StatusFilter = "all" | SupportTicketStatus;
type CategoryFilter = "all" | SupportTicketCategory;

interface AdminSupportTicketRow {
  id: string;
  name: string;
  email: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  message: string;
  created_at: string;
  admin_notes: string | null;
  books: {
    slug: string;
    title: string;
  } | null;
}

interface AdminSupportTicketsTableProps {
  initialTickets: AdminSupportTicketRow[];
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tutti gli stati" },
  { value: "inviato", label: "Inviato" },
  { value: "in_lavorazione", label: "In lavorazione" },
  { value: "risolto", label: "Risolto" },
  { value: "chiuso", label: "Chiuso" },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "Tutte le categorie" },
  { value: "accesso", label: "Accesso" },
  { value: "bonus", label: "Bonus" },
  { value: "chat_menu", label: "Chat menu" },
  { value: "tecnico", label: "Tecnico" },
  { value: "altro", label: "Altro" },
];

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  inviato: "Inviato",
  in_lavorazione: "In lavorazione",
  risolto: "Risolto",
  chiuso: "Chiuso",
};

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  accesso: "Accesso",
  bonus: "Bonus",
  chat_menu: "Chat menu",
  tecnico: "Tecnico",
  altro: "Altro",
};

const STATUS_BADGE_STYLES: Record<SupportTicketStatus, string> = {
  inviato: "bg-amber-100 text-amber-800",
  in_lavorazione: "bg-sky-100 text-sky-800",
  risolto: "bg-emerald-100 text-emerald-800",
  chiuso: "bg-zinc-200 text-zinc-700",
};

export function AdminSupportTicketsTable({ initialTickets }: AdminSupportTicketsTableProps) {
  const [tickets, setTickets] = useState(initialTickets);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [statusSelectionByTicket, setStatusSelectionByTicket] = useState<Record<string, SupportTicketStatus>>(
    Object.fromEntries(initialTickets.map((ticket) => [ticket.id, ticket.status])) as Record<string, SupportTicketStatus>,
  );
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState<string | null>(null);
  const [replyByTicket, setReplyByTicket] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  function syncSelections(nextTickets: AdminSupportTicketRow[]) {
    setStatusSelectionByTicket(
      Object.fromEntries(nextTickets.map((ticket) => [ticket.id, ticket.status])) as Record<string, SupportTicketStatus>,
    );
  }

  async function loadTickets() {
    setLoadingFilters(true);
    setStatusMessage(null);

    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      params.set("category", categoryFilter);
      if (query.trim()) {
        params.set("q", query.trim());
      }

      const response = await fetch(`/api/admin/support?${params.toString()}`, { method: "GET" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Errore caricamento ticket.");
      }

      const nextTickets = (json.data ?? []) as AdminSupportTicketRow[];
      setTickets(nextTickets);
      syncSelections(nextTickets);
      setStatusMessage(`Ticket trovati: ${nextTickets.length}`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore caricamento ticket.");
    } finally {
      setLoadingFilters(false);
    }
  }

  async function resetFilters() {
    setStatusFilter("all");
    setCategoryFilter("all");
    setQuery("");
    setLoadingFilters(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/support", { method: "GET" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Errore reset filtri.");
      }

      const nextTickets = (json.data ?? []) as AdminSupportTicketRow[];
      setTickets(nextTickets);
      syncSelections(nextTickets);
      setStatusMessage("Filtri azzerati.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore reset filtri.");
    } finally {
      setLoadingFilters(false);
    }
  }

  async function updateTicketStatus(ticket: AdminSupportTicketRow) {
    const nextStatus = statusSelectionByTicket[ticket.id] ?? ticket.status;
    if (nextStatus === ticket.status) {
      setStatusMessage("Seleziona uno stato diverso prima di aggiornare.");
      return;
    }

    setUpdatingTicketId(ticket.id);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          status: nextStatus,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Aggiornamento ticket non riuscito.");
      }

      setTickets((prev) => prev.map((row) => (row.id === ticket.id ? { ...row, status: nextStatus } : row)));
      setStatusMessage("Stato ticket aggiornato.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Aggiornamento ticket non riuscito.");
    } finally {
      setUpdatingTicketId(null);
    }
  }

  async function replyAndClose(ticket: AdminSupportTicketRow) {
    const reply = (replyByTicket[ticket.id] ?? "").trim();
    if (!reply) {
      setStatusMessage("Scrivi una risposta prima di inviare.");
      return;
    }

    setUpdatingTicketId(ticket.id);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          status: "chiuso",
          replyMessage: reply,
          notifyUser: true,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Invio risposta non riuscito.");
      }

      setTickets((prev) =>
        prev.map((row) =>
          row.id === ticket.id
            ? {
                ...row,
                status: "chiuso",
                admin_notes: json.data?.admin_notes ?? row.admin_notes,
              }
            : row,
        ),
      );
      setStatusSelectionByTicket((prev) => ({ ...prev, [ticket.id]: "chiuso" }));
      setReplyByTicket((prev) => ({ ...prev, [ticket.id]: "" }));
      setStatusMessage("Risposta inviata via email e ticket chiuso.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Invio risposta non riuscito.");
    } finally {
      setUpdatingTicketId(null);
    }
  }

  async function replyOnly(ticket: AdminSupportTicketRow) {
    const reply = (replyByTicket[ticket.id] ?? "").trim();
    if (!reply) {
      setStatusMessage("Scrivi una risposta prima di inviare.");
      return;
    }

    setUpdatingTicketId(ticket.id);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          status: "in_lavorazione",
          replyMessage: reply,
          notifyUser: true,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Invio risposta non riuscito.");
      }

      setTickets((prev) =>
        prev.map((row) =>
          row.id === ticket.id
            ? {
                ...row,
                status: "in_lavorazione",
                admin_notes: json.data?.admin_notes ?? row.admin_notes,
              }
            : row,
        ),
      );
      setStatusSelectionByTicket((prev) => ({ ...prev, [ticket.id]: "in_lavorazione" }));
      setReplyByTicket((prev) => ({ ...prev, [ticket.id]: "" }));
      setStatusMessage("Risposta inviata. Ticket lasciato in lavorazione.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Invio risposta non riuscito.");
    } finally {
      setUpdatingTicketId(null);
    }
  }

  return (
    <Card>
      <CardTitle>Ticket supporto</CardTitle>
      <CardDescription>Filtra i ticket e aggiorna lo stato operativo.</CardDescription>

      <div className="mt-4 grid gap-3 lg:grid-cols-[220px_220px_1fr_auto_auto]">
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca per nome, email o messaggio"
        />

        <Button type="button" variant="secondary" disabled={loadingFilters} onClick={loadTickets}>
          {loadingFilters ? "Carico..." : "Applica filtri"}
        </Button>

        <Button type="button" variant="ghost" disabled={loadingFilters} onClick={resetFilters}>
          Reset
        </Button>
      </div>

      {statusMessage ? <p className="mt-3 text-sm text-zinc-700">{statusMessage}</p> : null}

      <div className="mt-4 space-y-3">
        {tickets.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessun ticket per i filtri selezionati.</p>
        ) : (
          tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-800">
                  {ticket.name} • {ticket.email}
                </p>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_BADGE_STYLES[ticket.status]}`}>
                  {STATUS_LABELS[ticket.status]}
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                {CATEGORY_LABELS[ticket.category]} • {new Date(ticket.created_at).toLocaleString("it-IT")} •{" "}
                {ticket.books?.title ?? "Nessun libro indicato"}
              </p>

              <p className="mt-2 text-sm text-zinc-700">{ticket.message}</p>

              {ticket.admin_notes ? (
                <p className="mt-2 text-xs text-zinc-600">
                  <span className="font-semibold">Note admin:</span> {ticket.admin_notes}
                </p>
              ) : null}

              <div className="mt-3">
                <Textarea
                  value={replyByTicket[ticket.id] ?? ""}
                  onChange={(event) =>
                    setReplyByTicket((prev) => ({
                      ...prev,
                      [ticket.id]: event.target.value,
                    }))
                  }
                  placeholder="Scrivi una risposta da inviare via email all'utente"
                  rows={3}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                  value={statusSelectionByTicket[ticket.id] ?? ticket.status}
                  onChange={(event) =>
                    setStatusSelectionByTicket((prev) => ({
                      ...prev,
                      [ticket.id]: event.target.value as SupportTicketStatus,
                    }))
                  }
                  className="w-[220px]"
                >
                  {STATUS_OPTIONS.filter((option) => option.value !== "all").map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={updatingTicketId === ticket.id}
                  onClick={() => updateTicketStatus(ticket)}
                >
                  {updatingTicketId === ticket.id ? "Aggiorno..." : "Aggiorna stato"}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={updatingTicketId === ticket.id}
                  onClick={() => replyOnly(ticket)}
                >
                  {updatingTicketId === ticket.id ? "Invio..." : "Invia risposta"}
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  disabled={updatingTicketId === ticket.id}
                  onClick={() => replyAndClose(ticket)}
                >
                  {updatingTicketId === ticket.id ? "Invio..." : "Invia risposta e chiudi"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
