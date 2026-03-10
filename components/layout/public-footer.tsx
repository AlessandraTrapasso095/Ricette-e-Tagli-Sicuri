import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-rose-100 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
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
        </div>
      </div>
    </footer>
  );
}
