"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import type { DailyMenu } from "@/types/domain";

interface MenuSession {
  id: string;
  title: string;
  last_message_at: string;
}

interface MenuMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  menu_payload: DailyMenu | null;
  created_at: string;
}

interface GeneratedState {
  sessionId: string;
  messageId: string;
  menu: DailyMenu;
}

export function ChatMenuPanel() {
  const [sessions, setSessions] = useState<MenuSession[]>([]);
  const [messages, setMessages] = useState<MenuMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Cosa mangiamo oggi?");
  const [loading, setLoading] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedState | null>(null);

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/menu/sessions", { method: "GET" });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error ?? "Impossibile caricare le sessioni.");
    }

    setSessions(json.data ?? []);

    if (!activeSessionId && json.data?.length) {
      setActiveSessionId(json.data[0].id);
    }
  }, [activeSessionId]);

  const loadMessages = useCallback(async (sessionId: string) => {
    const response = await fetch(`/api/menu/sessions?sessionId=${sessionId}`, { method: "GET" });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error ?? "Impossibile caricare i messaggi.");
    }

    setMessages(json.data ?? []);
  }, []);

  useEffect(() => {
    loadSessions().catch((error) => {
      setStatusMessage(error instanceof Error ? error.message : "Errore caricamento sessioni");
    });
  }, [loadSessions]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    loadMessages(activeSessionId).catch((error) => {
      setStatusMessage(error instanceof Error ? error.message : "Errore caricamento messaggi");
    });
  }, [activeSessionId, loadMessages]);

  const latestMenu = useMemo(() => {
    const found = [...messages].reverse().find((message) => message.menu_payload);
    return found?.menu_payload ?? generated?.menu ?? null;
  }, [messages, generated]);

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/chat-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          prompt,
          saveMenu: false,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Errore generazione menu");
      }

      const payload = json.data;
      setGenerated({
        sessionId: payload.sessionId,
        messageId: payload.assistantMessageId,
        menu: payload.menu,
      });
      setActiveSessionId(payload.sessionId);
      setPrompt("");
      setStatusMessage("Menu generato con successo.");

      await loadSessions();
      await loadMessages(payload.sessionId);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore generazione menu");
    } finally {
      setLoading(false);
    }
  }

  async function saveLatestMenu() {
    if (!generated) {
      return;
    }

    setSavingMenu(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/menu/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: generated.sessionId,
          messageId: generated.messageId,
          title: generated.menu.title,
        }),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Errore salvataggio menu");
      }

      setStatusMessage("Menu salvato nella tua raccolta.");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Errore salvataggio menu");
    } finally {
      setSavingMenu(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardTitle>Sessioni chat</CardTitle>
        <CardDescription>Riprendi conversazioni precedenti con un tap.</CardDescription>
        <div className="mt-4 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessuna sessione disponibile.</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`w-full rounded-2xl px-3 py-2 text-left text-sm transition ${
                  session.id === activeSessionId ? "bg-rose-100 text-rose-800" : "bg-zinc-50 text-zinc-700 hover:bg-rose-50"
                }`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <p className="font-medium">{session.title}</p>
                <p className="text-xs opacity-75">{new Date(session.last_message_at).toLocaleString("it-IT")}</p>
              </button>
            ))
          )}
        </div>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardTitle>Cosa mangiamo oggi?</CardTitle>
          <CardDescription>
            Scrivi una preferenza (es. “senza uovo”, “ho poco tempo”, “solo pranzo e cena”) e genera menu guidati.
          </CardDescription>

          <form className="mt-4 space-y-3" onSubmit={submitPrompt}>
            <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={loading || prompt.trim().length < 2}>
                {loading ? "Generazione menu..." : "Genera menu"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!generated || savingMenu}
                onClick={saveLatestMenu}
              >
                {savingMenu ? "Salvataggio..." : "Salva menu"}
              </Button>
            </div>
          </form>

          {statusMessage ? <p className="mt-3 text-sm text-zinc-700">{statusMessage}</p> : null}
        </Card>

        {latestMenu ? (
          <Card>
            <CardTitle>{latestMenu.title}</CardTitle>
            <CardDescription>{latestMenu.childProfileSummary}</CardDescription>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {latestMenu.meals.map((meal) => (
                <div key={`${meal.mealType}-${meal.dishName}`} className="rounded-2xl border border-rose-100 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">{meal.mealType}</p>
                  <h4 className="font-semibold text-zinc-800">{meal.dishName}</h4>
                  <p className="mt-2 text-sm text-zinc-700">
                    <span className="font-medium">Ingredienti:</span> {meal.ingredients.join(", ")}
                  </p>
                  <p className="mt-1 text-sm text-zinc-700">
                    <span className="font-medium">Preparazione:</span> {meal.preparation}
                  </p>
                  {meal.safetyNotes.length > 0 ? (
                    <p className="mt-1 text-sm text-amber-700">
                      <span className="font-medium">Sicurezza:</span> {meal.safetyNotes.join(" • ")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>

            {latestMenu.dailyNotes.length > 0 ? (
              <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-zinc-700">
                <p className="font-semibold text-rose-800">Note del giorno</p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {latestMenu.dailyNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : (
          <EmptyState
            title="Nessun menu ancora generato"
            description="Invia il primo messaggio alla chat per ottenere un piano giornaliero personalizzato."
          />
        )}
      </div>
    </div>
  );
}
