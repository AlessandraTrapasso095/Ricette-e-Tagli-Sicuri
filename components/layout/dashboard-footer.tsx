import Link from "next/link";

export function DashboardFooter() {
  return (
    <footer className="border-t border-rose-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Ricette e Tagli Sicuri. Tutti i diritti riservati.</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/faq" className="hover:text-rose-600">
            FAQ
          </Link>
          <Link href="/dashboard/supporto" className="hover:text-rose-600">
            Supporto
          </Link>
          <Link href="/privacy" className="hover:text-rose-600">
            Privacy
          </Link>
          <Link href="/termini" className="hover:text-rose-600">
            Termini
          </Link>
        </div>
      </div>
    </footer>
  );
}
