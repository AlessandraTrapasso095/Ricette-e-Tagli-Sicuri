"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  { value: "unchanged", label: "Nessuna modifica" },
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

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function AdminUsersTable({ users, books }: AdminUsersTableProps) {
  const [rows, setRows] = useState(users);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [revokeSelectionByUser, setRevokeSelectionByUser] = useState<Record<string, string>>({});
  const [grantSelectionByUser, setGrantSelectionByUser] = useState<Record<string, string>>({});
  const [suspensionByUser, setSuspensionByUser] = useState<Record<string, SuspensionValue>>({});
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(appliedSearch);
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((user) => {
      const searchableText = normalizeSearchValue(
        [user.full_name, `${user.firstName} ${user.lastName}`, user.email].filter(Boolean).join(" "),
      );

      return searchableText.includes(normalizedSearch);
    });
  }, [appliedSearch, rows]);

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
    const value = suspensionByUser[user.id] ?? "unchanged";
    if (value === "unchanged") {
      setStatusMessage("Seleziona un'azione account prima di aggiornare.");
      return;
    }
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
                isSuspended: Boolean(json.data?.isSuspended),
                bannedUntil: json.data?.bannedUntil ?? null,
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

  async function resetMenuChat(user: UserRow) {
    setStatusMessage(null);
    setLoadingUserId(user.id);

    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Reset menu chat non riuscito");
      }

      const archivedSessionsCount = Number(json.data?.archivedSessionsCount ?? 0);
      setStatusMessage(
        archivedSessionsCount > 0
          ? `Menu chat giornaliero resettato. Sessioni archiviate oggi: ${archivedSessionsCount}.`
          : "Menu chat giornaliero resettato. Nessuna sessione attiva oggi da archiviare.",
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Reset menu chat non riuscito");
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

      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(searchInput.trim());
        }}
      >
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Cerca per nome o email"
          className="max-w-md"
        />
        <Button type="submit" variant="secondary">
          Cerca
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSearchInput("");
            setAppliedSearch("");
          }}
        >
          Azzera ricerca
        </Button>
      </form>

      <p className="mt-2 text-xs text-zinc-500">
        {appliedSearch ? `${filteredRows.length} utenti trovati per "${appliedSearch}".` : `${rows.length} utenti registrati.`}
      </p>

      {statusMessage ? <p className="mt-2 text-sm text-zinc-700">{statusMessage}</p> : null}

      <div className="mt-4 space-y-3">
        {filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            Nessun utente trovato con questa ricerca.
          </div>
        ) : null}

        {filteredRows.map((user) => {
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
                  value={suspensionByUser[user.id] ?? "unchanged"}
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
                <Button variant="secondary" disabled={loadingUserId === user.id} onClick={() => resetMenuChat(user)}>
                  {loadingUserId === user.id ? "Operazione..." : "Reset menu chat"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
