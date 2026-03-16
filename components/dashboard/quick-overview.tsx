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
      <Card className="rounded-[2rem] px-5 pb-7 pt-8 text-center shadow-[0_14px_34px_rgba(236,72,153,0.07)] sm:rounded-3xl sm:p-6 sm:text-left sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
        <CardTitle className="mx-auto max-w-[15.75rem] text-[1.52rem] leading-[1.24] font-bold tracking-[-0.02em] sm:mx-0 sm:max-w-none sm:text-[2.05rem] sm:font-semibold">
          Ciao {userName}, benvenuta nell&apos;Area Lettori
        </CardTitle>
        <CardDescription className="mx-auto mt-5 max-w-[16.75rem] text-[0.88rem] leading-[1.6] text-zinc-500 sm:mx-0 sm:mt-3 sm:max-w-none sm:text-base sm:leading-relaxed">
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

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Link href="/dashboard/libri" className="block">
          <Card className="flex min-h-[6.35rem] flex-col items-center justify-center px-2 py-3 text-center shadow-[0_14px_34px_rgba(236,72,153,0.07)] transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:px-6 sm:py-6 sm:text-left sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
            <CardTitle className="text-[1.85rem] leading-none sm:text-3xl">{unlockedCount}</CardTitle>
            <CardDescription className="mt-2 max-w-[4.6rem] text-[0.75rem] font-medium leading-[1.2] sm:mt-2 sm:max-w-none sm:text-base">Libri sbloccati</CardDescription>
          </Card>
        </Link>
        <Link href="/dashboard/bonus" className="block">
          <Card className="flex min-h-[6.35rem] flex-col items-center justify-center px-2 py-3 text-center shadow-[0_14px_34px_rgba(236,72,153,0.07)] transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:px-6 sm:py-6 sm:text-left sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
            <CardTitle className="text-[1.85rem] leading-none sm:text-3xl">{bonusCount}</CardTitle>
            <CardDescription className="mt-2 max-w-[4.9rem] text-[0.75rem] font-medium leading-[1.2] sm:mt-2 sm:max-w-none sm:text-base">Bonus disponibili</CardDescription>
          </Card>
        </Link>
        <Link href="/dashboard/profilo-bambino" className="block">
          <Card className="flex min-h-[6.35rem] flex-col items-center justify-center px-2 py-3 text-center shadow-[0_14px_34px_rgba(236,72,153,0.07)] transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:px-6 sm:py-6 sm:text-left sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
            <CardTitle
              className="text-[1.85rem] leading-none sm:text-3xl"
              aria-label={hasChildProfile ? "Profilo bambino completato" : "Profilo bambino da compilare"}
            >
              {hasChildProfile ? "✓" : "✕"}
            </CardTitle>
            <CardDescription className="mt-2 max-w-[4.9rem] text-[0.75rem] font-medium leading-[1.2] whitespace-normal [word-break:keep-all] sm:mt-2 sm:max-w-none sm:text-base">
              Profilo bambino
            </CardDescription>
          </Card>
        </Link>
      </div>
    </div>
  );
}
