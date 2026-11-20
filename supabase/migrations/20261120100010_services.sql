-- M13 project services and per-environment instances (Plan P5.2; Spec FR-09, FR-08 infrastructure)
--
-- A service is defined once per project (e.g. "Postgres", "Redis", "Cloudinary"); each environment
-- where it runs gets an instance with its own resource name, region, endpoint and status.
-- service_instances carries project_id so both its parents are checked against the same project.

create type public.service_category as enum (
  'database', 'cache', 'hosting', 'storage', 'auth', 'payments', 'email', 'monitoring',
  'search', 'queue', 'analytics', 'external_api', 'dns', 'other'
);
create type public.service_instance_status as enum ('active', 'inactive', 'maintenance', 'unknown');

------------------------------------------------------------------------------
-- project_services
------------------------------------------------------------------------------
create table public.project_services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  category public.service_category not null default 'other',
  provider public.no_secret_text check (provider is null or char_length(provider) <= 120),
  purpose public.no_secret_text check (purpose is null or char_length(purpose) <= 500),
  dashboard_url public.http_url,
  documentation_url public.http_url,
  notes public.no_secret_text check (notes is null or char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_services_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  constraint project_services_id_project_key unique (id, project_id)
);

create unique index project_services_project_name_key on public.project_services (project_id, lower(name));
create index project_services_owner_category_idx on public.project_services (owner_id, category);

create trigger project_services_set_updated_at
  before update on public.project_services
  for each row execute function private.set_updated_at();

