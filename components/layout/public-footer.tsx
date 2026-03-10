import Link from "next/link";

import { DISCLAIMER_SHORT_TEXT } from "@/config/disclaimer";

export function PublicFooter() {
  return (
    <footer className="border-t border-rose-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-zinc-500 sm:px-6 lg:px-8">
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-xs leading-relaxed text-zinc-600">
          {DISCLAIMER_SHORT_TEXT}{" "}
          <Link href="/disclaimer" className="font-semibold text-rose-700 hover:text-rose-800">
            Leggi il disclaimer completo
          </Link>
          .
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Ricette e Tagli Sicuri. Tutti i diritti riservati.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-rose-600">
              Privacy
            </Link>
            <Link href="/termini" className="hover:text-rose-600">
              Termini
            </Link>
            <Link href="/faq" className="hover:text-rose-600">
              FAQ
            </Link>
            <Link href="/disclaimer" className="hover:text-rose-600">
              Disclaimer
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
