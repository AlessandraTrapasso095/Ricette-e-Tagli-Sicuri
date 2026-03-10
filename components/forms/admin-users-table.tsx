"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  unlockedBooks: number;
  failedAttempts: number;
  unlockedBookRows: { id: string; slug: string; title: string }[];
}

interface AdminUsersTableProps {
  users: UserRow[];
}

export function AdminUsersTable({ users }: AdminUsersTableProps) {
  const [selectedBookByUser, setSelectedBookByUser] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function revokeAccess(userId: string) {
    const bookId = selectedBookByUser[userId];
    if (!bookId) {
      setStatusMessage("Seleziona un libro da revocare.");
      return;
    }

    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: userId,
          bookId,
          reason: "Revoca manuale da pannello admin",
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Revoca non riuscita");
      }

      setStatusMessage("Accesso revocato correttamente.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Revoca non riuscita");
    }
  }

  return (
    <Card>
      <CardTitle>Utenti e accessi</CardTitle>
      <CardDescription>Controlla libri sbloccati e tentativi falliti, con revoca manuale accesso.</CardDescription>

      {statusMessage ? <p className="mt-2 text-sm text-zinc-700">{statusMessage}</p> : null}

      <div className="mt-4 space-y-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-2xl border border-zinc-200 p-3">
            <p className="text-sm font-semibold text-zinc-800">{user.full_name ?? "Utente"}</p>
            <p className="text-xs text-zinc-500">{user.email}</p>
            <p className="mt-2 text-xs text-zinc-600">
              Libri sbloccati: {user.unlockedBooks} • Tentativi falliti: {user.failedAttempts}
            </p>

            {user.unlockedBookRows.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Select
                  value={selectedBookByUser[user.id] ?? ""}
                  onChange={(event) =>
                    setSelectedBookByUser((prev) => ({
                      ...prev,
                      [user.id]: event.target.value,
                    }))
                  }
                  className="max-w-xs"
                >
                  <option value="">Seleziona libro</option>
                  {user.unlockedBookRows.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </Select>
                <Button variant="danger" onClick={() => revokeAccess(user.id)}>
                  Revoca accesso
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Nessun libro attivo da revocare.</p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