create or replace function private.project_services_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'service.added',
      'Added service ' || new.name,
      jsonb_build_object('service_id', new.id, 'name', new.name, 'category', new.category));
    return new;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.projects where id = old.project_id) then
      perform private.record_activity(old.owner_id, old.project_id, null, 'service.removed',
        'Removed service ' || old.name, jsonb_build_object('service_id', old.id, 'name', old.name));
    end if;
    return old;
  end if;

  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.category is distinct from old.category then changed := array_append(changed, 'category'); end if;
  if new.provider is distinct from old.provider then changed := array_append(changed, 'provider'); end if;
  if new.purpose is distinct from old.purpose then changed := array_append(changed, 'purpose'); end if;
  if new.dashboard_url is distinct from old.dashboard_url then changed := array_append(changed, 'dashboard_url'); end if;
  if new.documentation_url is distinct from old.documentation_url then changed := array_append(changed, 'documentation_url'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;
  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, null, 'service.updated',
      'Updated service ' || new.name,
      jsonb_build_object('service_id', new.id, 'name', new.name, 'changed', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

create trigger project_services_activity
  after insert or update or delete on public.project_services
  for each row execute function private.project_services_activity();

------------------------------------------------------------------------------
-- service_instances
------------------------------------------------------------------------------
create table public.service_instances (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Beyond the Spec: lets both FKs below enforce "service and environment in the same project".
  project_id uuid not null,
  project_service_id uuid not null,
  environment_id uuid not null,
  resource_name public.no_secret_text check (resource_name is null or char_length(resource_name) <= 200),
  region public.no_secret_text check (region is null or char_length(region) <= 100),
  -- Hostname or URL without userinfo: no "@" means no user:password@ or token@ (Spec FR-09).
  endpoint_hostname public.no_secret_text check (
    endpoint_hostname is null or endpoint_hostname ~ '^[^\s@]{1,255}$'
  ),
  version_or_plan public.no_secret_text check (version_or_plan is null or char_length(version_or_plan) <= 100),
  status public.service_instance_status not null default 'unknown',
  -- Names of the environment variables this instance uses (e.g. {DATABASE_URL, DIRECT_URL}).
  related_variables text[] not null default '{}' check (
    cardinality(related_variables) <= 20
    and array_to_string(related_variables, ',') ~ '^([A-Za-z_][A-Za-z0-9_]{0,127}(,|$))*$'
  ),
  notes public.no_secret_text check (notes is null or char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_instances_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  constraint service_instances_service_project_fkey foreign key (project_service_id, project_id)
    references public.project_services (id, project_id) on delete cascade,
  constraint service_instances_environment_project_fkey foreign key (environment_id, project_id)
    references public.environments (id, project_id) on delete cascade,
  -- One instance of a service per environment; a second database is a second service.
  constraint service_instances_service_environment_key unique (project_service_id, environment_id)
);

create index service_instances_environment_idx on public.service_instances (environment_id);
create index service_instances_project_idx on public.service_instances (project_id);

create trigger service_instances_set_updated_at
  before update on public.service_instances
  for each row execute function private.set_updated_at();

create or replace function private.service_instances_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_service text;
  v_environment text;
  changed text[] := array[]::text[];
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select name into v_service from public.project_services where id = r.project_service_id;
  select name into v_environment from public.environments where id = r.environment_id;

  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'service_instance.added',
      'Added ' || coalesce(v_service, 'a service') || ' to ' || coalesce(v_environment, 'an environment'),
      jsonb_build_object('instance_id', new.id, 'service', v_service, 'environment', v_environment,
        'status', new.status));
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Skip when the service or environment itself is being deleted (cascade).
    if v_service is not null and v_environment is not null then
      perform private.record_activity(old.owner_id, old.project_id, null, 'service_instance.removed',
        'Removed ' || v_service || ' from ' || v_environment,
        jsonb_build_object('instance_id', old.id, 'service', v_service, 'environment', v_environment));
    end if;
    return old;
  end if;

  if new.status is distinct from old.status then changed := array_append(changed, 'status'); end if;
  if new.resource_name is distinct from old.resource_name then changed := array_append(changed, 'resource_name'); end if;
  if new.region is distinct from old.region then changed := array_append(changed, 'region'); end if;
  if new.endpoint_hostname is distinct from old.endpoint_hostname then changed := array_append(changed, 'endpoint_hostname'); end if;
  if new.version_or_plan is distinct from old.version_or_plan then changed := array_append(changed, 'version_or_plan'); end if;
  if new.related_variables is distinct from old.related_variables then changed := array_append(changed, 'related_variables'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;
  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, null, 'service_instance.updated',
      'Updated ' || coalesce(v_service, 'a service') || ' in ' || coalesce(v_environment, 'an environment'),
      jsonb_build_object('instance_id', new.id, 'service', v_service, 'environment', v_environment,
        'changed', to_jsonb(changed), 'status', new.status));
  end if;
  return new;
end;
$$;

create trigger service_instances_activity
  after insert or update or delete on public.service_instances
  for each row execute function private.service_instances_activity();

------------------------------------------------------------------------------
-- RLS + grants
------------------------------------------------------------------------------
alter table public.project_services enable row level security;
alter table public.service_instances enable row level security;

create policy "project_services: owner can read" on public.project_services
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "project_services: owner can insert" on public.project_services
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "project_services: owner can update" on public.project_services
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "project_services: owner can delete" on public.project_services
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "service_instances: owner can read" on public.service_instances
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "service_instances: owner can insert" on public.service_instances
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "service_instances: owner can update" on public.service_instances
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "service_instances: owner can delete" on public.service_instances
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.project_services, public.service_instances from anon, authenticated;
grant select, delete on table public.project_services, public.service_instances to authenticated;
grant insert (project_id, name, category, provider, purpose, dashboard_url, documentation_url, notes)
  on table public.project_services to authenticated;
grant update (name, category, provider, purpose, dashboard_url, documentation_url, notes)
  on table public.project_services to authenticated;
grant insert (project_id, project_service_id, environment_id, resource_name, region,
              endpoint_hostname, version_or_plan, status, related_variables, notes)
  on table public.service_instances to authenticated;
grant update (resource_name, region, endpoint_hostname, version_or_plan, status,
              related_variables, notes)
  on table public.service_instances to authenticated;
grant select, insert, update, delete on table public.project_services, public.service_instances
  to service_role;
