"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { UserSupportTicketRow } from "@/server/support/support-service";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const CATEGORY_LABELS: Record<UserSupportTicketRow["category"], string> = {
  accesso: "Accesso",
  bonus: "Bonus",
  chat_menu: "Chat menu",
  tecnico: "Problema tecnico",
  altro: "Altro",
};

const STATUS_LABELS: Record<UserSupportTicketRow["status"], string> = {
  inviato: "Inviato",
  in_lavorazione: "In lavorazione",
  risolto: "Risolto",
  chiuso: "Chiuso",
};

const STATUS_BADGE_STYLES: Record<UserSupportTicketRow["status"], string> = {
  inviato: "bg-amber-100 text-amber-800",
  in_lavorazione: "bg-sky-100 text-sky-800",
  risolto: "bg-emerald-100 text-emerald-800",
  chiuso: "bg-zinc-200 text-zinc-700",
};

function getPreview(message: string) {
  const normalized = message.trim();
  if (normalized.length <= 88) {
    return normalized;
  }

  return `${normalized.slice(0, 88)}...`;
}

export function UserSupportTicketsList({ tickets }: { tickets: UserSupportTicketRow[] }) {
  const router = useRouter();
  const [ticketState, setTicketState] = useState(tickets);
  const [isPending, startTransition] = useTransition();
  const [replyByTicket, setReplyByTicket] = useState<Record<string, string>>({});
  const [sendingReplyTicketId, setSendingReplyTicketId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (ticketState.length === 0) {
    return <p className="text-sm text-zinc-500">Nessun ticket inviato.</p>;
  }

  function handleToggle(ticketId: string, open: boolean) {
    const currentTicket = ticketState.find((ticket) => ticket.id === ticketId);
    if (!open || !currentTicket?.hasUnreadAdminReply) {
      return;
    }

    setTicketState((current) =>
      current.map((ticket) => (ticket.id === ticketId ? { ...ticket, hasUnreadAdminReply: false } : ticket)),
    );

    startTransition(async () => {
      const response = await fetch(`/api/support/tickets/${ticketId}/read`, {
        method: "POST",
      });

      if (!response.ok) {
        setTicketState((current) =>
          current.map((ticket) => (ticket.id === ticketId ? { ...ticket, hasUnreadAdminReply: true } : ticket)),
        );
      }
    });
  }

  async function handleReply(ticket: UserSupportTicketRow) {
    const reply = (replyByTicket[ticket.id] ?? "").trim();
    if (!reply) {
      setStatusMessage("Scrivi una risposta prima di inviare.");
      return;
    }

    setSendingReplyTicketId(ticket.id);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/support/tickets/${ticket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Invio risposta non riuscito.");
      }

      setTicketState((current) => current.map((item) => (item.id === ticket.id ? json.data : item)));
      setReplyByTicket((current) => ({ ...current, [ticket.id]: "" }));
      setStatusMessage("Risposta inviata. Ora attendi una nuova risposta del supporto.");
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Invio risposta non riuscito.");
    } finally {
      setSendingReplyTicketId(null);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        I ticket aperti in questa sezione riguardano esclusivamente aspetti tecnici del sito e dell&apos;Area Lettori.
      </div>
      {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}
      {ticketState.map((ticket) => (
        <details
          key={ticket.id}
          className="group rounded-2xl border border-rose-100 bg-rose-50/30 p-4 open:bg-white open:shadow-sm"
          onToggle={(event) => handleToggle(ticket.id, event.currentTarget.open)}
        >
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 marker:hidden">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-rose-900">{CATEGORY_LABELS[ticket.category]}</p>
                {ticket.hasUnreadAdminReply ? (
                  <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-800">
                    Risposta da leggere
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {new Date(ticket.created_at).toLocaleString("it-IT")}
                {ticket.books ? ` • ${ticket.books.title}` : ""}
              </p>
              <p className="mt-2 text-sm text-zinc-700">{getPreview(ticket.message)}</p>
            </div>
            <div className="shrink-0 text-right">
              <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_BADGE_STYLES[ticket.status]}`}>
                {STATUS_LABELS[ticket.status]}
              </span>
              <p className="mt-2 text-xs font-semibold text-rose-700 group-open:hidden">
                {isPending && ticket.hasUnreadAdminReply ? "Apro..." : "Apri"}
              </p>
              <p className="mt-2 hidden text-xs font-semibold text-rose-700 group-open:block">Chiudi</p>
            </div>
          </summary>

          <div className="mt-4 space-y-4 border-t border-rose-100 pt-4">
            <div className="space-y-2 rounded-2xl bg-zinc-50 p-3">
              {ticket.messages.map((message, index) => (
                <div
                  key={`${ticket.id}-${index}-${message.created_at}`}
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                    message.sender === "admin" ? "bg-emerald-50 text-emerald-900" : "ml-auto bg-rose-100 text-rose-900"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    {message.sender === "admin" ? "Supporto" : "Tu"}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{message.content}</p>
                  <p className="mt-2 text-[11px] text-zinc-500">{new Date(message.created_at).toLocaleString("it-IT")}</p>
                </div>
              ))}
            </div>

            {ticket.status === "chiuso" ? (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">Questo ticket e&apos; chiuso e non puo&apos; ricevere nuove risposte.</p>
              </div>
            ) : ticket.canUserReply ? (
              <div className="space-y-3 rounded-2xl border border-rose-100 bg-white p-4">
                <p className="text-sm font-semibold text-rose-900">Rispondi al supporto</p>
                <Textarea
                  value={replyByTicket[ticket.id] ?? ""}
                  onChange={(event) =>
                    setReplyByTicket((current) => ({
                      ...current,
                      [ticket.id]: event.target.value,
                    }))
                  }
                  placeholder="Scrivi la tua risposta"
                  rows={3}
                />
                <Button
                  type="button"
                  disabled={sendingReplyTicketId === ticket.id}
                  onClick={() => handleReply(ticket)}
                >
                  {sendingReplyTicketId === ticket.id ? "Invio..." : "Invia risposta"}
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <p className="text-sm text-zinc-600">Attendi una nuova risposta del supporto prima di inviare un altro messaggio.</p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
              <p>ID ticket: {ticket.id}</p>
              <p>Ultimo aggiornamento: {new Date(ticket.updated_at).toLocaleString("it-IT")}</p>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
