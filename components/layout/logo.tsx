import Link from "next/link";
import Image from "next/image";
import { getReaderFacingName } from "@/server/settings/app-settings-service";

export async function BrandLogo({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  const readerFacingName = await getReaderFacingName();

  return (
    <Link href={href} className="inline-flex max-w-full items-center gap-3 sm:gap-3">
      <Image
        src="/brand/logo-ricette-tagli-sicuri.png"
        alt="Logo Ricette e Tagli Sicuri"
        width={48}
        height={48}
        className="h-12 w-12 rounded-full object-cover shadow-sm sm:h-12 sm:w-12"
        priority
      />
      {!compact ? (
        <span className="inline-flex min-w-0 flex-col leading-tight">
          <span className="font-heading text-[1.12rem] font-semibold tracking-tight text-rose-900 sm:text-lg">Ricette e Tagli Sicuri</span>
          <span className="text-[0.8rem] font-medium text-rose-700/80 sm:text-[10px]">di {readerFacingName}</span>
        </span>
      ) : null}
    </Link>
  );
}
