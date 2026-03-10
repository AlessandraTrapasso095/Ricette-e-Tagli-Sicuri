"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface BookUnlockCardProps {
  book: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    unlocked: boolean;
    unlockedAt: string | null;
  };
  onUnlocked?: () => void;
}

interface ChallengeResponse {
  challengeId: string;
  promptText: string;
  pageNumber: number;
}

export function BookUnlockCard({ book, onUnlocked }: BookUnlockCardProps) {
  const [isUnlocked, setIsUnlocked] = useState(book.unlocked);
  const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);

  useEffect(() => {
    setIsUnlocked(book.unlocked);
  }, [book.unlocked]);

  async function loadChallenge() {
    setLoadingChallenge(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/books/${book.slug}/challenge`, { method: "GET" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Challenge non disponibile");
      }

      setChallenge(json.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Errore nel caricamento challenge");
    } finally {
      setLoadingChallenge(false);
    }
  }

  async function submitUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!challenge) {
      return;
    }

    setLoadingSubmit(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/books/${book.slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          answer,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? json.message ?? "Errore durante la verifica");
      }

      setMessage(json.message ?? json.data?.message ?? "Operazione completata.");

      if (json.status === "success") {
        setIsUnlocked(true);
        setChallenge(null);
        setAnswer("");
        onUnlocked?.();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Verifica non riuscita");
    } finally {
      setLoadingSubmit(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>{book.title}</CardTitle>
          <CardDescription>{book.description ?? "Libro della collana Area Lettori"}</CardDescription>
        </div>
        {isUnlocked ? <Badge variant="success">Sbloccato</Badge> : <Badge variant="warning">Da sbloccare</Badge>}
      </div>

      {isUnlocked ? (
        <p className="mt-4 text-sm text-emerald-700">Accesso attivo ai contenuti bonus del libro.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {!challenge ? (
            <Button variant="secondary" onClick={loadChallenge} disabled={loadingChallenge}>
              {loadingChallenge ? "Caricamento challenge..." : "Mostra challenge"}
            </Button>
          ) : (
            <form className="space-y-3" onSubmit={submitUnlock}>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-rose-800">
                <p className="font-semibold">Challenge pagina {challenge.pageNumber}</p>
                <p>{challenge.promptText}</p>
              </div>
              <Input
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Inserisci la parola segreta"
              />
              <Button type="submit" disabled={loadingSubmit || answer.trim().length === 0}>
                {loadingSubmit ? "Verifica in corso..." : "Verifica e sblocca"}
              </Button>
            </form>
          )}
        </div>
      )}

      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
    </Card>
  );
}
