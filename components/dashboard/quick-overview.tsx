import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

interface QuickOverviewProps {
  userName: string;
  unlockedCount: number;
  bonusCount: number;
  hasChildProfile: boolean;
  hasChatAccess: boolean;
}

export function QuickOverview({ userName, unlockedCount, bonusCount, hasChildProfile, hasChatAccess }: QuickOverviewProps) {
  return (
    <div className="space-y-5">
      <Card className="rounded-[2rem] px-6 pb-7 pt-9 text-center shadow-[0_14px_34px_rgba(236,72,153,0.07)] sm:rounded-3xl sm:p-6 sm:text-left sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
        <CardTitle className="mx-auto max-w-[18.25rem] text-[1.72rem] leading-[1.28] font-bold tracking-[-0.025em] sm:mx-0 sm:max-w-none sm:text-[2.05rem] sm:font-semibold">
          Ciao {userName}, benvenuta nell&apos;Area Lettori
        </CardTitle>
        <CardDescription className="mx-auto mt-6 max-w-[20rem] text-[0.98rem] leading-[1.65] text-zinc-500 sm:mx-0 sm:mt-3 sm:max-w-none sm:text-base sm:leading-relaxed">
          Da qui gestisci i tuoi libri sbloccati, i bonus PDF e i menu giornalieri personalizzati.
        </CardDescription>
        <div className="mt-8 hidden sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          {hasChatAccess ? (
            <Link
              href="/dashboard/chat-menu"
              className="rounded-2xl bg-rose-500 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-rose-600"
            >
              Cosa mangiamo oggi?
            </Link>
          ) : (
            <Link
              href="/dashboard/libri"
              className="rounded-2xl bg-amber-100 px-5 py-3 text-center text-sm font-bold text-amber-900 transition hover:bg-amber-200"
            >
              Sblocca un libro per attivare la chat
            </Link>
          )}
          <Link
            href="/dashboard/libri"
            className="rounded-2xl bg-rose-50 px-5 py-3 text-center text-sm font-bold text-rose-900 transition hover:bg-rose-100"
          >
            Sblocca un altro libro
          </Link>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/dashboard/supporto"
              className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200 transition hover:bg-rose-50 hover:text-rose-800"
            >
              Chiedi Supporto
            </Link>
            <Link
              href="/dashboard/impostazioni"
              className="rounded-2xl bg-zinc-100 px-5 py-3 text-center text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200"
            >
              Impostazioni
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Link href="/dashboard/libri" className="block">
          <Card className="flex min-h-[6.75rem] flex-col items-center justify-center px-3 py-4 text-center shadow-[0_14px_34px_rgba(236,72,153,0.07)] transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:px-6 sm:py-6 sm:text-left sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
            <CardTitle className="text-[2rem] leading-none sm:text-3xl">{unlockedCount}</CardTitle>
            <CardDescription className="mt-2 text-[0.78rem] font-medium leading-tight sm:mt-2 sm:text-base">Libri sbloccati</CardDescription>
          </Card>
        </Link>
        <Link href="/dashboard/bonus" className="block">
          <Card className="flex min-h-[6.75rem] flex-col items-center justify-center px-3 py-4 text-center shadow-[0_14px_34px_rgba(236,72,153,0.07)] transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:px-6 sm:py-6 sm:text-left sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
            <CardTitle className="text-[2rem] leading-none sm:text-3xl">{bonusCount}</CardTitle>
            <CardDescription className="mt-2 text-[0.78rem] font-medium leading-tight sm:mt-2 sm:text-base">Bonus disponibili</CardDescription>
          </Card>
        </Link>
        <Link href="/dashboard/profilo-bambino" className="block">
          <Card className="flex min-h-[6.75rem] flex-col items-center justify-center px-3 py-4 text-center shadow-[0_14px_34px_rgba(236,72,153,0.07)] transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:px-6 sm:py-6 sm:text-left sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
            <CardTitle className="text-[1.45rem] leading-none sm:text-2xl">{hasChildProfile ? "Completo" : "Da compilare"}</CardTitle>
            <CardDescription className="mt-2 text-[0.78rem] font-medium leading-tight sm:mt-2 sm:text-base">Profilo bambino</CardDescription>
          </Card>
        </Link>
      </div>
    </div>
  );
}
