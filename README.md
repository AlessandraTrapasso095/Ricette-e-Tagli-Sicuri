# Ricette e Tagli Sicuri

Piattaforma per i lettori della collana "Ricette e Tagli Sicuri".

Il progetto include:
- area pubblica con registrazione, login, pagine legali e FAQ
- area utente protetta con libri da sbloccare, bonus PDF, profilo bambino, chat menu e supporto
- pannello admin con utenti, libri, challenge, ticket, comunicazioni e impostazioni
- backend server-side su route handlers
- integrazione Supabase per Auth, database, RLS e storage
- generazione menu con OpenAI guidata da regole business e validazione strutturata

## Funzionalità principali

- Registrazione email/password con conferma account
- Recupero password con pagina dedicata `nuova password`
- Dashboard privata per lettori
- Sblocco libro tramite challenge per pagina/parola chiave
- Download bonus PDF solo per utenti autorizzati
- Profilo bambino con età, stile di svezzamento, allergie e alimenti da evitare
- Chat "Cosa mangiamo oggi?" con:
  - regole fisse di sicurezza alimentare
  - differenziazione tra classico, autosvezzamento e misto
  - massimo 5 sessioni al giorno
  - reset delle sessioni a mezzanotte in timezone `Europe/Rome`
  - salvataggio menu e storico sessioni
- Ticket supporto con conversazione utente/admin
- Comunicazioni massive da admin con storico invii
- Preferenze notifiche utente e admin
- Export dati privacy e richiesta cancellazione account
- Guard di sicurezza sulla chat menu con filtro input/output e audit log
- Layout responsive mobile con header e app menu fissi in area utente e admin

## Stack

- `Next.js 16` App Router
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `Supabase` Auth + Postgres + Storage
- `Zod` + `react-hook-form`
- `OpenAI API`
- `Resend` oppure `SMTP` per email transazionali
- `Vitest` per test
- `ESLint`

## Struttura del progetto

```text
app/
  (public)/                 landing, login, register, FAQ, privacy, termini
  admin/                    pannello admin
  api/                      route handlers backend
  auth/                     callback auth e reset password
  dashboard/                area utente privata
components/
  dashboard/                widget area lettori
  forms/                    form e tabelle operative
  layout/                   shell pubblica, dashboard, admin
  ui/                       componenti riutilizzabili
config/
  auth.ts                   cookie auth e timeout inattività
  business-rules.ts         regole menu e gruppi ingredienti
  chat-access.ts            controllo accesso chat per libri sbloccati
  chat-session.ts           limiti e reset giornaliero sessioni menu
  navigation.ts             navigazione dashboard/admin
  notification-preferences.ts
server/
  account/                  salvataggio profilo e notifiche account
  admin/                    aggregazioni e azioni pannello admin
  auth/                     guard, profilo e email auth
  books/                    challenge e sblocco libri
  bonus/                    accesso bonus protetti
  chat/                     engine menu, catalogo ricette, validatori, accesso
  children/                 profilo bambino
  email/                    invio email Resend/SMTP
  support/                  ticket e conversazione supporto
lib/
  env.ts                    validazione env
  supabase/                 client browser/server/admin
  timezone/                 utility date e reset giornaliero
  user-gender.ts            testi dinamici per genere utente
  validation/               schema Zod
supabase/
  migrations/               schema e hardening DB
  seed.sql                  seed base libri/challenge/bonus/settings
tests/                      suite vitest
scripts/
  upload-bonus-pdfs.mjs     upload bonus PDF in storage Supabase
```

## Route principali

### Area pubblica

- `/`
- `/login`
- `/register`
- `/faq`
- `/privacy`
- `/termini`
- `/disclaimer`

### Area utente

- `/dashboard`
- `/dashboard/libri`
- `/dashboard/bonus`
- `/dashboard/profilo-bambino`
- `/dashboard/chat-menu`
- `/dashboard/menu-salvati`
- `/dashboard/supporto`
- `/dashboard/impostazioni`

### Area admin

- `/admin`
- `/admin/utenti`
- `/admin/libri`
- `/admin/libri-sbloccati`
- `/admin/challenge`
- `/admin/accessi-attivi`
- `/admin/tentativi-falliti`
- `/admin/ticket`
- `/admin/comunicazione-utenti`
- `/admin/bonus`
- `/admin/impostazioni`

## API principali

- `POST /api/auth/register`
- `POST /api/auth/logout`
- `GET /api/menu/sessions`
- `POST /api/chat-menu`
- `GET|POST /api/menu/saved`
- `GET|POST /api/children/profile`
- `POST /api/support/tickets`
- `POST /api/support/tickets/[ticketId]/reply`
- `POST /api/support/tickets/[ticketId]/read`
- `GET /api/bonus/[bonusId]/download`
- `POST /api/books/[slug]/unlock`
- `POST /api/books/[slug]/challenge`
- `POST /api/admin/broadcast`
- `GET|POST /api/admin/users`
- `GET|POST /api/admin/support`

