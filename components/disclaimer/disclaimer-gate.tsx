"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DisclaimerModal } from "@/components/disclaimer/disclaimer-modal";

interface DisclaimerGateProps {
  initialAccepted: boolean;
  children: ReactNode;
}

export function DisclaimerGate({ initialAccepted, children }: DisclaimerGateProps) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(initialAccepted);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setAccepted(initialAccepted);
  }, [initialAccepted]);

  useEffect(() => {
    if (accepted) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [accepted]);

  async function handleAccept() {
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/disclaimer/accept", {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Impossibile registrare l'accettazione.");
      }

      setAccepted(true);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Errore durante l'accettazione.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className={accepted ? "" : "pointer-events-none select-none"} aria-hidden={accepted ? undefined : true}>
        {children}
      </div>

      {!accepted ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="disclaimer-title" className="w-full max-w-2xl">
            <DisclaimerModal onAccept={handleAccept} isSubmitting={submitting} errorMessage={errorMessage} />
          </div>
        </div>
      ) : null}
    </>
  );
}
