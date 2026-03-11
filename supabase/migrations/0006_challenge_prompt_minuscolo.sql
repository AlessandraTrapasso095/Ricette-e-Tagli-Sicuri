-- Uniforma i prompt challenge aggiungendo la regola di inserimento in minuscolo
update public.book_access_challenges
set
  prompt_text = 'Inserisci la parola segreta che trovi in rosso a pagina ' || page_number || ' e inseriscila in minuscolo',
  updated_at = now()
where (
  prompt_text ilike 'Inserisci la parola segreta che trovi in rosso a pagina %'
  or prompt_text ilike 'Inserisci la parola segreta che trovi in grassetto a pagina %'
)
and prompt_text not ilike '%minuscolo%';
