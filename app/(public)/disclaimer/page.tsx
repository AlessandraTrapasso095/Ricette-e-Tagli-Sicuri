import { DISCLAIMER_PARAGRAPHS, DISCLAIMER_TITLE, DISCLAIMER_VERSION } from "@/config/disclaimer";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function DisclaimerPage() {
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Versione {DISCLAIMER_VERSION}</p>
        <CardTitle className="mt-2">{DISCLAIMER_TITLE}</CardTitle>
        <CardDescription>Informativa responsabilità e uso dei contenuti della piattaforma.</CardDescription>

        <div className="mt-5 space-y-4 text-sm leading-relaxed text-zinc-700">
          {DISCLAIMER_PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </Card>
    </section>
  );
}
