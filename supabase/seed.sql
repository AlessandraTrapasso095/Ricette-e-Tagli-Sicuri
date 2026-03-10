-- Ricette e Tagli Sicuri - seed iniziale

insert into public.books (slug, title, description, sort_order)
values
  (
    'ricette-e-tagli-sicuri',
    'Ricette e Tagli Sicuri',
    'Guida pratica per preparare pasti sicuri e sereni per i più piccoli.',
    1
  ),
  (
    'ricette-e-svezzamento-classico',
    'Ricette e Svezzamento Classico',
    'Ricette equilibrate e strategie semplici per lo svezzamento classico.',
    2
  ),
  (
    'ricette-e-autosvezzamento-felice',
    'Ricette e Autosvezzamento Felice',
    'Percorso pratico per autosvezzamento consapevole, flessibile e sereno.',
    3
  ),
  (
    'colazione-e-merenda',
    'Colazione e Merenda',
    'Idee sane, veloci e adatte ai bambini per colazioni e merende quotidiane.',
    4
  )
on conflict (slug) do update
set
  title = excluded.title,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

with challenge_seed as (
  select *
  from (
    values
      ('ricette-e-tagli-sicuri', 8, 'Inserisci la parola segreta che trovi in grassetto a pagina 8', 'rassicurante', true),
      ('ricette-e-tagli-sicuri', 12, 'Inserisci la parola segreta che trovi in grassetto a pagina 12', 'rivoluzionario', true),
      ('ricette-e-tagli-sicuri', 16, 'Inserisci la parola segreta che trovi in grassetto a pagina 16', 'segreto', true),
      ('ricette-e-tagli-sicuri', 25, 'Inserisci la parola segreta che trovi in grassetto a pagina 25', 'prezioso', true),
      ('ricette-e-tagli-sicuri', 26, 'Inserisci la parola segreta che trovi in grassetto a pagina 26', 'bilanciato', true),

      ('ricette-e-svezzamento-classico', 4, 'Inserisci la parola segreta che trovi in grassetto a pagina 4', 'precocemente', true),
      ('ricette-e-svezzamento-classico', 22, 'Inserisci la parola segreta che trovi in grassetto a pagina 22', 'improvvisazioni', true),
      ('ricette-e-svezzamento-classico', 23, 'Inserisci la parola segreta che trovi in grassetto a pagina 23', 'benessere', true),
      ('ricette-e-svezzamento-classico', 27, 'Inserisci la parola segreta che trovi in grassetto a pagina 27', 'porridge', true),
      ('ricette-e-svezzamento-classico', 50, 'Inserisci la parola segreta che trovi in grassetto a pagina 50', 'dattero', true),

      ('colazione-e-merenda', 5, 'Inserisci la parola segreta che trovi in grassetto a pagina 5', 'complicati', true),
      ('colazione-e-merenda', 6, 'Inserisci la parola segreta che trovi in grassetto a pagina 6', 'irresistibile', true),
      ('colazione-e-merenda', 10, 'Inserisci la parola segreta che trovi in grassetto a pagina 10', 'cruciale', true),
      ('colazione-e-merenda', 11, 'Inserisci la parola segreta che trovi in grassetto a pagina 11', 'sostenibili', true),
      ('colazione-e-merenda', 75, 'Inserisci la parola segreta che trovi in grassetto a pagina 75', 'dolcezza', true),

      ('ricette-e-autosvezzamento-felice', 16, 'Inserisci la parola segreta che trovi in grassetto a pagina 16', 'precocemente', true),
      ('ricette-e-autosvezzamento-felice', 20, 'Inserisci la parola segreta che trovi in grassetto a pagina 20', 'improvvisazioni', true),
      ('ricette-e-autosvezzamento-felice', 25, 'Inserisci la parola segreta che trovi in grassetto a pagina 25', 'potente', true),
      ('ricette-e-autosvezzamento-felice', 28, 'Inserisci la parola segreta che trovi in grassetto a pagina 28', 'fiducia', true),
      ('ricette-e-autosvezzamento-felice', 31, 'Inserisci la parola segreta che trovi in grassetto a pagina 31', 'cruciale', true)
  ) as t(book_slug, page_number, prompt_text, accepted_answer, is_active)
)
insert into public.book_access_challenges (
  book_id,
  page_number,
  prompt_text,
  accepted_answer,
  accepted_answer_normalized,
  is_active
)
select
  b.id,
  cs.page_number,
  cs.prompt_text,
  cs.accepted_answer,
  public.normalize_text(cs.accepted_answer),
  cs.is_active
from challenge_seed cs
join public.books b on b.slug = cs.book_slug
on conflict (book_id, page_number, prompt_text) do update
set
  accepted_answer = excluded.accepted_answer,
  accepted_answer_normalized = excluded.accepted_answer_normalized,
  is_active = excluded.is_active,
  updated_at = now();

with bonus_seed as (
  select *
  from (
    values
      ('ricette-e-tagli-sicuri', 'Bonus PDF - Ricette e Tagli Sicuri', 'Schede pratiche e bonus operativi.', 'ricette-e-tagli-sicuri/bonus-principale.pdf'),
      ('ricette-e-svezzamento-classico', 'Bonus PDF - Svezzamento Classico', 'Piano rapido e checklist utili.', 'ricette-e-svezzamento-classico/bonus-principale.pdf'),
      ('ricette-e-autosvezzamento-felice', 'Bonus PDF - Autosvezzamento Felice', 'Ricette guidate e varianti sicure.', 'ricette-e-autosvezzamento-felice/bonus-principale.pdf'),
      ('colazione-e-merenda', 'Bonus PDF - Colazione e Merenda', 'Ricette veloci e organizzazione settimanale.', 'colazione-e-merenda/bonus-principale.pdf')
  ) as t(book_slug, title, description, storage_path)
)
insert into public.bonus_files (book_id, title, description, storage_path)
select
  b.id,
  bs.title,
  bs.description,
  bs.storage_path
from bonus_seed bs
join public.books b on b.slug = bs.book_slug
on conflict (book_id, storage_path) do update
set
  title = excluded.title,
  description = excluded.description,
  updated_at = now();

insert into public.app_settings (key, value, description)
values
  (
    'book_unlock',
    jsonb_build_object(
      'default_max_attempts', 5,
      'default_cooldown_minutes', 30,
      'case_insensitive', true,
      'normalize_unicode', true,
      'apostrophe_tolerant', true
    ),
    'Impostazioni globali del sistema di sblocco libri.'
  ),
  (
    'chat_menu',
    jsonb_build_object(
      'model', 'gpt-4.1-mini',
      'temperature', 0.4,
      'max_tokens', 1600
    ),
    'Configurazione base del motore chat menu.'
  )
on conflict (key) do update
set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();
