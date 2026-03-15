import Link from "next/link";

import { ReaderAreaPageLayout } from "@/components/dashboard/reader-area-page-layout";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getAvailableBonusFiles } from "@/server/bonus/bonus-service";
import { requireUser } from "@/server/auth/session";

export default async function DashboardBonusPage() {
  const user = await requireUser("/login");
  const bonusFiles = await getAvailableBonusFiles(user.id);

  if (bonusFiles.length === 0) {
    return (
      <ReaderAreaPageLayout>
        <EmptyState
          title="Nessun bonus disponibile"
          description="Sblocca almeno un libro nella sezione Libri per accedere ai bonus PDF dedicati."
        />
      </ReaderAreaPageLayout>
    );
  }

  return (
    <ReaderAreaPageLayout>
      <div className="grid gap-4">
        {bonusFiles.map((bonus) => (
          <Card key={bonus.id}>
            <CardTitle>{bonus.title}</CardTitle>
            <CardDescription>
              {bonus.description ?? "Bonus riservato ai lettori verificati"} • Libro: {bonus.book.title}
            </CardDescription>
            <div className="mt-4">
              <Link
                href={`/api/bonus/${bonus.id}/download`}
                className="inline-flex rounded-2xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                Scarica PDF
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </ReaderAreaPageLayout>
  );
}
