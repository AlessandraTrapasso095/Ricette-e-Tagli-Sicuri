"use client";

import { type FormEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface AdminBookOption {
  id: string;
  slug: string;
  title: string;
}

interface AdminBonusRow {
  id: string;
  title: string;
  description: string | null;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  is_active: boolean;
  books: {
    id: string;
    slug: string;
    title: string;
  };
}

interface AdminBonusManagerProps {
  books: AdminBookOption[];
  initialBonus: AdminBonusRow[];
}

interface BonusFormState {
  id?: string;
  bookId: string;
  title: string;
  description: string;
  isActive: boolean;
}

function buildDefaultState(firstBookId?: string): BonusFormState {
  return {
    id: undefined,
    bookId: firstBookId ?? "",
    title: "",
    description: "",
    isActive: true,
  };
}

export function AdminBonusManager({ books, initialBonus }: AdminBonusManagerProps) {
  const [bonusRows, setBonusRows] = useState(initialBonus);
  const [form, setForm] = useState<BonusFormState>(buildDefaultState(books[0]?.id));
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function startCreateBonus() {
    setForm(buildDefaultState(books[0]?.id));
    setStatusMessage("Compila i campi per creare un nuovo bonus.");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function refreshRows() {
    const response = await fetch("/api/admin/bonus");
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error ?? "Errore caricamento bonus.");
    }

    setBonusRows((json.data ?? []) as AdminBonusRow[]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const payload = new FormData();
      if (form.id) {
        payload.set("id", form.id);
      }
      payload.set("bookId", form.bookId);
      payload.set("title", form.title);
      payload.set("description", form.description);
      payload.set("isActive", String(form.isActive));

      const selectedFile = fileInputRef.current?.files?.[0];
      if (selectedFile) {
        payload.set("file", selectedFile);
      }

      const response = await fetch("/api/admin/bonus", {
        method: "POST",
        body: payload,
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Errore salvataggio bonus.");
      }

      await refreshRows();
      setStatusMessage(form.id ? "Bonus aggiornato." : "Bonus creato.");
      setForm(buildDefaultState(books[0]?.id));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore salvataggio bonus.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleBonus(row: AdminBonusRow) {
    setToggleLoadingId(row.id);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bonus", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bonusId: row.id,
          isActive: !row.is_active,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Errore aggiornamento stato bonus.");
      }

      setBonusRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, is_active: !item.is_active } : item)),
      );
      setStatusMessage("Stato bonus aggiornato.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore aggiornamento stato bonus.");
    } finally {
      setToggleLoadingId(null);
    }
  }

  async function deleteBonus(row: AdminBonusRow) {
    if (!window.confirm("Confermi l'eliminazione del bonus?")) {
      return;
    }

    setDeleteLoadingId(row.id);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/admin/bonus", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bonusId: row.id,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Errore eliminazione bonus.");
      }

      setBonusRows((prev) => prev.filter((item) => item.id !== row.id));
      setStatusMessage("Bonus eliminato.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore eliminazione bonus.");
    } finally {
      setDeleteLoadingId(null);
    }
  }

  function editBonus(row: AdminBonusRow) {
    setForm({
      id: row.id,
      bookId: row.books.id,
      title: row.title,
      description: row.description ?? "",
      isActive: row.is_active,
    });
    setStatusMessage("Modalità modifica attiva.");
  }

  if (books.length === 0) {
    return (
      <Card>
        <CardTitle>Bonus PDF</CardTitle>
        <CardDescription>Prima di creare un bonus devi configurare almeno un libro in area admin.</CardDescription>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardTitle>{form.id ? "Modifica bonus PDF" : "Gestione bonus PDF"}</CardTitle>
        <CardDescription>Carica PDF, modifica titolo e collega il bonus al libro corretto.</CardDescription>

        <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
          <Select
            value={form.bookId}
            onChange={(event) => setForm((prev) => ({ ...prev, bookId: event.target.value }))}
            required
          >
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </Select>

          <Input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Titolo bonus"
            required
          />

          <Textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Descrizione breve (opzionale)"
          />

          <Input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            placeholder="Carica PDF"
          />

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              className="rounded"
              checked={form.isActive}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Bonus attivo
          </label>

          {statusMessage ? <p className="text-sm text-zinc-700">{statusMessage}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Salvataggio..." : form.id ? "Aggiorna bonus" : "Salva bonus"}
            </Button>
            {form.id ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  startCreateBonus();
                }}
              >
                Annulla modifica
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={startCreateBonus}>
            + Nuovo bonus PDF
          </Button>
          <div>
            <CardTitle>Bonus configurati</CardTitle>
            <CardDescription>Elenco bonus con stato attivo/disattivo e possibilità di modifica.</CardDescription>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {bonusRows.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessun bonus configurato.</p>
          ) : (
            bonusRows.map((row) => (
              <div key={row.id} className="rounded-2xl border border-zinc-200 p-3 text-sm">
                <p className="font-semibold text-zinc-800">{row.title}</p>
                <p className="text-xs text-zinc-500">
                  {row.books.title} • {row.storage_bucket}/{row.storage_path}
                </p>
                <p className="mt-1 text-zinc-700">{row.description ?? "Nessuna descrizione."}</p>
                <p className={`mt-1 text-xs font-semibold ${row.is_active ? "text-emerald-700" : "text-zinc-500"}`}>
                  {row.is_active ? "Attivo" : "Disattivo"}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => editBonus(row)}>
                    Modifica
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={toggleLoadingId === row.id}
                    onClick={() => toggleBonus(row)}
                  >
                    {toggleLoadingId === row.id ? "Aggiorno..." : row.is_active ? "Disattiva" : "Attiva"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={deleteLoadingId === row.id}
                    onClick={() => deleteBonus(row)}
                  >
                    {deleteLoadingId === row.id ? "Elimino..." : "Elimina"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
