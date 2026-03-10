import Link from "next/link";

import { Card } from "@/components/ui/card";

const benefits = [
  "Area privata dedicata esclusivamente ai lettori della collana.",
  "Sblocco sicuro dei libri con challenge presenti nelle pagine del testo.",
  "Bonus PDF disponibili solo per i libri realmente verificati.",
  "Chat menu guidata con regole business solide e output strutturato.",
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
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(244,114,182,0.18),transparent_42%),radial-gradient(circle_at_90%_10%,rgba(253,186,116,0.2),transparent_36%)]" />
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">
              Area Lettori Privata
            </p>
            <h1 className="font-heading text-4xl leading-tight text-rose-900 sm:text-5xl">
              Ricette e Tagli Sicuri: tutto il tuo percorso in un&apos;unica piattaforma protetta
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-zinc-600">
              Niente più email manuali e bonus inviati a mano: registrazione, verifica libro, dashboard e menu personalizzati in
              un flusso semplice, elegante e sicuro.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-2xl bg-rose-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-600"
              >
                Registrati ora
              </Link>
              <Link
                href="/login"
                className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-rose-800 shadow-sm ring-1 ring-rose-200 transition hover:bg-rose-50"
              >
                Ho già un account
              </Link>
            </div>
          </div>
          <Card className="p-8">
            <h2 className="font-heading text-2xl text-rose-900">Cosa trovi nell&apos;Area Lettori</h2>
            <ul className="mt-4 space-y-3 text-sm text-zinc-700">
              {benefits.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-rose-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="font-heading text-3xl text-rose-900">Come funziona</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {steps.map((step, index) => (
              <Card key={step} className="bg-white">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-500">Step {index + 1}</p>
                <p className="mt-2 text-sm text-zinc-700">{step}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="font-heading text-3xl text-rose-900">Domande frequenti</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {faqs.map((faq) => (
              <Card key={faq.q}>
                <h3 className="font-semibold text-rose-900">{faq.q}</h3>
                <p className="mt-2 text-sm text-zinc-600">{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