## Requisiti

- `Node.js 20+`
- `npm`
- progetto Supabase attivo
- chiavi OpenAI valide per la chat menu
- almeno un provider email configurato:
  - `Resend`
  - oppure `SMTP`

## Setup locale

### 1. Installa dipendenze

```bash
npm install
```

### 2. Crea le env locali

```bash
cp .env.example .env.local
```

Compila poi i valori reali in `.env.local`.

### 3. Prepara Supabase

Applica le migration in ordine:

```text
supabase/migrations/0001_init.sql
supabase/migrations/0002_challenge_prompt_grassetto.sql
supabase/migrations/0003_profiles_insert_policy.sql
supabase/migrations/0004_disclaimer_acceptances.sql
supabase/migrations/0005_challenge_prompt_rosso.sql
supabase/migrations/0006_challenge_prompt_minuscolo.sql
supabase/migrations/0007_user_email_events.sql
supabase/migrations/0008_notification_preferences.sql
supabase/migrations/0009_harden_app_settings_policy.sql
supabase/migrations/0010_profiles_gender.sql
```

Poi applica:

```text
supabase/seed.sql
```

Puoi farlo:
- via `SQL Editor` di Supabase
- oppure via CLI se il progetto è già linkato

### 4. Avvia in sviluppo

```bash
npm run dev
```

### 5. Controlli di qualità

```bash
npm run lint
npm run typecheck
npm test
```

## Variabili ambiente

### Base app

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `APP_BASE_URL` | Sì | URL base dell’app. In locale es. `http://localhost:3000`. |
| `AUTH_REDIRECT_BASE_URL` | Consigliata | Override esplicito per link auth/callback nelle email. |
| `NEXT_PUBLIC_APP_URL` | Consigliata | URL pubblico usato dal form reset password client-side. In produzione deve puntare al dominio live. |

### Supabase

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sì | URL del progetto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sì | Anon key pubblica. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sì | Service role key server-side. Non esporla sul client. |

### OpenAI

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `OPENAI_API_KEY` | Sì | Chiave API per la generazione menu. |
| `OPENAI_MODEL` | No | Default: `gpt-4.1-mini`. |

### Email

Configura almeno una delle due modalità.

#### Resend

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `RESEND_API_KEY` | Sì, se usi Resend | API key Resend. |
| `RESEND_FROM_EMAIL` | Sì, se usi Resend | Mittente verificato. |

#### SMTP

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `SMTP_HOST` | Sì, se usi SMTP | Host SMTP. |
| `SMTP_PORT` | Sì, se usi SMTP | Porta SMTP. |
| `SMTP_USER` | Sì, se usi SMTP | Username SMTP. |
| `SMTP_PASSWORD` | Sì, se usi SMTP | Password o app password. |
| `SMTP_SECURE` | No | `true` o `false`. Default coerente con la porta. |
| `SMTP_FROM_EMAIL` | No | Mittente SMTP. |
| `SMTP_FROM_NAME` | No | Nome mittente. |

### Branding e supporto

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `EMAIL_LOGO_URL` | No | Logo assoluto per email transazionali. |
| `SUPPORT_TARGET_EMAIL` | Sì | Casella che riceve i ticket supporto. |
| `CRON_SECRET` | Consigliata | Secret usato automaticamente da Vercel Cron Jobs nell'header `Authorization`. |
| `INTERNAL_CRON_SECRET` | No | Secret alternativo se vuoi invocare la route retention da sistemi esterni non Vercel. |

## Esempio `.env.local`

```env
APP_BASE_URL=http://localhost:3000
AUTH_REDIRECT_BASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

RESEND_API_KEY=
RESEND_FROM_EMAIL=ricettetaglisicuri@gmail.com

SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASSWORD=
SMTP_SECURE=true
SMTP_FROM_EMAIL=ricettetaglisicuri@gmail.com
SMTP_FROM_NAME="Ricette e Tagli Sicuri"

EMAIL_LOGO_URL=
SUPPORT_TARGET_EMAIL=ricettetaglisicuri@gmail.com
CRON_SECRET=
INTERNAL_CRON_SECRET=
```

## Supabase: configurazione auth

### URL Configuration

In `Authentication > URL Configuration` imposta:

- `Site URL`: dominio pubblico dell’app
- `Redirect URLs`: almeno
  - `/auth/callback`
  - `/auth/reset-password`

Esempio produzione:

```text
https://tuo-dominio.it/auth/callback
https://tuo-dominio.it/auth/reset-password
```

### Email template Supabase

Le email di conferma e reset password usano il flusso Supabase Auth. I template vanno gestiti nella dashboard Supabase.

Il progetto usa invece il provider applicativo `Resend/SMTP` per:
- email di benvenuto
- notifiche supporto
- comunicazioni utenti
- fallback/branding in alcuni flussi auth

