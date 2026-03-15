alter table public.profiles
  add column if not exists receive_communications boolean not null default true,
  add column if not exists receive_promotions boolean not null default true,
  add column if not exists receive_personal_notifications boolean not null default true,
  add column if not exists receive_ticket_updates boolean not null default true;
