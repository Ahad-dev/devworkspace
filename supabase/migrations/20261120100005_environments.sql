-- M12 environments (Plan P5.1; Spec FR-08, §6.9, §8, §9.3)
--
-- How a project runs in each place (local, dev, staging, production, custom). Non-secret metadata
-- only: URLs and hostnames can't carry credentials, and free text is screened for obvious secret
-- material by public.no_secret_text.

------------------------------------------------------------------------------
-- Shared: free text that must not hold secret material (Spec §9.3). Defense in depth behind the
-- app's secret-guard: rejects private keys, credential-bearing URLs, well-known token prefixes,
-- AWS access key ids and JWTs. A domain, so every Phase 5+ table applies the same rule.
------------------------------------------------------------------------------
create domain public.no_secret_text as text
  check (
    value !~ '-----BEGIN [A-Z ]*PRIVATE KEY-----'
    and value !~* '[a-z][a-z0-9+.-]*://[^\s/?#@:]*:[^\s/?#@]+@'
    and value !~ '(sk_live_|rk_live_|ghp_|gho_|ghs_|ghr_|github_pat_|glpat-|xox[abposr]-|sb_secret_|sbp_)[A-Za-z0-9_-]{8,}'
    and value !~ 'AKIA[0-9A-Z]{16}'
    and value !~ 'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}'
  );

comment on domain public.no_secret_text is
  'Text that must not contain secret material (keys, tokens, credential URLs). Spec §9.3.';

create type public.environment_type as enum ('local', 'development', 'staging', 'production', 'custom');
create type public.environment_status as enum ('active', 'inactive', 'needs_review', 'archived');

create table public.environments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  environment_type public.environment_type not null,
  -- Free-text machine label for local/custom environments; no device inventory (Spec FR-08).
  machine_label public.no_secret_text check (machine_label is null or char_length(machine_label) <= 100),
  application_url public.http_url,
  api_url public.http_url,
  deployment_provider public.no_secret_text
    check (deployment_provider is null or char_length(deployment_provider) <= 100),
  -- Hostname or IP, optional port. No scheme, path, userinfo or whitespace, so no credentials.
  server_hostname text check (
    server_hostname is null or server_hostname ~ '^[A-Za-z0-9._:\[\]-]{1,255}$'
  ),
  operating_system public.no_secret_text
    check (operating_system is null or char_length(operating_system) <= 100),
  -- {"node": "24.11", "pnpm": "10.33"}: names and versions only, all strings.
  runtime_versions jsonb not null default '{}'::jsonb check (
    jsonb_typeof(runtime_versions) = 'object'
    and not jsonb_path_exists(runtime_versions, '$.* ? (@.type() != "string")')
    and pg_column_size(runtime_versions) <= 2048
  ),
  deployment_branch text check (deployment_branch is null or deployment_branch ~ '^[^\s]{1,255}$'),
  deployment_method public.no_secret_text
    check (deployment_method is null or char_length(deployment_method) <= 2000),
  status public.environment_status not null default 'active',
  -- Setup and deployment instructions (Spec §6.9).
  notes public.no_secret_text check (notes is null or char_length(notes) <= 20000),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint environments_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  -- Children (service instances, variables, sessions) reference (id, project_id).
  constraint environments_id_project_key unique (id, project_id),
  constraint environments_id_owner_key unique (id, owner_id)
);

create unique index environments_project_name_key on public.environments (project_id, lower(name));
create index environments_owner_type_idx on public.environments (owner_id, environment_type);
create index environments_project_idx on public.environments (project_id);

create trigger environments_set_updated_at
  before update on public.environments
  for each row execute function private.set_updated_at();

-- "Mark reviewed" records the server's time, whatever the client sends.
create or replace function private.environments_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.last_reviewed_at is not null
     and (tg_op = 'INSERT' or new.last_reviewed_at is distinct from old.last_reviewed_at) then
    new.last_reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger environments_before_write
  before insert or update on public.environments
  for each row execute function private.environments_before_write();

