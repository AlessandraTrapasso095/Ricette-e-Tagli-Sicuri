"use client";

import Link from "next/link";

import {
  DISCLAIMER_ACCEPT_BUTTON_LABEL,
  DISCLAIMER_PARAGRAPHS,
  DISCLAIMER_TITLE,
  DISCLAIMER_VERSION,
} from "@/config/disclaimer";
import { Button } from "@/components/ui/button";

interface DisclaimerModalProps {
  onAccept: () => void;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}

export function DisclaimerModal({ onAccept, isSubmitting = false, errorMessage = null }: DisclaimerModalProps) {
  return (
    <div className="w-full max-w-2xl rounded-3xl border border-rose-100 bg-white p-5 shadow-[0_24px_70px_rgba(0,0,0,0.18)] sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Versione {DISCLAIMER_VERSION}</p>
      <h2 id="disclaimer-title" className="mt-2 font-heading text-2xl font-semibold text-rose-900">
        {DISCLAIMER_TITLE}
      </h2>

      <div className="mt-4 max-h-[52vh] space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed text-zinc-700 sm:text-[15px]">
        {DISCLAIMER_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/disclaimer" className="text-sm font-medium text-rose-700 hover:text-rose-800">
          Leggi la versione completa
        </Link>
        <Button type="button" onClick={onAccept} disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Salvataggio..." : DISCLAIMER_ACCEPT_BUTTON_LABEL}
        </Button>
      </div>
    </div>
  );
}
