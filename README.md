# Ricette e Tagli Sicuri

Web app privata per lettori della collana, con accesso verificato per libro, dashboard protetta, bonus PDF riservati, chat menu guidata da business rules e pannello admin.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth, PostgreSQL, Storage, RLS)
- Zod + React Hook Form
- Route Handlers server-side
- OpenAI API (chat menu)
- Resend (email ticket supporto)
- Vercel-ready

## Architettura cartelle

```text
app/
  (public)/           # landing, login, register, pagine legali
  dashboard/          # area utente privata
  admin/              # area admin protetta
  api/                # route handlers backend
  auth/callback/      # callback verifica email Supabase
components/
  ui/                 # componenti riutilizzabili
  layout/             # shell pubblica/dashboard/admin
  forms/              # form RHF + Zod
  dashboard/          # widget dashboard
config/               # config brand, nav, business-rules
lib/
  supabase/           # client browser/server/admin
  validation/         # schema zod form
  text/               # normalizzazione risposte challenge
server/
  auth/               # guard user/admin
  books/              # logica sblocco libro + sicurezza
  bonus/              # accesso bonus e signed url
  children/           # profilo bambino
  chat/               # rules engine + schema menu + servizio AI
  support/            # ticket + invio email
  admin/              # aggregazioni pannello admin
supabase/
  migrations/0001_init.sql
  seed.sql
tests/
  *.test.ts
```

## Database Supabase

La migration `supabase/migrations/0001_init.sql` crea:

- Enum di dominio (`feeding_style`, `support_ticket_status`, `access_attempt_result`, ecc.)
- Tabelle: `profiles`, `children`, `books`, `book_access_challenges`, `user_books`, `bonus_files`, `bonus_download_logs`, `support_tickets`, `menu_sessions`, `menu_messages`, `saved_menus`, `admin_users`, `access_attempt_logs`, `audit_logs`, `app_settings`
- Trigger `updated_at`
- Trigger auto-profilo su `auth.users`
- Funzione `normalize_text` per confronto robusto challenge
- Funzione `is_admin`
- RLS complete su tutte le tabelle
- Bucket storage privato `bonus-files` + policy di accesso per utenti con libro sbloccato

## Seed iniziale

`supabase/seed.sql` inserisce:

- 4 libri iniziali:
  - Ricette e Tagli Sicuri
  - Ricette e Svezzamento Classico
  - Ricette e Autosvezzamento Felice
  - Colazione e Merenda
- challenge iniziali con parole segrete e pagine richieste
- bonus PDF placeholder per ogni libro
- impostazioni base `book_unlock` e `chat_menu`

## Flussi implementati

### 1) Auth

- Registrazione email+password
- Verifica email via callback `/auth/callback`
- Login
- Reset password
- Logout

### 2) Sblocco libro

- Pagina `/dashboard/libri`
- Challenge casuale per libro
- Verifica server-side con normalizzazione input:
  - trim
  - lowercase
  - Unicode normalize
  - apostrofi tipografici tollerati
- Tentativi falliti loggati
- Cooldown automatico dopo limite tentativi
- Sblocco persistito in `user_books`
- Revoca manuale da admin

### 3) Dashboard privata

Pagine:

- `/dashboard`
- `/dashboard/libri`
- `/dashboard/bonus`
- `/dashboard/profilo-bambino`
- `/dashboard/chat-menu`
- `/dashboard/menu-salvati`
- `/dashboard/supporto`
- `/dashboard/impostazioni`

### 4) Bonus PDF

- Lista bonus disponibili solo su libri sbloccati
- Download via route server `/api/bonus/[bonusId]/download`
- Signed URL breve durata
- Tracking in `bonus_download_logs`

### 5) Profilo bambino

- Form RHF + Zod
- Dati: nome, età/data nascita, stile svezzamento, allergie, esclusioni, alimenti introdotti, note
- Modello pronto per multi-bimbo (schema già relazionale)

### 6) Chat menu guidata

- Endpoint `/api/chat-menu`
- Regole centralizzate in `config/business-rules.ts` e `server/chat/rules-engine.ts`
- Output strutturato JSON (schema definito) + validazione Zod
- Salvataggio sessioni/messaggi/menu
- Pagine:
  - `/dashboard/chat-menu`
  - `/dashboard/menu-salvati`

### 7) Supporto

- Form ticket `/dashboard/supporto`
- Salvataggio DB `support_tickets`
- Email admin + conferma utente via Resend (se configurato)

### 8) Admin

Pagine:

- `/admin`
- `/admin/libri`
- `/admin/bonus`
- `/admin/utenti`
- `/admin/challenge`
- `/admin/supporto`
- `/admin/impostazioni`

Funzioni operative:

- Gestione libri
- Creazione challenge senza toccare codice
- Toggle challenge attiva/disattiva
- Visualizzazione utenti + tentativi falliti
- Revoca accessi libro
- Consultazione ticket supporto
- Consultazione settings

## Milestone

### MVP (coperto)

1. Setup progetto e architettura
2. Schema DB + RLS + seed
3. Auth + callback
4. Sblocco libri con challenge robuste
5. Dashboard privata con pagine core
6. Bonus protetti con signed URL
7. Profilo bambino
8. Chat menu guidata con persistenza
9. Ticket supporto + email transazionali
10. Admin panel operativo base

### Post-MVP

1. Watermark dinamico PDF con email utente
2. Moderazione/curation menu AI e libreria template
3. Gestione multi-bimbo avanzata in UI
4. Analytics eventi e funnel completo
5. Gestione ruoli admin granulari
6. E2E tests Playwright
7. Billing/subscription per area premium

## Setup locale

1. Copia `.env.example` in `.env.local` e compila le variabili.
2. Installa dipendenze:

```bash
npm install
```

3. Esegui migration + seed su Supabase (SQL editor o CLI):

- `supabase/migrations/0001_init.sql`
- `supabase/seed.sql`

4. Avvia sviluppo:

```bash
npm run dev
```

## Test e quality

```bash
npm run lint
npm run typecheck
npm test
```

## Deploy

App pronta per Vercel (variabili ambiente in Project Settings + connessione Supabase).
