import { Card } from "@/components/ui/card";

export const metadata = {
  title: "Privacy | Ricette e Tagli Sicuri",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Card>
        <h1 className="font-heading text-3xl text-rose-900">Privacy Policy</h1>
        <div className="mt-4 space-y-3 text-sm text-zinc-600">
          <p>
            Trattiamo i dati strettamente necessari per fornire l&apos;Area Lettori privata, la gestione bonus, il supporto e la chat
            menu personalizzata.
          </p>
          <p>I file bonus sono protetti e accessibili solo dopo verifica del libro acquistato.</p>
          <p>
            Per richieste su privacy o cancellazione dati puoi contattarci tramite la sezione Supporto presente nella dashboard.
          </p>
        </div>
      </Card>
    </div>
  );
}
