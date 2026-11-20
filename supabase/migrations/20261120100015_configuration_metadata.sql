-- M14 configuration metadata: secret references and environment variables (Plan P5.3; Spec FR-08, §9.3)
--
-- DevWorkspace stores which variables an environment needs and where their secrets live, never the
-- values. environment_variables has NO value column, on purpose. secret_references hold a vault
-- locator (provider, workspace, path, key), never secret material or a token that can fetch it.

create type public.configuration_status as enum ('unknown', 'configured', 'missing', 'not_applicable');
-- manual: the user asserted it; imported: discovered from an approved file; integration: a
-- server-side integration confirmed it. Clients may only use manual or imported.
create type public.verification_method as enum ('manual', 'imported', 'integration');

------------------------------------------------------------------------------
-- secret_references: owner-level, reusable across environments and projects
------------------------------------------------------------------------------
create table public.secret_references (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Infisical, Doppler, 1Password, or anything else (free text with suggestions in the UI).
  provider public.no_secret_text not null check (char_length(btrim(provider)) between 1 and 60),
  vault_project_or_workspace public.no_secret_text
    check (vault_project_or_workspace is null or char_length(vault_project_or_workspace) <= 200),
  vault_path_or_item_id public.no_secret_text not null
    check (char_length(btrim(vault_path_or_item_id)) between 1 and 500),
  key_name public.no_secret_text check (key_name is null or char_length(key_name) <= 200),
  vault_url public.http_url,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint secret_references_id_owner_key unique (id, owner_id)
);

comment on table public.secret_references is
  'Where a secret lives (vault locator). Never the secret itself or a token that can read it.';

create index secret_references_owner_idx on public.secret_references (owner_id, provider);

create trigger secret_references_set_updated_at
  before update on public.secret_references
  for each row execute function private.set_updated_at();

create or replace function private.secret_references_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Provider and key name only: the locator path stays out of history.
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, null, null, 'secret_reference.added',
      'Added a ' || new.provider || ' secret reference' || coalesce(' for ' || new.key_name, ''),
      jsonb_build_object('secret_reference_id', new.id, 'provider', new.provider, 'key_name', new.key_name));
    return new;
  end if;
  if exists (select 1 from public.profiles where id = old.owner_id) then
    perform private.record_activity(old.owner_id, null, null, 'secret_reference.removed',
      'Removed a ' || old.provider || ' secret reference' || coalesce(' for ' || old.key_name, ''),
      jsonb_build_object('secret_reference_id', old.id, 'provider', old.provider, 'key_name', old.key_name));
  end if;
  return old;
end;
$$;

create trigger secret_references_activity
  after insert or delete on public.secret_references
  for each row execute function private.secret_references_activity();

------------------------------------------------------------------------------
-- environment_variables: names and flags only
------------------------------------------------------------------------------
create table public.environment_variables (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Beyond the Spec: lets comparisons and search read a project's variables directly, and the
  -- FK below keeps it equal to the environment's project.
  project_id uuid not null,
  environment_id uuid not null,
  -- A name, never NAME=value: the pattern can't hold "=", spaces or most secret material.
  name text not null check (name ~ '^[A-Za-z_][A-Za-z0-9_]{0,127}$'),
  is_required boolean not null default true,
  is_sensitive boolean not null default false,
  configuration_status public.configuration_status not null default 'unknown',
  verification_method public.verification_method not null default 'manual',
  -- Maintained by the trigger below when the status changes; not client-writable.
  last_verified_at timestamptz,
  notes public.no_secret_text check (notes is null or char_length(notes) <= 2000),
  secret_reference_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint environment_variables_environment_project_fkey foreign key (environment_id, project_id)
    references public.environments (id, project_id) on delete cascade,
  constraint environment_variables_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  -- Same owner as the reference; deleting the reference keeps the variable (column-list SET NULL).
  constraint environment_variables_secret_reference_fkey foreign key (secret_reference_id, owner_id)
    references public.secret_references (id, owner_id) on delete set null (secret_reference_id),
  constraint environment_variables_environment_name_key unique (environment_id, name)
);

comment on table public.environment_variables is
  'Which variables an environment needs and whether they are set. There is deliberately no value column.';

create index environment_variables_project_name_idx on public.environment_variables (project_id, name);
create index environment_variables_secret_reference_idx on public.environment_variables (secret_reference_id)
  where secret_reference_id is not null;

