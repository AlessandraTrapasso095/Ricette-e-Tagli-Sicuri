import type { ReactNode } from "react";

import { ReaderAreaNavCard } from "@/components/dashboard/reader-area-nav-card";

interface ReaderAreaPageLayoutProps {
  children: ReactNode;
}

export function ReaderAreaPageLayout({ children }: ReaderAreaPageLayoutProps) {
  return (
    <div className="grid items-start gap-4 lg:gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
      <ReaderAreaNavCard />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
