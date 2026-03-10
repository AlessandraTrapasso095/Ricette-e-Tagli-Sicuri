import { Card } from "@/components/ui/card";

const faqs = [
  {
    question: "Come sblocco i bonus del mio libro?",
    answer:
      "Dopo il login seleziona il libro acquistato e completa la challenge richiesta con la parola presente nel libro.",
  },
  {
    question: "Posso usare la chat menu senza profilo bambino?",
    answer:
      "Sì, ma per output più accurati ti consigliamo di compilare il profilo bambino con età, stile di svezzamento e allergie.",
  },
  {
    question: "Cosa succede se sbaglio troppe volte la challenge?",
    answer: "Per sicurezza si attiva un cooldown temporaneo prima di poter riprovare.",
  },
];

export const metadata = {
  title: "FAQ | Ricette e Tagli Sicuri",
};

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="font-heading text-4xl text-rose-900">FAQ</h1>
      {faqs.map((faq) => (
        <Card key={faq.question}>
          <h2 className="font-semibold text-rose-900">{faq.question}</h2>
          <p className="mt-2 text-sm text-zinc-600">{faq.answer}</p>
        </Card>
      ))}
    </div>
  );
}