create trigger environment_variables_set_updated_at
  before update on public.environment_variables
  for each row execute function private.set_updated_at();

-- Status honesty (Spec FR-08): signed-in users can't claim "integration verified"; that is
-- reserved for a future server-side integration (service_role). last_verified_at follows status.
create or replace function private.environment_variables_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification_method = 'integration'
     and (tg_op = 'INSERT' or old.verification_method is distinct from 'integration')
     and current_user in ('authenticated', 'anon') then
    raise exception 'Integration verification can only be recorded by a server integration'
      using errcode = '42501', hint = 'integration_reserved';
  end if;

  if tg_op = 'INSERT' or new.configuration_status is distinct from old.configuration_status
     or new.verification_method is distinct from old.verification_method then
    if current_user in ('authenticated', 'anon') or new.last_verified_at is null then
      new.last_verified_at := case
        when new.configuration_status in ('configured', 'missing') then now()
        else null
      end;
    end if;
  end if;
  return new;
end;
$$;

create trigger environment_variables_before_write
  before insert or update on public.environment_variables
  for each row execute function private.environment_variables_before_write();

create or replace function private.environment_variables_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_env text;
  changed text[] := array[]::text[];
begin
  if tg_op = 'DELETE' then
    select name into v_env from public.environments where id = old.environment_id;
    if v_env is not null then
      perform private.record_activity(old.owner_id, old.project_id, null, 'variable.removed',
        'Removed ' || old.name || ' from ' || v_env,
        jsonb_build_object('name', old.name, 'environment', v_env));
    end if;
    return old;
  end if;

  select name into v_env from public.environments where id = new.environment_id;

  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'variable.added',
      'Added ' || new.name || ' to ' || coalesce(v_env, 'an environment'),
      jsonb_build_object('name', new.name, 'environment', v_env, 'required', new.is_required,
        'sensitive', new.is_sensitive, 'status', new.configuration_status));
    return new;
  end if;

  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.is_required is distinct from old.is_required then changed := array_append(changed, 'required'); end if;
  if new.is_sensitive is distinct from old.is_sensitive then changed := array_append(changed, 'sensitive'); end if;
  if new.configuration_status is distinct from old.configuration_status then changed := array_append(changed, 'status'); end if;
  if new.verification_method is distinct from old.verification_method then changed := array_append(changed, 'verification'); end if;
  if new.secret_reference_id is distinct from old.secret_reference_id then changed := array_append(changed, 'secret_reference'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;
  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, null, 'variable.updated',
      'Updated ' || new.name || ' in ' || coalesce(v_env, 'an environment'),
      jsonb_build_object('name', new.name, 'environment', v_env, 'changed', to_jsonb(changed),
        'from', old.configuration_status, 'to', new.configuration_status));
  end if;
  return new;
end;
$$;

create trigger environment_variables_activity
  after insert or update or delete on public.environment_variables
  for each row execute function private.environment_variables_activity();

------------------------------------------------------------------------------
-- RLS + grants
------------------------------------------------------------------------------
alter table public.secret_references enable row level security;
alter table public.environment_variables enable row level security;

create policy "secret_references: owner can read" on public.secret_references
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "secret_references: owner can insert" on public.secret_references
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "secret_references: owner can update" on public.secret_references
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "secret_references: owner can delete" on public.secret_references
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "environment_variables: owner can read" on public.environment_variables
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "environment_variables: owner can insert" on public.environment_variables
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "environment_variables: owner can update" on public.environment_variables
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "environment_variables: owner can delete" on public.environment_variables
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.secret_references, public.environment_variables from anon, authenticated;
grant select, delete on table public.secret_references, public.environment_variables to authenticated;
grant insert (provider, vault_project_or_workspace, vault_path_or_item_id, key_name, vault_url),
      update (provider, vault_project_or_workspace, vault_path_or_item_id, key_name, vault_url)
  on table public.secret_references to authenticated;
grant insert (project_id, environment_id, name, is_required, is_sensitive, configuration_status,
              verification_method, notes, secret_reference_id)
  on table public.environment_variables to authenticated;
grant update (name, is_required, is_sensitive, configuration_status, verification_method, notes,
              secret_reference_id)
  on table public.environment_variables to authenticated;
grant select, insert, update, delete on table public.secret_references, public.environment_variables
  to service_role;
