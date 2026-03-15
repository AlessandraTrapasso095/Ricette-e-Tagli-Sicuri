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
      <Card className="p-5 text-center sm:p-6 sm:text-left">
        <CardTitle className="mx-auto max-w-3xl text-2xl leading-tight sm:mx-0 sm:max-w-none sm:text-[2.05rem]">
          Ciao {userName}, benvenuta nell&apos;Area Lettori
        </CardTitle>
        <CardDescription className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed sm:mx-0 sm:max-w-none sm:text-base">
          Da qui gestisci i tuoi libri sbloccati, i bonus PDF e i menu giornalieri personalizzati.
        </CardDescription>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {hasChatAccess ? (
            <Link
              href="/dashboard/chat-menu"
              className="rounded-2xl bg-rose-500 px-4 py-3.5 text-center text-sm font-bold text-white transition hover:bg-rose-600 sm:px-5 sm:py-3"
            >
              Cosa mangiamo oggi?
            </Link>
          ) : (
            <Link
              href="/dashboard/libri"
              className="rounded-2xl bg-amber-100 px-4 py-3.5 text-center text-sm font-bold text-amber-900 transition hover:bg-amber-200 sm:px-5 sm:py-3"
            >
              Sblocca un libro per attivare la chat
            </Link>
          )}
          <Link
            href="/dashboard/libri"
            className="rounded-2xl bg-rose-50 px-4 py-3.5 text-center text-sm font-bold text-rose-900 transition hover:bg-rose-100 sm:px-5 sm:py-3"
          >
            Sblocca un altro libro
          </Link>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Link
              href="/dashboard/supporto"
              className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200 transition hover:bg-rose-50 hover:text-rose-800 sm:px-5"
            >
              Chiedi Supporto
            </Link>
            <Link
              href="/dashboard/impostazioni"
              className="rounded-2xl bg-zinc-100 px-4 py-3 text-center text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200 sm:px-5"
            >
              Impostazioni
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/libri" className="block">
          <Card className="flex min-h-[112px] flex-col items-center justify-center text-center transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:text-left">
            <CardTitle className="text-4xl sm:text-3xl">{unlockedCount}</CardTitle>
            <CardDescription className="mt-2 text-xs font-medium sm:text-base">Libri sbloccati</CardDescription>
          </Card>
        </Link>
        <Link href="/dashboard/bonus" className="block">
          <Card className="flex min-h-[112px] flex-col items-center justify-center text-center transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:text-left">
            <CardTitle className="text-4xl sm:text-3xl">{bonusCount}</CardTitle>
            <CardDescription className="mt-2 text-xs font-medium sm:text-base">Bonus disponibili</CardDescription>
          </Card>
        </Link>
        <Link href="/dashboard/profilo-bambino" className="block">
          <Card className="flex min-h-[112px] flex-col items-center justify-center text-center transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)] sm:min-h-[128px] sm:items-start sm:justify-start sm:text-left">
            <CardTitle className="text-3xl sm:text-2xl">{hasChildProfile ? "Completo" : "Da compilare"}</CardTitle>
            <CardDescription className="mt-2 text-xs font-medium sm:text-base">Profilo bambino</CardDescription>
          </Card>
        </Link>
      </div>
    </div>
  );
}
