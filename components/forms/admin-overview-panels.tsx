"use client";

import { useState } from "react";

import { AdminSupportTicketsTable } from "@/components/forms/admin-support-tickets-table";
import { AdminUsersTable } from "@/components/forms/admin-users-table";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type OverviewSectionKey = "users" | "unlockedBooks" | "activeUsers" | "pendingTickets" | "failedAttempts";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  firstName: string;
  lastName: string;
  childName: string | null;
  childAgeMonths: number | null;
  childFeedingStyle: "classico" | "autosvezzamento" | "misto" | null;
  unlockedBooks: number;
  failedAttempts: number;
  unlockedBookRows: { id: string; slug: string; title: string }[];
  lastSignInAt: string | null;
  bannedUntil: string | null;
  isSuspended: boolean;
  isActiveNow: boolean;
}

interface TicketRow {
  id: string;
  name: string;
  email: string;
  category: "accesso" | "bonus" | "chat_menu" | "tecnico" | "altro";
  status: "inviato" | "in_lavorazione" | "risolto" | "chiuso";
  message: string;
  created_at: string;
  admin_notes: string | null;
  books: {
    slug: string;
    title: string;
  } | null;
}

interface AdminOverviewPanelsProps {
  stats: {
    users: number;
    unlockedBooks: number;
    activeUsers: number;
    pendingTickets: number;
    failedAttempts: number;
  };
  users: UserRow[];
  books: { id: string; slug: string; title: string }[];
  unlockedBooks: { id: string; slug: string; title: string; isActive: boolean; unlockedUsers: number }[];
  activeUsers: UserRow[];
  tickets: TicketRow[];
  failedAttempts: {
    id: number;
    createdAt: string;
    userName: string;
    userEmail: string;
    bookTitle: string;
    pageNumber: number | null;
    attemptInput: string | null;
    reason: string;
  }[];
}

const OVERVIEW_CARDS: Array<{
  key: OverviewSectionKey;
  title: string;
  description: string;
}> = [
  {
    key: "users",
    title: "Utenti registrati",
    description: "Dati lettori e gestione accessi",
  },
  {
    key: "unlockedBooks",
    title: "Libri sbloccati",
    description: "Conteggi sblocco per libro",
  },
  {
    key: "activeUsers",
    title: "Accessi attivi",
    description: "Utenti online ora",
  },
  {
    key: "pendingTickets",
    title: "Ticket in arrivo",
    description: "Supporto da gestire",
  },
  {
    key: "failedAttempts",
    title: "Tentativi falliti",
    description: "Monitoraggio sicurezza",
  },
];

export function AdminOverviewPanels({
  stats,
  users,
  books,
  unlockedBooks,
  activeUsers,
  tickets,
  failedAttempts,
}: AdminOverviewPanelsProps) {
  const [activeSection, setActiveSection] = useState<OverviewSectionKey>("users");

  const values: Record<OverviewSectionKey, number> = {
    users: stats.users,
    unlockedBooks: stats.unlockedBooks,
    activeUsers: stats.activeUsers,
    pendingTickets: stats.pendingTickets,
    failedAttempts: stats.failedAttempts,
  };

  return (
    <div className="flex min-h-[560px] flex-col gap-4 lg:h-[calc(100svh-2.5rem)]">
      <div className="sticky top-0 z-20 rounded-3xl border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {OVERVIEW_CARDS.map((card) => {
            const isActive = activeSection === card.key;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setActiveSection(card.key)}
                className={`rounded-2xl border p-3 text-left transition ${
                  isActive
                    ? "border-rose-300 bg-rose-50 shadow-sm"
                    : "border-zinc-200 bg-white hover:border-rose-200 hover:bg-rose-50/40"
                }`}
              >
                <p className="text-2xl font-bold text-zinc-900">{values[card.key]}</p>
                <p className="mt-1 text-sm font-semibold text-zinc-800">{card.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{card.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto pr-1">
        {activeSection === "users" ? <AdminUsersTable users={users} books={books} /> : null}

        {activeSection === "unlockedBooks" ? (
          <Card>
            <CardTitle>Libri sbloccati dagli utenti</CardTitle>
            <CardDescription>Per ogni libro vedi quante persone lo hanno sbloccato.</CardDescription>

            <div className="mt-4 space-y-3">
              {unlockedBooks.map((row) => (
                <div key={row.id} className="rounded-2xl border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold text-zinc-800">{row.title}</p>
                  <p className="text-xs text-zinc-500">{row.slug}</p>
                  <p className="mt-1 text-zinc-700">Sblocchi totali: {row.unlockedUsers}</p>
                  <p className={`mt-1 text-xs font-semibold ${row.isActive ? "text-emerald-700" : "text-zinc-500"}`}>
                    {row.isActive ? "Visibile in dashboard utente" : "Sospeso in dashboard utente"}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {activeSection === "activeUsers" ? (
          <Card>
            <CardTitle>Utenti attivi in questo momento</CardTitle>
            <CardDescription>
              Considerati attivi se hanno effettuato accesso negli ultimi 10 minuti e non sono sospesi.
            </CardDescription>

            <div className="mt-4 space-y-3">
              {activeUsers.length === 0 ? <p className="text-sm text-zinc-500">Nessun utente attivo al momento.</p> : null}

              {activeUsers.map((user) => (
                <div key={user.id} className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-3 text-sm">
                  <span className="mt-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <div>
                    <p className="font-semibold text-zinc-800">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs text-zinc-500">{user.email}</p>
                    <p className="text-xs text-zinc-500">
                      Ultimo accesso: {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("it-IT") : "n/d"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {activeSection === "pendingTickets" ? <AdminSupportTicketsTable initialTickets={tickets} /> : null}

        {activeSection === "failedAttempts" ? (
          <Card>
            <CardTitle>Tentativi falliti challenge</CardTitle>
            <CardDescription>
              Questa sezione serve a monitorare errori ripetuti, possibili abusi e problemi di accesso ai libri.
            </CardDescription>

            <div className="mt-4 space-y-3">
              {failedAttempts.length === 0 ? <p className="text-sm text-zinc-500">Nessun tentativo fallito registrato.</p> : null}

              {failedAttempts.map((row) => (
                <div key={row.id} className="rounded-2xl border border-zinc-200 p-3 text-sm">
                  <p className="font-semibold text-zinc-800">
                    {row.userName} • {row.userEmail}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {row.bookTitle}
                    {row.pageNumber ? ` • pagina ${row.pageNumber}` : ""} • {new Date(row.createdAt).toLocaleString("it-IT")}
                  </p>
                  <p className="mt-1 text-zinc-700">Input: {row.attemptInput ?? "(vuoto)"}</p>
                  <p className="text-xs text-zinc-500">Motivo: {row.reason}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
