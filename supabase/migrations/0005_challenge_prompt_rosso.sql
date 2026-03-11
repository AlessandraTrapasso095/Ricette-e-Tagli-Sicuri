-- Aggiorna i prompt challenge da "in grassetto" a "in rosso" per i record esistenti
update public.book_access_challenges
set prompt_text = replace(prompt_text, 'in grassetto', 'in rosso')
where prompt_text ilike '%in grassetto%';
