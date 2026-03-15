import { businessRulesConfig } from "@/config/business-rules";
import { cn } from "@/lib/utils";

interface BalancedPlateGuideProps {
  ageMonths: number | null;
  className?: string;
}

export function BalancedPlateGuide({ ageMonths, className }: BalancedPlateGuideProps) {
  const useOver24 = ageMonths !== null && ageMonths >= 24;
  const ratios = useOver24 ? businessRulesConfig.balancedPlate.over24Months : businessRulesConfig.balancedPlate.under24Months;
  const schemeLabel = useOver24 ? "Oltre 24 mesi" : "Fino a 24 mesi";

  return (
    <div className={cn("w-full max-w-[272px] rounded-2xl border border-rose-100 bg-rose-50/60 p-2.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Piatto bilanciato</p>
        <p className="text-[11px] font-medium text-rose-900">{schemeLabel}</p>
      </div>
      <div className="mt-2 space-y-1 text-sm text-zinc-700">
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-2.5 py-1 leading-5">
          <span>Carboidrati</span>
          <span className="font-semibold text-rose-900">{ratios.carbsRatio}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-2.5 py-1 leading-5">
          <span>Proteine</span>
          <span className="font-semibold text-rose-900">{ratios.proteinsRatio}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 px-2.5 py-1 leading-5">
          <span>Verdure</span>
          <span className="font-semibold text-rose-900">{ratios.vegetablesRatio}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-zinc-600">
        Grassi buoni: <span className="font-medium text-zinc-800">{ratios.healthyFats}</span>
      </p>
      {ageMonths === null ? (
        <p className="mt-1.5 text-[11px] leading-4 text-zinc-500">Età non specificata: schema prudente fino a 24 mesi.</p>
      ) : null}
    </div>
  );
}
