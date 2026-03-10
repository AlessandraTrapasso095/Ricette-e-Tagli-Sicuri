import Link from "next/link";

import { QuickOverview } from "@/components/dashboard/quick-overview";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvailableBonusFiles } from "@/server/bonus/bonus-service";
import { getBooksWithAccess, getUserUnlockedBooks } from "@/server/books/book-access-service";
import { getPrimaryChildProfile } from "@/server/children/child-service";
import { requireUser } from "@/server/auth/session";

export default async function DashboardPage() {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();

  const [profileResult, unlockedBooks, availableBonus, childProfile, allBooks] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    getUserUnlockedBooks(user.id),
    getAvailableBonusFiles(user.id),
    getPrimaryChildProfile(user.id),
    getBooksWithAccess(user.id),
  ]);

  const userName =
    profileResult.data?.full_name ??
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
    "Lettore";

  const lockedBooks = allBooks.filter((book) => !book.unlocked).slice(0, 3);

  return (
    <div className="space-y-6">
      <QuickOverview
        userName={userName}
        unlockedCount={unlockedBooks.length}
        bonusCount={availableBonus.length}
        hasChildProfile={Boolean(childProfile)}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Bonus disponibili</CardTitle>
          <CardDescription>Scarica i PDF dei libri già verificati.</CardDescription>
          <div className="mt-4 space-y-2">
            {availableBonus.length === 0 ? (
              <p className="text-sm text-zinc-500">Sblocca almeno un libro per accedere ai bonus dedicati.</p>
            ) : (
              availableBonus.slice(0, 4).map((bonus) => (
                <div key={bonus.id} className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-zinc-700">
                  <p className="font-semibold text-rose-900">{bonus.title}</p>
                  <p className="text-xs">{bonus.book.title}</p>
                </div>
              ))
            )}
          </div>
          <Link href="/dashboard/bonus" className="mt-4 inline-block text-sm font-semibold text-rose-700 hover:text-rose-800">
            Vai ai bonus
          </Link>
        </Card>

        <Card>
          <CardTitle>Scopri anche gli altri libri</CardTitle>
          <CardDescription>Sblocca nuovi contenuti con challenge rapide e sicure.</CardDescription>
          <div className="mt-4 space-y-2">
            {lockedBooks.length === 0 ? (
              <p className="text-sm text-zinc-500">Hai già sbloccato tutti i libri disponibili.</p>
            ) : (
              lockedBooks.map((book) => (
                <div key={book.id} className="rounded-2xl bg-orange-50 px-3 py-2 text-sm text-zinc-700">
                  <p className="font-semibold text-rose-900">{book.title}</p>
                  <p className="text-xs">Accesso da verificare</p>
                </div>
              ))
            )}
          </div>
          <Link href="/dashboard/libri" className="mt-4 inline-block text-sm font-semibold text-rose-700 hover:text-rose-800">
            Gestisci libri
          </Link>
        </Card>
      </div>
    </div>
  );
}
