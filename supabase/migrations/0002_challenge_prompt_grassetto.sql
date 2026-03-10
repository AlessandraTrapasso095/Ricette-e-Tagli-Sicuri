-- Uniforma i prompt challenge per tutti i libri/pagine:
-- "Inserisci la parola segreta che trovi in grassetto a pagina X"
update public.book_access_challenges
set
  prompt_text = 'Inserisci la parola segreta che trovi in grassetto a pagina ' || page_number,
  updated_at = now();