## Bonus PDF

I bonus sono in storage privato Supabase e vengono distribuiti tramite signed URL server-side.

Script disponibile:

```bash
npm run bonus:upload
```

Nota:
- lo script `scripts/upload-bonus-pdfs.mjs` usa un `SOURCE_ROOT` locale hardcoded
- prima di eseguirlo su un’altra macchina va aggiornato il path sorgente

## Chat menu: regole operative

- Accessibile solo se l’utente ha sbloccato almeno uno dei libri abilitati
- Max `5` sessioni al giorno
- Reset sessioni a mezzanotte `Europe/Rome`
- Le modifiche tipo `no pera`, `senza latticini`, `cambia la cena` agiscono sulla sessione attiva
- Le nuove richieste generano nuove sessioni fino al limite giornaliero
- Il motore applica:
  - vincoli di svezzamento
  - allergie/intolleranze
  - alimenti da evitare
  - esclusioni libere scritte in chat
  - validazione del menu prima del salvataggio

## Sicurezza

Il progetto include già:

- RLS su tabelle Supabase
- header di sicurezza HTTP in `next.config.ts`
- `no-store` su `/dashboard`, `/admin` e `/api`
- guard lato server per utente, admin, disclaimer e accesso chat
- signed URL per bonus PDF
- invio ticket con email utente forzata lato server
- escaping HTML nelle email transazionali
- filtro sicurezza sulla chat menu per prompt fuori dominio, prompt tecnici e richieste sensibili
- sanitizzazione dell'output AI per evitare fughe accidentali di email, URL o token
- audit log per eventi sicurezza chat, export dati e richieste privacy

## Privacy e retention

- Da `Impostazioni > Privacy e dati` l'utente può:
  - esportare una copia JSON dei propri dati
  - inviare una richiesta di cancellazione account
- Cleanup automatico previsto:
  - sessioni chat archiviate: 30 giorni
  - tentativi challenge e log accesso: 90 giorni
  - log download bonus: 180 giorni
  - eventi email transazionali: 365 giorni

### Route interna cleanup retention

Route:

```text
GET /api/internal/privacy-retention
```

Header richiesto:

```text
Authorization: Bearer <CRON_SECRET>
```

Dry run:

```text
GET /api/internal/privacy-retention?dryRun=1
```

### Vercel Cron

Il progetto include un cron in [vercel.json](/Users/alessandratrapasso/Desktop/Github/Ricette%20e%20Tagli%20Sicuri/vercel.json):

- path: `/api/internal/privacy-retention`
- schedule: `15 3 * * *`

Il timing è in UTC. Su Vercel il cron gira solo in produzione.

## Deploy su Vercel

### Variabili ambiente da configurare

Replica in Vercel tutte le env necessarie:

- `APP_BASE_URL`
- `AUTH_REDIRECT_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- provider email scelto
- `EMAIL_LOGO_URL`
- `SUPPORT_TARGET_EMAIL`
- `CRON_SECRET`
- `INTERNAL_CRON_SECRET`

### Flusso consigliato

1. push su branch/deploy target
2. deploy Vercel
3. verifica env
4. verifica auth redirect URL su Supabase
5. smoke test su produzione:
   - registrazione
   - conferma email
   - login
   - reset password
   - sblocco libro
   - download bonus
   - chat menu
   - ticket supporto
   - risposta admin
   - comunicazione utenti

## Troubleshooting rapido

### "Nessun provider email configurato"

Manca una configurazione valida tra:
- `RESEND_API_KEY`
- oppure set SMTP completo

### Reset password rimanda alla pagina sbagliata

Controlla:
- `NEXT_PUBLIC_APP_URL`
- `APP_BASE_URL`
- `AUTH_REDIRECT_BASE_URL`
- `Site URL` e `Redirect URLs` in Supabase

### La chat menu non parte

Controlla che l’utente abbia sbloccato uno di questi libri:
- `ricette-e-tagli-sicuri`
- `ricette-e-svezzamento-classico`
- `ricette-e-autosvezzamento-felice`

`Colazione e Merenda` non abilita la chat.

### I bonus non risultano scaricabili

Verifica:
- `user_books.status = active`
- record `bonus_files`
- file presenti nel bucket `bonus-files`

## Script disponibili

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
npm run test:watch
npm run bonus:upload
```

## Note operative

- `.env.local` non va committato
- `.next/` non va considerata fonte di verità
- se cambi schema DB, aggiungi sempre una migration nuova invece di modificare quelle già applicate
- se cambi flussi auth/email, riallinea sempre:
  - env locali
  - env Vercel
  - template Supabase
  - redirect URLs Supabase

## Stato del progetto

Progetto pensato per produzione su Vercel con Supabase come backend principale e provider email esterno.

Il README è volutamente operativo: se aggiorni flussi, env, route o migrazioni, aggiorna anche questo file.
