import Link from "next/link";
import { ArrowRight, ArrowDownToLine } from "lucide-react";

import { DiscoverBooksCard } from "@/components/dashboard/discover-books-card";
import { QuickOverview } from "@/components/dashboard/quick-overview";
import { Card } from "@/components/ui/card";
import { normalizeUserGender } from "@/lib/user-gender";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminRecommendedBooks } from "@/server/admin/admin-service";
import { getAvailableBonusFiles } from "@/server/bonus/bonus-service";
import { getUserUnlockedBooks } from "@/server/books/book-access-service";
import { getUserChatAccessStatus } from "@/server/chat/chat-access";
import { getPrimaryChildProfile } from "@/server/children/child-service";
import { requireUser } from "@/server/auth/session";

export default async function DashboardPage() {
  const user = await requireUser("/login");
  const supabase = await createSupabaseServerClient();

  const [profileResult, unlockedBooks, availableBonus, childProfile, chatAccess, recommendedBooks] = await Promise.all([
    supabase.from("profiles").select("display_name, full_name, email, gender").eq("id", user.id).maybeSingle(),
    getUserUnlockedBooks(user.id),
    getAvailableBonusFiles(user.id),
    getPrimaryChildProfile(user.id),
    getUserChatAccessStatus(user.id),
    getAdminRecommendedBooks(),
  ]);

  const userName =
    profileResult.data?.display_name ??
    profileResult.data?.full_name ??
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
    "Lettore";

  return (
    <div className="space-y-8">
      <QuickOverview
        userName={userName}
        gender={normalizeUserGender(profileResult.data?.gender ?? user.user_metadata?.gender)}
        unlockedCount={unlockedBooks.length}
        bonusCount={availableBonus.length}
        hasChildProfile={Boolean(childProfile)}
        hasChatAccess={chatAccess.hasAccess}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 border-0 bg-transparent p-0 shadow-none sm:border sm:border-rose-100 sm:bg-white sm:p-6 sm:shadow-[0_10px_35px_rgba(236,72,153,0.08)]">
          <div className="space-y-1">
            <h3 className="font-heading text-2xl font-semibold text-rose-900">Bonus disponibili</h3>
            <p className="text-sm text-zinc-600">Scarica i PDF dei libri già verificati.</p>
          </div>

          <div className="space-y-3">
            {availableBonus.length === 0 ? (
              <Card className="rounded-3xl p-5">
                <p className="text-sm text-zinc-500">Sblocca almeno un libro per accedere ai bonus dedicati.</p>
              </Card>
            ) : (
              availableBonus.slice(0, 4).map((bonus) => (
                <Link
                  key={bonus.id}
                  href="/dashboard/bonus"
                  className="flex items-center justify-between rounded-3xl border border-rose-100 bg-rose-50/80 px-4 py-4 transition hover:bg-rose-100"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-rose-900">{bonus.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">{bonus.book.title}</p>
                  </div>
                  <span className="ml-4 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-rose-600 shadow-sm">
                    <ArrowDownToLine className="h-4 w-4" />
                  </span>
                </Link>
              ))
            )}
          </div>

          <Link href="/dashboard/bonus" className="inline-flex items-center gap-2 text-sm font-bold text-rose-600 hover:text-rose-700">
            Vai ai bonus <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        <DiscoverBooksCard books={recommendedBooks.filter((book) => book.isActive)} />
      </div>
    </div>
  );
}
