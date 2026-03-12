create table if not exists public.user_email_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('welcome_email')),
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, event_type)
);

create index if not exists user_email_events_event_idx
  on public.user_email_events(event_type, sent_at desc);

alter table public.user_email_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_email_events'
      and policyname = 'user_email_events_select_own'
  ) then
    create policy user_email_events_select_own
      on public.user_email_events for select
      using (auth.uid() = user_id or public.is_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_email_events'
      and policyname = 'user_email_events_admin_write'
  ) then
    create policy user_email_events_admin_write
      on public.user_email_events for all
      using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()));
  end if;
end $$;

