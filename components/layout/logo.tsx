import Link from "next/link";
import Image from "next/image";

export function BrandLogo({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-3">
      <Image
        src="/brand/logo-ricette-tagli-sicuri.png"
        alt="Logo Ricette e Tagli Sicuri"
        width={48}
        height={48}
        className="h-12 w-12 rounded-full object-cover shadow-sm"
        priority
      />
      {!compact ? (
        <span className="font-heading text-lg font-semibold tracking-tight text-rose-900">
          Ricette e Tagli Sicuri
        </span>
      ) : null}
    </Link>
  );
}
