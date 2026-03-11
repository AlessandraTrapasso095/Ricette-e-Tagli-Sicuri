"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { MENU_SESSION_PANEL_VISIBLE_ITEMS } from "@/config/chat-session";
import { dashboardNavigation } from "@/config/navigation";
import { SideNav } from "@/components/layout/side-nav";
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

const DEFAULT_CHAT_PROMPT = "Cosa mangiamo oggi?";
const MODIFY_CHAT_PLACEHOLDER = "Se non hai ingredienti o vuoi richiedere modifiche, scrivi qui";
const CHAT_INSTRUCTION_GROUPS = [
  {
    title: "Generazione menu",
    examples: ["Cosa mangiamo oggi?", "Genera un menu bilanciato per oggi"],
  },
  {
    title: "Sostituzioni ingredienti",
    examples: [
      "Sostituisci il pollo con il tacchino",
      "Sostituisci la pasta con il riso",
      "Ho la crema mais e tapioca e non quella di riso",
    ],
  },
  {
    title: "Cambio pasto",
    examples: ["Cambia la cena, proponimi altro", "Modifica il pranzo con una vellutata", "Rifai la colazione con alternative"],
  },
  {
    title: "Esclusioni e vincoli",
    examples: ["Non ho zucchine", "Senza uovo", "No latticini oggi"],
  },
] as const;