create or replace function private.environments_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'environment.created',
      'Added environment ' || new.name,
      jsonb_build_object('environment_id', new.id, 'name', new.name, 'type', new.environment_type));
    return new;
  end if;

  if tg_op = 'DELETE' then
    if exists (select 1 from public.projects where id = old.project_id) then
      perform private.record_activity(old.owner_id, old.project_id, null, 'environment.deleted',
        'Deleted environment ' || old.name,
        jsonb_build_object('environment_id', old.id, 'name', old.name, 'type', old.environment_type));
    end if;
    return old;
  end if;

  if new.status is distinct from old.status and new.status = 'archived' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'environment.archived',
      'Archived environment ' || new.name, jsonb_build_object('environment_id', new.id, 'name', new.name));
  elsif new.status is distinct from old.status and old.status = 'archived' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'environment.restored',
      'Restored environment ' || new.name, jsonb_build_object('environment_id', new.id, 'name', new.name));
  elsif new.status is distinct from old.status then
    changed := array_append(changed, 'status');
  end if;

  if new.last_reviewed_at is distinct from old.last_reviewed_at and new.last_reviewed_at is not null then
    perform private.record_activity(new.owner_id, new.project_id, null, 'environment.reviewed',
      'Reviewed environment ' || new.name, jsonb_build_object('environment_id', new.id, 'name', new.name));
  end if;

  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.environment_type is distinct from old.environment_type then changed := array_append(changed, 'type'); end if;
  if new.machine_label is distinct from old.machine_label then changed := array_append(changed, 'machine_label'); end if;
  if new.application_url is distinct from old.application_url then changed := array_append(changed, 'application_url'); end if;
  if new.api_url is distinct from old.api_url then changed := array_append(changed, 'api_url'); end if;
  if new.deployment_provider is distinct from old.deployment_provider then changed := array_append(changed, 'deployment_provider'); end if;
  if new.server_hostname is distinct from old.server_hostname then changed := array_append(changed, 'server_hostname'); end if;
  if new.operating_system is distinct from old.operating_system then changed := array_append(changed, 'operating_system'); end if;
  if new.runtime_versions is distinct from old.runtime_versions then changed := array_append(changed, 'runtime_versions'); end if;
  if new.deployment_branch is distinct from old.deployment_branch then changed := array_append(changed, 'deployment_branch'); end if;
  if new.deployment_method is distinct from old.deployment_method then changed := array_append(changed, 'deployment_method'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;

  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, null, 'environment.updated',
      'Updated environment ' || new.name,
      jsonb_build_object('environment_id', new.id, 'name', new.name, 'changed', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

create trigger environments_activity
  after insert or update or delete on public.environments
  for each row execute function private.environments_activity();

alter table public.environments enable row level security;

create policy "environments: owner can read" on public.environments
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "environments: owner can insert" on public.environments
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "environments: owner can update" on public.environments
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "environments: owner can delete" on public.environments
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.environments from anon, authenticated;
grant select, delete on table public.environments to authenticated;
grant insert (project_id, name, environment_type, machine_label, application_url, api_url,
              deployment_provider, server_hostname, operating_system, runtime_versions,
              deployment_branch, deployment_method, status, notes)
  on table public.environments to authenticated;
grant update (name, environment_type, machine_label, application_url, api_url,
              deployment_provider, server_hostname, operating_system, runtime_versions,
              deployment_branch, deployment_method, status, notes, last_reviewed_at)
  on table public.environments to authenticated;
grant select, insert, update, delete on table public.environments to service_role;

------------------------------------------------------------------------------
-- Work sessions can now record an environment (Phase 4 left the column without a FK).
------------------------------------------------------------------------------
alter table public.work_sessions
  add constraint work_sessions_environment_project_fkey foreign key (environment_id, project_id)
    references public.environments (id, project_id) on delete set null (environment_id);

create index work_sessions_environment_idx on public.work_sessions (environment_id)
  where environment_id is not null;

grant update (environment_id) on table public.work_sessions to authenticated;
