import Link from "next/link";

import { Card } from "@/components/ui/card";

const benefits = [
  "Area privata dedicata esclusivamente ai lettori della collana.",
  "Sezione Libri Sbloccati.",
  "Bonus PDF con 20 ricette extra.",
  "Chat menu giornaliera personalizzata in base alle esigenze del tuo bambino.",
];

const lorenaBioParagraphs = [
  "Questo progetto nasce dal cuore, dalle mani e dall'esperienza diretta di una mamma. Prima di essere Lorena di Ricette e Tagli Sicuri, sono semplicemente una mamma che ha vissuto ogni dubbio, ogni paura, ogni sfida legata all'alimentazione della propria bambina.",
  "Non sono una nutrizionista, né una professionista sanitaria, e non mi sono mai presentata come tale. Tutto ciò che trovate in queste pagine è frutto di studio personale, confronto, osservazione e tanta, tanta pratica sul campo. Ho letto, mi sono informata, ho tenuto corsi, ho sperimentato in cucina, testando con attenzione ogni ricetta e ogni taglio proposto, sempre mettendo al primo posto la sicurezza e il benessere di mia figlia.",
  "Ricette e Tagli Sicuri è nato per essere un supporto concreto ad altre mamme e papà che, come me, si sono sentiti spesso smarriti di fronte al mondo dello svezzamento. Nessuna pretesa di verità assolute, solo il desiderio di condividere ciò che ha funzionato per noi, con il massimo rispetto per ogni scelta e percorso individuale.",
  "Se anche una sola famiglia troverà in queste pagine un aiuto, un'ispirazione o semplicemente un sorriso in cucina, allora tutto il lavoro, i sacrifici e le notti passate a scrivere e cucinare avranno avuto un senso.",
];

const steps = [
  "Registrati con email e conferma l'account.",
  "Scegli il libro acquistato e completa la challenge di verifica.",
  "Accedi alla dashboard privata con bonus e strumenti personalizzati.",
  "Configura il profilo del bambino e genera menu giornalieri su misura.",
];

const faqs = [
  {
    q: "Posso sbloccare più di un libro?",
    a: "Sì. Ogni account può sbloccare più libri in modo indipendente.",
  },
  {
    q: "Se sbaglio la challenge cosa succede?",
    a: "I tentativi sono limitati. Dopo troppi errori entra un cooldown temporaneo di sicurezza.",
  },
  {
    q: "La chat menu è libera come un chatbot generico?",
    a: "No. È guidata da regole business per mantenere coerenza, affidabilità e sicurezza.",
  },
];

export default function LandingPage() {
  return (
    <div>
      <section className="relative min-h-[calc(100svh-80px)] overflow-hidden px-4 pb-20 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pb-24 lg:pt-12">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(244,114,182,0.18),transparent_42%),radial-gradient(circle_at_90%_10%,rgba(253,186,116,0.2),transparent_36%)]" />
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <p className="mb-5 inline-flex rounded-full bg-rose-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700">
              Area Lettori Privata
            </p>
            <h1 className="font-heading text-4xl leading-tight text-rose-900 sm:text-5xl">
              Ricette e Tagli Sicuri:
              <br />
              tutto il tuo percorso in un unico posto
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-600">
              Verifica il tuo libro e accedi al tuo profilo personale con menu pensati unicamente per tuo figlio, tutto a portata
              di mano.
            </p>
            <p className="mt-5 text-lg font-bold text-rose-900 sm:text-xl">Lo svezzamento non è mai sato cosi facile!</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/register"
                className="rounded-2xl bg-rose-500 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-rose-600"
              >
                Registrati ora
              </Link>
              <Link
                href="/login"
                className="rounded-2xl bg-white px-6 py-3.5 text-base font-semibold text-rose-800 shadow-sm ring-1 ring-rose-200 transition hover:bg-rose-50"
              >
                Ho già un account
              </Link>
            </div>
          </div>
          <Card className="p-10 lg:mt-20 xl:mt-24">
            <h2 className="font-heading text-2xl text-rose-900">Cosa trovi nell&apos;Area Lettori</h2>
            <ul className="mt-5 space-y-4 text-sm text-zinc-700">
              {benefits.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-rose-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <h2 className="font-heading text-4xl text-rose-900">Come funziona</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            {steps.map((step, index) => (
              <Card key={step} className="bg-white">
                <p className="text-sm font-semibold uppercase tracking-wider text-rose-500">Step {index + 1}</p>
                <p className="mt-3 text-base text-zinc-700">{step}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          <h2 className="font-heading text-4xl text-rose-900">Chi è Lorena Mariani?</h2>
          <Card className="mt-7 p-8">
            <div className="space-y-4 text-base leading-relaxed text-zinc-700">
              {lorenaBioParagraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p className="pt-2 font-semibold text-rose-900">Con affetto,</p>
              <p className="font-semibold text-rose-900">Lorena Mariani</p>
            </div>
          </Card>
        </div>
      </section>

      <section className="bg-white px-4 pt-8 pb-20 sm:px-6 lg:px-8 lg:pt-10">
        <div className="mx-auto w-full max-w-7xl">
          <h2 className="font-heading text-4xl text-rose-900">Domande frequenti</h2>
          <div className="mt-7 grid gap-5 lg:grid-cols-3">
            {faqs.map((faq) => (
              <Card key={faq.q}>
                <h3 className="text-lg font-semibold text-rose-900">{faq.q}</h3>
                <p className="mt-3 text-base text-zinc-600">{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