export function ChatMenuPanel() {
  const [sessions, setSessions] = useState<MenuSession[]>([]);
  const [messages, setMessages] = useState<MenuMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_CHAT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedState | null>(null);

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/menu/sessions", { method: "GET" });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error ?? "Impossibile caricare le sessioni.");
    }

    setSessions(json.data ?? []);

    if (!json.data?.length) {
      setActiveSessionId(null);
      setMessages([]);
      setGenerated(null);
      return;
    }

    const hasCurrentActive = activeSessionId ? json.data.some((item: MenuSession) => item.id === activeSessionId) : false;
    if (!hasCurrentActive) {
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

  const hasGeneratedToday = sessions.length > 0 || generated !== null;
  const canSubmit = prompt.trim().length >= 2 && (!hasGeneratedToday || Boolean(activeSessionId));
  const textareaPlaceholder = hasGeneratedToday ? MODIFY_CHAT_PLACEHOLDER : DEFAULT_CHAT_PROMPT;

  useEffect(() => {
    if (!hasGeneratedToday) {
      return;
    }

    if (prompt.trim().toLowerCase() === DEFAULT_CHAT_PROMPT.toLowerCase()) {
      setPrompt("");
    }
  }, [hasGeneratedToday, prompt]);

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const isModificationRequest = Boolean(activeSessionId && hasGeneratedToday);
      const requestPayload = {
        prompt,
        saveMenu: false,
        ...(isModificationRequest ? { sourceSessionId: activeSessionId } : {}),
      };

      const response = await fetch("/api/chat-menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Errore generazione menu");
      }

      const responseData = json.data;
      setGenerated({
        sessionId: responseData.sessionId,
        messageId: responseData.assistantMessageId,
        menu: responseData.menu,
      });
      setActiveSessionId(responseData.sessionId);
      setPrompt("");
      setStatusMessage(isModificationRequest ? "Menu modificato con successo." : "Menu generato con successo.");

      await loadSessions();
      await loadMessages(responseData.sessionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore generazione menu";

      if (message.includes("Sessione non disponibile")) {
        setActiveSessionId(null);
        try {
          await loadSessions();
          setMessages([]);
        } catch {
          // Lascia il messaggio originale: l'utente può ritentare subito.
        }
      }

      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[210px_minmax(0,1fr)_240px]">
      <Card>
        <CardTitle>Area lettori</CardTitle>
        <div className="mt-4">
          <SideNav items={dashboardNavigation} />
        </div>
      </Card>

      <Card>
        <CardTitle>Cosa mangiamo oggi?</CardTitle>
        <CardDescription>
          Qui puoi generare il tuo menu giornaliero, trovi tutte le info in{" "}
          <span className="font-semibold">"Istruzioni Utilizzo"</span>. Puoi fare fino a{" "}
          <span className="underline decoration-2 underline-offset-2">cinque modifiche giornaliere</span>. Buon Svezzamento! ❤️👦🏼
        </CardDescription>

        {showInstructions ? (
          <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
            <p className="text-sm font-semibold text-rose-900">Come usare la chat menu</p>
            <p className="mt-1 text-xs text-zinc-600">
              Scegli una frase esempio o scrivi liberamente: la chat adatta il menu rispettando età, svezzamento, esclusioni e sicurezza.
            </p>
            <div className="mt-3 space-y-3">
              {CHAT_INSTRUCTION_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">{group.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.examples.map((example) => (
                      <Button
                        key={`${group.title}-${example}`}
                        type="button"
                        variant="secondary"
                        className="px-3 py-1.5 text-xs font-medium"
                        onClick={() => {
                          setPrompt(example);
                          setShowInstructions(false);
                        }}
                      >
                        {example}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <form className="mt-4 space-y-3" onSubmit={submitPrompt}>
          <Textarea
            value={prompt}
            placeholder={textareaPlaceholder}
            className="min-h-[240px] resize-none"
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? (hasGeneratedToday ? "Modifica in corso..." : "Generazione menu...") : hasGeneratedToday ? "Modifica menu" : "Genera menu"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="border border-rose-300 bg-rose-100 text-rose-900"
              aria-expanded={showInstructions}
              onClick={() => setShowInstructions((current) => !current)}
            >
              {showInstructions ? "Chiudi istruzioni" : "Istruzioni Utilizzo"}
            </Button>
          </div>
        </form>

        {statusMessage ? <p className="mt-3 text-sm text-zinc-700">{statusMessage}</p> : null}
      </Card>

      <Card>
        <CardTitle>Sessioni Chat</CardTitle>
        <div className="mt-4 space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessuna sessione disponibile oggi.</p>
          ) : (
            sessions.slice(0, MENU_SESSION_PANEL_VISIBLE_ITEMS).map((session, index) => (
              <button
                key={session.id}
                type="button"
                className={`min-h-[64px] w-full rounded-2xl px-3 py-2 text-left text-sm transition ${
                  session.id === activeSessionId ? "bg-rose-100 text-rose-800" : "bg-zinc-50 text-zinc-700 hover:bg-rose-50"
                }`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <p className="font-medium">{`Sessione ${index + 1}`}</p>
                <p className="text-xs opacity-75">{new Date(session.last_message_at).toLocaleString("it-IT")}</p>
              </button>
            ))
          )}
        </div>
      </Card>

      {latestMenu ? (
        <Card className="lg:col-span-3">
          <CardTitle>Menu giornaliero</CardTitle>
          <CardDescription>
            {latestMenu.title} • Età:{" "}
            {latestMenu.childProfileSummary.ageMonths !== null ? `${latestMenu.childProfileSummary.ageMonths} mesi` : "non specificata"} •
            Svezzamento: {latestMenu.childProfileSummary.weaningType}
          </CardDescription>

          {latestMenu.childProfileSummary.notes.length > 0 ? (
            <div className="mt-3 rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-700">
              <p className="font-medium text-zinc-800">Profilo e vincoli applicati</p>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {latestMenu.childProfileSummary.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

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
                {meal.balancedPlate ? (
                  <div className="mt-2 rounded-xl bg-emerald-50 p-2 text-xs text-emerald-800">
                    <p className="font-semibold">Piatto bilanciato</p>
                    <p>Carboidrati: {meal.balancedPlate.carbs}</p>
                    <p>Proteine: {meal.balancedPlate.proteins}</p>
                    <p>Verdure: {meal.balancedPlate.vegetables}</p>
                    <p>Grassi buoni: {meal.balancedPlate.healthyFats}</p>
                  </div>
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
        <div className="lg:col-span-3">
          <EmptyState
            title="Nessun menu ancora generato"
            description="Invia il primo messaggio alla chat per ottenere un piano giornaliero personalizzato."
          />
        </div>
      )}
    </div>
  );
}
