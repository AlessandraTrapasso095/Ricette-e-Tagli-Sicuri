-- Ricette e Tagli Sicuri - Initial schema
create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

create type public.feeding_style_enum as enum ('classico', 'autosvezzamento', 'misto');
create type public.child_age_mode_enum as enum ('birth_date', 'months');
create type public.user_book_status_enum as enum ('active', 'revoked');
create type public.support_ticket_category_enum as enum ('accesso', 'bonus', 'chat_menu', 'tecnico', 'altro');
create type public.support_ticket_status_enum as enum ('inviato', 'in_lavorazione', 'risolto', 'chiuso');
create type public.menu_message_role_enum as enum ('user', 'assistant', 'system');
create type public.access_attempt_result_enum as enum ('failed', 'success', 'cooldown', 'revoked');

create or replace function public.normalize_text(input_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    replace(
      replace(lower(unaccent(trim(coalesce(input_text, '')))), '’', ''''),
      '‘',
      ''''
    ),
    '\s+',
    ' ',
    'g'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  display_name text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  age_mode public.child_age_mode_enum not null default 'birth_date',
  birth_date date,
  age_months integer,
  feeding_style public.feeding_style_enum not null default 'misto',
  allergies text[] not null default '{}',
  foods_to_avoid text[] not null default '{}',
  foods_introduced text[] not null default '{}',
  notes text,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint children_age_mode_check check (
    (age_mode = 'birth_date' and birth_date is not null)
    or (age_mode = 'months' and age_months is not null and age_months between 0 and 120)
  )
);

create unique index children_single_primary_idx on public.children(user_id) where is_primary = true;
create index children_user_id_idx on public.children(user_id);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  cover_url text,
  challenge_max_attempts smallint not null default 5,
  challenge_cooldown_minutes smallint not null default 30,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint books_challenge_max_attempts_check check (challenge_max_attempts between 1 and 20),
  constraint books_challenge_cooldown_check check (challenge_cooldown_minutes between 1 and 1440)
);

create table public.book_access_challenges (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  prompt_text text not null,
  accepted_answer text not null,
  accepted_answer_normalized text not null,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index book_access_challenges_book_prompt_unique
  on public.book_access_challenges(book_id, page_number, prompt_text);
create index book_access_challenges_book_active_idx
  on public.book_access_challenges(book_id, is_active);

create table public.user_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  challenge_id uuid references public.book_access_challenges(id) on delete set null,
  status public.user_book_status_enum not null default 'active',
  unlocked_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, book_id)
);

create index user_books_user_status_idx on public.user_books(user_id, status);

create table public.bonus_files (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  title text not null,
  description text,
  storage_bucket text not null default 'bonus-files',
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id, storage_path)
);

create index bonus_files_book_active_idx on public.bonus_files(book_id, is_active);

create table public.bonus_download_logs (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  bonus_file_id uuid not null references public.bonus_files(id) on delete cascade,
  ip_address inet,
  user_agent text,
  downloaded_at timestamptz not null default now()
);

create index bonus_download_logs_user_idx on public.bonus_download_logs(user_id, downloaded_at desc);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  email text not null,
  category public.support_ticket_category_enum not null default 'altro',
  book_id uuid references public.books(id) on delete set null,
  message text not null,
  status public.support_ticket_status_enum not null default 'inviato',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_tickets_user_status_idx on public.support_tickets(user_id, status, created_at desc);

create table public.menu_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  title text not null default 'Sessione menu',
  last_message_at timestamptz not null default now(),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_sessions_user_idx on public.menu_sessions(user_id, last_message_at desc);

create table public.menu_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.menu_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.menu_message_role_enum not null,
  content text not null,
  menu_payload jsonb,
  created_at timestamptz not null default now()
);

create index menu_messages_session_idx on public.menu_messages(session_id, created_at);

