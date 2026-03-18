"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import {
  AdminUserManagementPanel,
  type AdminUserManagementRow,
} from "@/components/forms/admin-user-management-panel";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface AdminUsersTableProps {
  users: AdminUserManagementRow[];
  books: { id: string; slug: string; title: string }[];
}

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function AdminUsersTable({ users, books }: AdminUsersTableProps) {
  const [rows, setRows] = useState(users);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

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

      <div className="mt-4 space-y-3">
        {filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
            Nessun utente trovato con questa ricerca.
          </div>
        ) : null}

        {filteredRows.map((user) => {
          const isExpanded = expandedUserId === user.id;
          const statusLabel = user.isSuspended ? "Sospeso" : user.isActiveNow ? "Online" : "Attivo";

          return (
            <div key={user.id} className="rounded-2xl border border-zinc-200 bg-white">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 p-3 text-left"
                aria-expanded={isExpanded}
                onClick={() => setExpandedUserId((current) => (current === user.id ? null : user.id))}
              >
                <div className="min-w-0 flex-1">
                  <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                    <p className="truncate text-sm font-semibold text-zinc-800">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="truncate text-xs text-zinc-500 sm:text-sm">{user.email}</p>
                    <div className="flex items-center gap-2 sm:justify-end">
                      {user.isActiveNow ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                      <span
                        className={`text-xs font-semibold ${
                          user.isSuspended ? "text-red-600" : user.isActiveNow ? "text-emerald-700" : "text-zinc-700"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {isExpanded ? (
                <div className="border-t border-zinc-200 px-3 py-3">
                  <AdminUserManagementPanel
                    user={user}
                    books={books}
                    onUserUpdated={(nextUser) => {
                      setRows((prev) => prev.map((row) => (row.id === nextUser.id ? nextUser : row)));
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
