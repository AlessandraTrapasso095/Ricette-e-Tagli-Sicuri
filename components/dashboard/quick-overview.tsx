import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

interface QuickOverviewProps {
  userName: string;
  unlockedCount: number;
  bonusCount: number;
  hasChildProfile: boolean;
}

export function QuickOverview({ userName, unlockedCount, bonusCount, hasChildProfile }: QuickOverviewProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Ciao {userName}, benvenuta nell&apos;Area Lettori</CardTitle>
        <CardDescription>
          Da qui gestisci i tuoi libri sbloccati, i bonus PDF e i menu giornalieri personalizzati.
        </CardDescription>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard/chat-menu"
            className="rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-600"
          >
            Cosa mangiamo oggi?
          </Link>
          <Link
            href="/dashboard/libri"
            className="rounded-2xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-900 transition hover:bg-rose-200"
          >
            Sblocca un altro libro
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/dashboard/libri" className="block">
          <Card className="transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)]">
            <CardTitle className="text-2xl">{unlockedCount}</CardTitle>
            <CardDescription>Libri sbloccati</CardDescription>
          </Card>
        </Link>
        <Link href="/dashboard/bonus" className="block">
          <Card className="transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)]">
            <CardTitle className="text-2xl">{bonusCount}</CardTitle>
            <CardDescription>Bonus disponibili</CardDescription>
          </Card>
        </Link>
        <Link href="/dashboard/profilo-bambino" className="block">
          <Card className="transition hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_14px_35px_rgba(236,72,153,0.12)]">
            <CardTitle className="text-2xl">{hasChildProfile ? "Completo" : "Da compilare"}</CardTitle>
            <CardDescription>Profilo bambino</CardDescription>
          </Card>
        </Link>
      </div>
    </div>
  );
}
