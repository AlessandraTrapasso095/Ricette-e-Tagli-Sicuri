import { Card } from "@/components/ui/card";
import { DATA_RETENTION_POLICIES } from "@/config/privacy-retention";
import { siteConfig } from "@/config/site";

export const metadata = {
  title: "Privacy | Ricette e Tagli Sicuri",
};

const retentionItems = [
  "Dati profilo e accesso: per tutta la durata dell'account e fino alla richiesta di cancellazione o chiusura del servizio.",
  "Profilo bambino, menu salvati e ticket supporto: finché necessari a fornire le funzioni richieste dall'utente e comunque soggetti a revisione periodica interna.",
  ...DATA_RETENTION_POLICIES.map((policy) => policy.privacyDescription),
] as const;

const rightsItems = [
  "accesso ai dati personali",
  "rettifica dei dati inesatti",
  "cancellazione dei dati quando applicabile",
  "limitazione del trattamento nei casi previsti dalla legge",
  "opposizione al trattamento quando applicabile",
  "portabilità dei dati",
] as const;

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Card>
        <h1 className="font-heading text-3xl text-rose-900">Privacy Policy</h1>

        <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-700">
          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">1. Titolare e contatti</h2>
            <p>
              Il servizio &quot;Ricette e Tagli Sicuri&quot; tratta i dati personali necessari a fornire l&apos;Area
              Lettori privata, l&apos;accesso ai bonus, il supporto tecnico e la chat menu personalizzata.
            </p>
            <p>
              Per richieste privacy, esercizio dei diritti o domande sul trattamento dei dati puoi scrivere a{" "}
              <a className="font-medium text-rose-700 underline" href={`mailto:${siteConfig.supportEmail}`}>
                {siteConfig.supportEmail}
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">2. Dati trattati</h2>
            <p>Possiamo trattare le seguenti categorie di dati:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>dati account: nome, email, nome utente, genere e preferenze notifiche</li>
              <li>dati del profilo bambino: nome, età o data di nascita, stile di svezzamento, allergie e preferenze alimentari</li>
              <li>dati di utilizzo: sessioni chat menu, ticket supporto, download bonus, tentativi challenge, log di sicurezza e audit</li>
              <li>dati tecnici essenziali: IP, user agent, timestamp e metadati necessari per sicurezza e funzionamento</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">3. Finalità del trattamento</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>creazione e gestione dell&apos;account utente</li>
              <li>verifica del possesso dei libri e sblocco dei contenuti riservati</li>
              <li>fornitura della chat menu e personalizzazione dei suggerimenti in base al profilo bambino</li>
              <li>gestione ticket supporto, comunicazioni tecniche e sicurezza account</li>
              <li>prevenzione abusi, audit, logging e protezione del servizio</li>
              <li>invio di comunicazioni opzionali solo se abilitate dalle preferenze notifiche</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">4. Base giuridica</h2>
            <p>I dati vengono trattati, a seconda dei casi, sulla base di:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>esecuzione del servizio richiesto dall&apos;utente</li>
              <li>adempimento di obblighi legali</li>
              <li>legittimo interesse alla sicurezza, prevenzione abusi e gestione operativa della piattaforma</li>
              <li>consenso, ove richiesto, per comunicazioni opzionali o preferenze specifiche</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">5. Destinatari e strumenti utilizzati</h2>
            <p>I dati possono essere trattati tramite fornitori tecnici strettamente necessari al servizio, tra cui:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Supabase per autenticazione, database e storage</li>
              <li>Vercel per hosting e delivery dell&apos;applicazione</li>
              <li>OpenAI per la generazione guidata dei menu</li>
              <li>Resend o SMTP per email transazionali</li>
            </ul>
            <p>
              I dati non sono divulgati a terzi per finalità incompatibili con quelle dichiarate. L&apos;accesso è limitato
              ai soggetti autorizzati e ai fornitori tecnici necessari all&apos;erogazione del servizio.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">6. Conservazione</h2>
            <ul className="list-disc space-y-1 pl-5">
              {retentionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">7. Sicurezza</h2>
            <p>
              Adottiamo misure tecniche e organizzative per proteggere i dati, tra cui autenticazione, autorizzazioni
              per ownership/admin, RLS database, protezione dei file bonus tramite signed URL, validazione input,
              logging di audit e restrizioni server-side sulle operazioni sensibili.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">8. Diritti dell&apos;utente</h2>
            <p>Puoi esercitare in qualsiasi momento i diritti previsti dalla normativa applicabile, tra cui:</p>
            <ul className="list-disc space-y-1 pl-5">
              {rightsItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              Dalla sezione <span className="font-medium">Impostazioni &gt; Privacy e dati</span> puoi esportare una
              copia dei dati in formato JSON oppure inviare una richiesta di cancellazione account.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">9. Minori</h2>
            <p>
              I dati relativi al profilo bambino sono inseriti e gestiti dall&apos;utente adulto titolare dell&apos;account
              esclusivamente per fornire funzionalità personalizzate di menu, supporto e consultazione.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-semibold text-rose-900">10. Aggiornamenti</h2>
            <p>
              Questa informativa può essere aggiornata nel tempo. Le modifiche sostanziali saranno pubblicate sul sito
              o comunicate con i canali disponibili.
            </p>
          </section>
        </div>
      </Card>
    </div>
  );
}
