"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

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

interface AdminUsersTableProps {
  users: UserRow[];
  books: { id: string; slug: string; title: string }[];
}

function removeUnlockedBook(user: UserRow, bookId: string) {
  const filtered = user.unlockedBookRows.filter((book) => book.id !== bookId);
  return {
    ...user,
    unlockedBookRows: filtered,
    unlockedBooks: filtered.length,
  };
}

function addUnlockedBook(
  user: UserRow,
  book: {
    id: string;
    slug: string;
    title: string;
  },
) {
  const alreadyExists = user.unlockedBookRows.some((item) => item.id === book.id);
  if (alreadyExists) {
    return user;
  }

  const nextBooks = [...user.unlockedBookRows, book];
  return {
    ...user,
    unlockedBookRows: nextBooks,
    unlockedBooks: nextBooks.length,
  };
}

const SUSPENSION_OPTIONS = [
  { value: "none", label: "Rimuovi sospensione" },
  { value: "1h", label: "Sospendi 1 ora" },
  { value: "24h", label: "Sospendi 24 ore" },
  { value: "168h", label: "Sospendi 7 giorni" },
  { value: "permanent", label: "Sospendi sempre" },
] as const;

type SuspensionValue = (typeof SUSPENSION_OPTIONS)[number]["value"];

const FEEDING_STYLE_LABELS: Record<NonNullable<UserRow["childFeedingStyle"]>, string> = {
  classico: "Classico",
  autosvezzamento: "Autosvezzamento",
  misto: "Misto",
};

export function AdminUsersTable({ users, books }: AdminUsersTableProps) {
  const [rows, setRows] = useState(users);
  const [revokeSelectionByUser, setRevokeSelectionByUser] = useState<Record<string, string>>({});
  const [grantSelectionByUser, setGrantSelectionByUser] = useState<Record<string, string>>({});
  const [suspensionByUser, setSuspensionByUser] = useState<Record<string, SuspensionValue>>({});
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function revokeAccess(userId: string) {
    const bookId = revokeSelectionByUser[userId];
    if (!bookId) {
      setStatusMessage("Seleziona un libro da revocare.");
      return;
    }

    setStatusMessage(null);
    setLoadingUserId(userId);

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

      setRows((prev) => prev.map((row) => (row.id === userId ? removeUnlockedBook(row, bookId) : row)));
      setRevokeSelectionByUser((prev) => ({ ...prev, [userId]: "" }));
      setStatusMessage("Accesso revocato correttamente.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Revoca non riuscita");
    } finally {
      setLoadingUserId(null);
    }
  }

  async function grantAccess(user: UserRow) {
    const bookId = grantSelectionByUser[user.id];
    if (!bookId) {
      setStatusMessage("Seleziona un libro da sbloccare.");
      return;
    }

    setStatusMessage(null);
    setLoadingUserId(user.id);

    try {
      const response = await fetch("/api/admin/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: user.id,
          bookId,
          reason: "Sblocco manuale da pannello admin",
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Sblocco non riuscito");
      }

      const book = books.find((item) => item.id === bookId);
      if (book) {
        setRows((prev) => prev.map((row) => (row.id === user.id ? addUnlockedBook(row, book) : row)));
      }
      setGrantSelectionByUser((prev) => ({ ...prev, [user.id]: "" }));
      setStatusMessage("Libro sbloccato manualmente.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Sblocco non riuscito");
    } finally {
      setLoadingUserId(null);
    }
  }

  async function updateSuspension(user: UserRow) {
    const value = suspensionByUser[user.id] ?? "none";
    setStatusMessage(null);
    setLoadingUserId(user.id);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          duration: value,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Aggiornamento sospensione non riuscito");
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === user.id
            ? {
                ...row,
                isSuspended: value !== "none",
                bannedUntil: value === "none" ? null : row.bannedUntil,
              }
            : row,
        ),
      );
      setStatusMessage(value === "none" ? "Sospensione rimossa." : "Sospensione aggiornata.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Aggiornamento sospensione non riuscito");
    } finally {
      setLoadingUserId(null);
    }
  }

  return (
    <Card>
      <CardTitle>Utenti registrati</CardTitle>
      <CardDescription>
        Dati account, profilo bambino, stato accesso, sblocco libri manuale e sospensione account.
      </CardDescription>

      {statusMessage ? <p className="mt-2 text-sm text-zinc-700">{statusMessage}</p> : null}

      <div className="mt-4 space-y-3">
        {rows.map((user) => {
          const activeBookIds = new Set(user.unlockedBookRows.map((book) => book.id));
          const grantableBooks = books.filter((book) => !activeBookIds.has(book.id));

          return (
            <div key={user.id} className="rounded-2xl border border-zinc-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-800">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-zinc-500">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {user.isActiveNow ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                  <span className={`text-xs font-semibold ${user.isSuspended ? "text-red-600" : "text-emerald-700"}`}>
                    {user.isSuspended ? "Sospeso" : "Attivo"}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-xs text-zinc-600">
                Nome bimbo/a: {user.childName ?? "Non compilato"} • Età:{" "}
                {user.childAgeMonths !== null ? `${user.childAgeMonths} mesi` : "Non compilata"} • Svezzamento:{" "}
                {user.childFeedingStyle ? FEEDING_STYLE_LABELS[user.childFeedingStyle] : "Non impostato"}
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Libri sbloccati: {user.unlockedBooks} • Tentativi falliti: {user.failedAttempts} • Ultimo accesso:{" "}
                {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString("it-IT") : "n/d"}
              </p>

              {user.bannedUntil ? (
                <p className="mt-1 text-xs text-red-600">Sospeso fino a: {new Date(user.bannedUntil).toLocaleString("it-IT")}</p>
              ) : null}

              {user.unlockedBookRows.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    value={revokeSelectionByUser[user.id] ?? ""}
                    onChange={(event) =>
                      setRevokeSelectionByUser((prev) => ({
                        ...prev,
                        [user.id]: event.target.value,
                      }))
                    }
                    className="max-w-xs"
                  >
                    <option value="">Libro da revocare</option>
                    {user.unlockedBookRows.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                      </option>
                    ))}
                  </Select>
                  <Button variant="danger" disabled={loadingUserId === user.id} onClick={() => revokeAccess(user.id)}>
                    {loadingUserId === user.id ? "Operazione..." : "Revoca libro"}
                  </Button>
                </div>
              ) : null}

              {grantableBooks.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select
                    value={grantSelectionByUser[user.id] ?? ""}
                    onChange={(event) =>
                      setGrantSelectionByUser((prev) => ({
                        ...prev,
                        [user.id]: event.target.value,
                      }))
                    }
                    className="max-w-xs"
                  >
                    <option value="">Libro da sbloccare</option>
                    {grantableBooks.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title}
                      </option>
                    ))}
                  </Select>
                  <Button variant="secondary" disabled={loadingUserId === user.id} onClick={() => grantAccess(user)}>
                    {loadingUserId === user.id ? "Operazione..." : "Sblocca libro"}
                  </Button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select
                  value={suspensionByUser[user.id] ?? "none"}
                  onChange={(event) =>
                    setSuspensionByUser((prev) => ({
                      ...prev,
                      [user.id]: event.target.value as SuspensionValue,
                    }))
                  }
                  className="max-w-xs"
                >
                  {SUSPENSION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Button variant="ghost" disabled={loadingUserId === user.id} onClick={() => updateSuspension(user)}>
                  {loadingUserId === user.id ? "Operazione..." : "Aggiorna account"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
