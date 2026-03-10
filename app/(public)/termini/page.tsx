import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Termini | Ricette e Tagli Sicuri",
};

export default function TerminiPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Card>
        <h1 className="font-heading text-3xl text-rose-900">Termini di utilizzo</h1>
        <div className="mt-4 space-y-3 text-sm text-zinc-600">
          <p>L&apos;accesso all&apos;Area Lettori è riservato agli acquirenti dei libri della collana.</p>
          <p>Ogni account può essere verificato tramite challenge presenti nei libri acquistati.</p>
          <p>I contenuti sono ad uso personale e non possono essere redistribuiti senza autorizzazione.</p>
          <p>La chat menu fornisce suggerimenti informativi e non sostituisce parere medico professionale.</p>
        </div>
      </Card>
    </div>
  );
}
