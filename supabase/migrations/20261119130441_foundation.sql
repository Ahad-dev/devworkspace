-- M01 foundation (Plan P1.6; Spec FR-01, §8.1, §9.1–9.2)
-- private schema for privileged helpers, shared updated_at trigger, profiles + bootstrap,
-- and default privileges so new public objects are never readable by anon.

------------------------------------------------------------------------------
-- Default privileges: anon gets nothing on new tables/sequences/functions in public.
-- Every RPC must explicitly `grant execute ... to authenticated`.
------------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

------------------------------------------------------------------------------
-- private schema: not exposed through the Data API.
------------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

------------------------------------------------------------------------------
-- profiles: one row per auth user, same id.
------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text
    check (display_name is null or char_length(btrim(display_name)) between 1 and 100),
  timezone text not null default 'UTC',
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object' and pg_column_size(preferences) <= 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Per-user profile. Created by trigger on auth.users insert.';
comment on column public.profiles.preferences is 'Small UI preferences only (theme, default task view). Never secrets.';

-- Validate IANA timezone names (a check constraint can't query pg_timezone_names).
create or replace function private.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function private.validate_profile_timezone();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

------------------------------------------------------------------------------
-- RLS: owners read and update their own row. No insert/delete from clients:
-- rows are created by the trigger below and removed by the auth.users cascade.
------------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Grants: least privilege, and only the editable columns are updatable.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, timezone, preferences) on table public.profiles to authenticated;

------------------------------------------------------------------------------
-- Bootstrap a profile for every new auth user.
------------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill users created before this migration (e.g. the owner added in the dashboard).
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
