create table if not exists public.disclaimer_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  disclaimer_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, disclaimer_version)
);

create index if not exists disclaimer_acceptances_user_idx
  on public.disclaimer_acceptances(user_id, accepted_at desc);

create index if not exists disclaimer_acceptances_version_idx
  on public.disclaimer_acceptances(disclaimer_version);

alter table public.disclaimer_acceptances enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'disclaimer_acceptances'
      and policyname = 'disclaimer_acceptances_select_own'
  ) then
    create policy disclaimer_acceptances_select_own
      on public.disclaimer_acceptances for select
      using (auth.uid() = user_id or public.is_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'disclaimer_acceptances'
      and policyname = 'disclaimer_acceptances_insert_own'
  ) then
    create policy disclaimer_acceptances_insert_own
      on public.disclaimer_acceptances for insert
      with check (auth.uid() = user_id or public.is_admin(auth.uid()));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'disclaimer_acceptances'
      and policyname = 'disclaimer_acceptances_update_own'
  ) then
    create policy disclaimer_acceptances_update_own
      on public.disclaimer_acceptances for update
      using (auth.uid() = user_id or public.is_admin(auth.uid()))
      with check (auth.uid() = user_id or public.is_admin(auth.uid()));
  end if;
end $$;
