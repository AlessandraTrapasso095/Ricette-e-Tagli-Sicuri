"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ReaderAreaNavCard } from "@/components/dashboard/reader-area-nav-card";
import { BalancedPlateGuide } from "@/components/dashboard/balanced-plate-guide";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { MENU_SESSION_PANEL_VISIBLE_ITEMS } from "@/config/chat-session";
import { DailyMenuDisplay } from "@/components/dashboard/daily-menu-display";
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
const SAFE_CUTS_DISCLAIMER = "Offrire sempre nei tagli sicuri adeguati all'età del vostro bimbo/a.";
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
    examples: ["Cambia la cena e proponimi altro", "Trasforma il pranzo in una vellutata", "Rifai la colazione con un porridge"],
  },
  {
    title: "Esclusioni e vincoli",
    examples: ["Non ho zucchine", "Senza uovo", "No latticini"],
  },
] as const;

export function ChatMenuPanel() {
  const [sessions, setSessions] = useState<MenuSession[]>([]);
  const [messages, setMessages] = useState<MenuMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_CHAT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedState | null>(null);
  const lastMessagesRequestId = useRef(0);

  const loadSessions = useCallback(async () => {
    const response = await fetch("/api/menu/sessions", { method: "GET", credentials: "include" });
    const json = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Sessione scaduta. Accedi di nuovo per continuare.");
      }
      throw new Error(json.error ?? "Impossibile caricare le sessioni.");
    }

    setSessions(json.data ?? []);

    if (!json.data?.length) {
      setActiveSessionId(null);
      setMessages([]);
      setLoadedSessionId(null);
      setGenerated(null);
      return;
    }

    const hasCurrentActive = activeSessionId ? json.data.some((item: MenuSession) => item.id === activeSessionId) : false;
    if (!hasCurrentActive) {
      setActiveSessionId(json.data[0].id);
    }
  }, [activeSessionId]);

  const loadMessages = useCallback(async (sessionId: string) => {
    const requestId = ++lastMessagesRequestId.current;
    const response = await fetch(`/api/menu/sessions?sessionId=${sessionId}`, {
      method: "GET",
      credentials: "include",
    });
    const json = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Sessione scaduta. Accedi di nuovo per continuare.");
      }
      throw new Error(json.error ?? "Impossibile caricare i messaggi.");
    }

    if (requestId !== lastMessagesRequestId.current) {
      return;
    }

    setMessages(json.data ?? []);
    setLoadedSessionId(sessionId);
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
    if (generated && generated.sessionId === activeSessionId) {
      return generated.menu;
    }

    if (loadedSessionId !== activeSessionId) {
      return null;
    }

    const found = [...messages].reverse().find((message) => message.menu_payload);
    return found?.menu_payload ?? null;
  }, [messages, generated, activeSessionId, loadedSessionId]);

  const profileAlerts = useMemo(() => {
    if (!latestMenu) {
      return [];
    }

    return latestMenu.childProfileSummary.notes.filter(
      (note) => note.startsWith("Allergie/intolleranze:") || note.startsWith("Alimenti da evitare:"),
    );
  }, [latestMenu]);
  const showSafeCutsDisclaimer =
    latestMenu?.childProfileSummary.weaningType === "autosvezzamento" || latestMenu?.childProfileSummary.weaningType === "misto";

  const hasGeneratedMenu = sessions.length > 0 || generated !== null;
  const canSubmit = prompt.trim().length >= 2 && (!hasGeneratedMenu || Boolean(activeSessionId));
  const textareaPlaceholder = hasGeneratedMenu ? MODIFY_CHAT_PLACEHOLDER : DEFAULT_CHAT_PROMPT;

  useEffect(() => {
    if (!hasGeneratedMenu) {
      return;
    }

    if (prompt.trim().toLowerCase() === DEFAULT_CHAT_PROMPT.toLowerCase()) {
      setPrompt("");
    }
  }, [hasGeneratedMenu, prompt]);

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const isModificationRequest = Boolean(activeSessionId && hasGeneratedMenu);
      const requestPayload = {
        prompt,
        saveMenu: false,
        ...(isModificationRequest ? { sourceSessionId: activeSessionId } : {}),
      };

      const response = await fetch("/api/chat-menu", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      const json = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Sessione scaduta. Accedi di nuovo per continuare.");
        }
        throw new Error(json.error ?? "Errore generazione menu");
      }

      const responseData = json.data;
      setMessages([]);
      setLoadedSessionId(null);
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
    <div className="grid items-start gap-4 xl:grid-cols-[210px_minmax(0,1fr)_240px] xl:gap-6">
      <ReaderAreaNavCard />

      <Card>
        <CardTitle>Cosa mangiamo oggi?</CardTitle>
        <CardDescription>
          Qui puoi generare il tuo menu giornaliero, trovi tutte le info in{" "}
          <span className="font-semibold">&quot;Istruzioni Utilizzo&quot;</span>. La chat rispetta in modo tassativo
          le esclusioni indicate nel messaggio e nel profilo bambino, comprese allergie e alimenti da evitare. Buon
          Svezzamento! ❤️👦🏼
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
                        className="min-h-[42px] rounded-2xl border border-rose-200 bg-white px-3 py-2 text-left text-xs font-medium text-rose-900 shadow-sm hover:bg-rose-100"
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
            className="min-h-[180px] resize-none sm:min-h-[220px]"
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="grid gap-3 sm:flex sm:flex-wrap">
            <Button className="w-full sm:w-auto" type="submit" disabled={loading || !canSubmit}>
              {loading ? (hasGeneratedMenu ? "Modifica in corso..." : "Generazione menu...") : hasGeneratedMenu ? "Modifica menu" : "Genera menu"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="w-full border border-rose-300 bg-rose-100 text-rose-900 sm:w-auto"
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
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">Nessuna sessione disponibile.</p>
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
        <Card className="xl:col-span-2">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_272px] lg:items-start">
            <div className="space-y-3">
              <div>
                <CardTitle>Menu giornaliero</CardTitle>
                <CardDescription>
                  {latestMenu.title} • Età:{" "}
                  {latestMenu.childProfileSummary.ageMonths !== null ? `${latestMenu.childProfileSummary.ageMonths} mesi` : "non specificata"} •
                  Svezzamento: {latestMenu.childProfileSummary.weaningType}
                </CardDescription>
              </div>
              {(profileAlerts.length > 0 || showSafeCutsDisclaimer) ? (
                <div className="space-y-3">
                  {profileAlerts.length > 0 ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50/70 px-4 py-3 text-sm text-rose-900">
                      {profileAlerts.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  ) : null}
                  {showSafeCutsDisclaimer ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                      {SAFE_CUTS_DISCLAIMER}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <BalancedPlateGuide
              ageMonths={latestMenu.childProfileSummary.ageMonths}
              className="max-w-none lg:self-start"
            />
          </div>
          <DailyMenuDisplay menu={latestMenu} className="mt-4" />
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
