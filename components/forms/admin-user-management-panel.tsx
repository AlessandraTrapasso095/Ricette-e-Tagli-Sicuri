"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export interface AdminUserManagementRow {
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

interface AdminBookOption {
  id: string;
  slug: string;
  title: string;
}

interface AdminUserManagementPanelProps {
  user: AdminUserManagementRow;
  books: AdminBookOption[];
  onUserUpdated?: (user: AdminUserManagementRow) => void;
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

const FEEDING_STYLE_LABELS: Record<NonNullable<AdminUserManagementRow["childFeedingStyle"]>, string> = {
  classico: "Classico",
  autosvezzamento: "Autosvezzamento",
  misto: "Misto",
};

function removeUnlockedBook(user: AdminUserManagementRow, bookId: string) {
  const filtered = user.unlockedBookRows.filter((book) => book.id !== bookId);
  return {
    ...user,
    unlockedBookRows: filtered,
    unlockedBooks: filtered.length,
  };
}

function addUnlockedBook(user: AdminUserManagementRow, book: AdminBookOption) {
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

export function AdminUserManagementPanel({ user, books, onUserUpdated }: AdminUserManagementPanelProps) {
  const [currentUser, setCurrentUser] = useState(user);
  const [revokeBookId, setRevokeBookId] = useState("");
  const [grantBookId, setGrantBookId] = useState("");
  const [suspensionValue, setSuspensionValue] = useState<SuspensionValue>("unchanged");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const grantableBooks = useMemo(() => {
    const activeBookIds = new Set(currentUser.unlockedBookRows.map((book) => book.id));
    return books.filter((book) => !activeBookIds.has(book.id));
  }, [books, currentUser.unlockedBookRows]);

  useEffect(() => {
    setCurrentUser(user);
    setRevokeBookId("");
    setGrantBookId("");
    setSuspensionValue("unchanged");
    setStatusMessage(null);
  }, [user]);

  function applyUserUpdate(nextUser: AdminUserManagementRow) {
    setCurrentUser(nextUser);
    onUserUpdated?.(nextUser);
  }

  async function revokeAccess() {
    if (!revokeBookId) {
      setStatusMessage("Seleziona un libro da revocare.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: currentUser.id,
          bookId: revokeBookId,
          reason: "Revoca manuale da pannello admin",
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Revoca non riuscita.");
      }

      applyUserUpdate(removeUnlockedBook(currentUser, revokeBookId));
      setRevokeBookId("");
      setStatusMessage("Accesso revocato correttamente.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Revoca non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  async function grantAccess() {
    if (!grantBookId) {
      setStatusMessage("Seleziona un libro da sbloccare.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: currentUser.id,
          bookId: grantBookId,
          reason: "Sblocco manuale da pannello admin",
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Sblocco non riuscito.");
      }

      const book = books.find((item) => item.id === grantBookId);
      if (book) {
        applyUserUpdate(addUnlockedBook(currentUser, book));
      }
      setGrantBookId("");
      setStatusMessage("Libro sbloccato manualmente.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Sblocco non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  async function updateSuspension() {
    if (suspensionValue === "unchanged") {
      setStatusMessage("Seleziona un'azione account prima di aggiornare.");
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          duration: suspensionValue,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Aggiornamento sospensione non riuscito.");
      }

      applyUserUpdate({
        ...currentUser,
        isSuspended: Boolean(json.data?.isSuspended),
        bannedUntil: json.data?.bannedUntil ?? null,
      });
      setSuspensionValue("unchanged");
      setStatusMessage(suspensionValue === "none" ? "Sospensione rimossa." : "Sospensione aggiornata.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Aggiornamento sospensione non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  async function resetMenuChat() {
    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Reset menu chat non riuscito.");
      }

      const archivedSessionsCount = Number(json.data?.archivedSessionsCount ?? 0);
      setStatusMessage(
        archivedSessionsCount > 0
          ? `Menu chat giornaliero resettato. Sessioni archiviate oggi: ${archivedSessionsCount}.`
          : "Menu chat giornaliero resettato. Nessuna sessione attiva oggi da archiviare.",
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Reset menu chat non riuscito.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1 text-xs text-zinc-600 sm:text-sm">
        <p>
          Nome bimbo/a: {currentUser.childName ?? "Non compilato"} • Età:{" "}
          {currentUser.childAgeMonths !== null ? `${currentUser.childAgeMonths} mesi` : "Non compilata"} • Svezzamento:{" "}
          {currentUser.childFeedingStyle ? FEEDING_STYLE_LABELS[currentUser.childFeedingStyle] : "Non impostato"}
        </p>
        <p>
          Libri sbloccati: {currentUser.unlockedBooks} • Tentativi falliti: {currentUser.failedAttempts} • Ultimo accesso:{" "}
          {currentUser.lastSignInAt ? new Date(currentUser.lastSignInAt).toLocaleString("it-IT") : "n/d"}
        </p>
        {currentUser.bannedUntil ? (
          <p className="text-red-600">Sospeso fino a: {new Date(currentUser.bannedUntil).toLocaleString("it-IT")}</p>
        ) : null}
      </div>

      {currentUser.unlockedBookRows.length > 0 ? (
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={revokeBookId} onChange={(event) => setRevokeBookId(event.target.value)} className="max-w-xs">
            <option value="">Libro da revocare</option>
            {currentUser.unlockedBookRows.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </Select>
          <Button variant="danger" disabled={loading} onClick={revokeAccess}>
            {loading ? "Operazione..." : "Revoca libro"}
          </Button>
        </div>
      ) : null}

      {grantableBooks.length > 0 ? (
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={grantBookId} onChange={(event) => setGrantBookId(event.target.value)} className="max-w-xs">
            <option value="">Libro da sbloccare</option>
            {grantableBooks.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={loading} onClick={grantAccess}>
            {loading ? "Operazione..." : "Sblocca libro"}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
        <Select value={suspensionValue} onChange={(event) => setSuspensionValue(event.target.value as SuspensionValue)} className="max-w-xs">
          {SUSPENSION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Button variant="secondary" disabled={loading} onClick={updateSuspension}>
          {loading ? "Operazione..." : "Aggiorna account"}
        </Button>
        <Button variant="ghost" disabled={loading} onClick={resetMenuChat}>
          {loading ? "Operazione..." : "Reset menu chat"}
        </Button>
      </div>

      {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}
    </div>
  );
}