create table public.saved_menus (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.menu_sessions(id) on delete set null,
  child_id uuid references public.children(id) on delete set null,
  title text not null,
  menu_payload jsonb not null,
  source_message_id uuid references public.menu_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index saved_menus_user_idx on public.saved_menus(user_id, created_at desc);

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  role text not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.access_attempt_logs (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  challenge_id uuid references public.book_access_challenges(id) on delete set null,
  attempt_input text,
  attempt_input_normalized text,
  result public.access_attempt_result_enum not null,
  failure_reason text,
  cooldown_until timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index access_attempt_logs_user_book_idx
  on public.access_attempt_logs(user_id, book_id, created_at desc);
create index access_attempt_logs_result_idx
  on public.access_attempt_logs(result, created_at desc);

create table public.audit_logs (
  id bigserial primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity text not null,
  entity_id text,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs(entity, created_at desc);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = check_user_id
      and au.is_active = true
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.normalize_text(text) to authenticated;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger children_set_updated_at
  before update on public.children
  for each row execute procedure public.set_updated_at();
create trigger books_set_updated_at
  before update on public.books
  for each row execute procedure public.set_updated_at();
create trigger challenges_set_updated_at
  before update on public.book_access_challenges
  for each row execute procedure public.set_updated_at();
create trigger user_books_set_updated_at
  before update on public.user_books
  for each row execute procedure public.set_updated_at();
create trigger bonus_files_set_updated_at
  before update on public.bonus_files
  for each row execute procedure public.set_updated_at();
create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute procedure public.set_updated_at();
create trigger menu_sessions_set_updated_at
  before update on public.menu_sessions
  for each row execute procedure public.set_updated_at();
create trigger saved_menus_set_updated_at
  before update on public.saved_menus
  for each row execute procedure public.set_updated_at();
create trigger admin_users_set_updated_at
  before update on public.admin_users
  for each row execute procedure public.set_updated_at();
create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.books enable row level security;
alter table public.book_access_challenges enable row level security;
alter table public.user_books enable row level security;
alter table public.bonus_files enable row level security;
alter table public.bonus_download_logs enable row level security;
alter table public.support_tickets enable row level security;
alter table public.menu_sessions enable row level security;
alter table public.menu_messages enable row level security;
alter table public.saved_menus enable row level security;
alter table public.admin_users enable row level security;
alter table public.access_attempt_logs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id or public.is_admin(auth.uid()));

create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id or public.is_admin(auth.uid()))
  with check (auth.uid() = id or public.is_admin(auth.uid()));

create policy children_select_own
  on public.children for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy children_insert_own
  on public.children for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy children_update_own
  on public.children for update
  using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy children_delete_own
  on public.children for delete
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy books_read_active
  on public.books for select
  using (is_active = true or public.is_admin(auth.uid()));

create policy books_admin_write
  on public.books for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy challenges_admin_access
  on public.book_access_challenges for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy user_books_read_own
  on public.user_books for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy user_books_admin_write
  on public.user_books for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy bonus_files_read_unlocked
  on public.bonus_files for select
  using (
    public.is_admin(auth.uid())
    or (
      is_active = true
      and exists (
        select 1
        from public.user_books ub
        where ub.user_id = auth.uid()
          and ub.book_id = bonus_files.book_id
          and ub.status = 'active'
      )
    )
  );

create policy bonus_files_admin_write
  on public.bonus_files for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy bonus_download_logs_read
  on public.bonus_download_logs for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy bonus_download_logs_insert_own
  on public.bonus_download_logs for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy support_tickets_read_own
  on public.support_tickets for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy support_tickets_insert_own
  on public.support_tickets for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy support_tickets_admin_update
  on public.support_tickets for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy menu_sessions_select_own
  on public.menu_sessions for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy menu_sessions_insert_own
  on public.menu_sessions for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy menu_sessions_update_own
  on public.menu_sessions for update
  using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy menu_messages_select_own
  on public.menu_messages for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy menu_messages_insert_own
  on public.menu_messages for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy saved_menus_select_own
  on public.saved_menus for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy saved_menus_insert_own
  on public.saved_menus for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy saved_menus_update_own
  on public.saved_menus for update
  using (auth.uid() = user_id or public.is_admin(auth.uid()))
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy saved_menus_delete_own
  on public.saved_menus for delete
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy admin_users_select_self
  on public.admin_users for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy admin_users_admin_write
  on public.admin_users for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy access_attempt_logs_select
  on public.access_attempt_logs for select
  using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy access_attempt_logs_insert
  on public.access_attempt_logs for insert
  with check (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy audit_logs_admin_only
  on public.audit_logs for select
  using (public.is_admin(auth.uid()));

create policy audit_logs_insert_admin
  on public.audit_logs for insert
  with check (public.is_admin(auth.uid()));

create policy app_settings_read
  on public.app_settings for select
  using (auth.role() = 'authenticated');

create policy app_settings_admin_write
  on public.app_settings for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bonus-files', 'bonus-files', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "bonus_files_storage_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'bonus-files'
  and (
    public.is_admin(auth.uid())
    or exists (
      select 1
      from public.user_books ub
      join public.books b on b.id = ub.book_id
      where ub.user_id = auth.uid()
        and ub.status = 'active'
        and split_part(name, '/', 1) = b.slug
    )
  )
);

create policy "bonus_files_storage_admin_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'bonus-files' and public.is_admin(auth.uid()));

create policy "bonus_files_storage_admin_update"
on storage.objects for update to authenticated
using (bucket_id = 'bonus-files' and public.is_admin(auth.uid()))
with check (bucket_id = 'bonus-files' and public.is_admin(auth.uid()));

create policy "bonus_files_storage_admin_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'bonus-files' and public.is_admin(auth.uid()));
