-- M03 projects (Plan P2.2; Spec FR-03, §8.2)

create type public.project_type as enum ('client', 'internal', 'personal', 'open_source', 'learning');
create type public.project_status as enum ('active', 'on_hold', 'maintenance', 'completed', 'archived');
create type public.priority_level as enum ('urgent', 'high', 'medium', 'low');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 20000),
  project_type public.project_type not null,
  status public.project_status not null default 'active',
  priority public.priority_level,
  start_date date,
  target_date date,
  project_url public.http_url,
  documentation_url public.http_url,
  notes text check (notes is null or char_length(notes) <= 5000),
  -- Maintained by projects_sync_archive: set when status becomes 'archived', cleared otherwise.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_archive_consistent check ((status = 'archived') = (archived_at is not null)),
  constraint projects_dates_ordered check (start_date is null or target_date is null or target_date >= start_date),
  -- Children reference (id, owner_id) so they can only attach to their owner's projects.
  constraint projects_id_owner_key unique (id, owner_id)
);

create index projects_owner_status_updated_idx on public.projects (owner_id, status, updated_at desc);

-- Activity rows keep history after a project is deleted (project_id is nulled).
alter table public.activity_events
  add constraint activity_events_project_id_fkey
  foreign key (project_id) references public.projects (id) on delete set null;

------------------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------------------
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function private.set_updated_at();

create or replace function private.projects_sync_archive()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'archived' then
    if tg_op = 'INSERT' or old.status is distinct from 'archived' or new.archived_at is null then
      new.archived_at := coalesce(new.archived_at, now());
    end if;
  else
    new.archived_at := null;
  end if;
  return new;
end;
$$;

create trigger projects_sync_archive
  before insert or update of status, archived_at on public.projects
  for each row execute function private.projects_sync_archive();

-- Activity. security definer: the acting user can't write activity_events directly.
create or replace function private.projects_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(
      new.owner_id, new.id, null, 'project.created',
      'Created project ' || new.name,
      jsonb_build_object('name', new.name, 'type', new.project_type)
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Skip when the owner's profile is gone (account deletion cascade).
    if exists (select 1 from public.profiles where id = old.owner_id) then
      perform private.record_activity(
        old.owner_id, null, null, 'project.deleted',
        'Deleted project ' || old.name,
        jsonb_build_object('name', old.name, 'project_id', old.id)
      );
    end if;
    return old;
  end if;

  -- UPDATE
  if old.status is distinct from new.status and new.status = 'archived' then
    perform private.record_activity(new.owner_id, new.id, null, 'project.archived',
      'Archived project ' || new.name, jsonb_build_object('name', new.name));
    return new;
  end if;
  if old.status = 'archived' and new.status is distinct from 'archived' then
    perform private.record_activity(new.owner_id, new.id, null, 'project.restored',
      'Restored project ' || new.name, jsonb_build_object('name', new.name, 'status', new.status));
    return new;
  end if;

  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.description is distinct from old.description then changed := array_append(changed, 'description'); end if;
  if new.project_type is distinct from old.project_type then changed := array_append(changed, 'type'); end if;
  if new.status is distinct from old.status then changed := array_append(changed, 'status'); end if;
  if new.priority is distinct from old.priority then changed := array_append(changed, 'priority'); end if;
  if new.start_date is distinct from old.start_date then changed := array_append(changed, 'start_date'); end if;
  if new.target_date is distinct from old.target_date then changed := array_append(changed, 'target_date'); end if;
  if new.project_url is distinct from old.project_url then changed := array_append(changed, 'project_url'); end if;
  if new.documentation_url is distinct from old.documentation_url then changed := array_append(changed, 'documentation_url'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;

  if cardinality(changed) > 0 then
    perform private.record_activity(
      new.owner_id, new.id, null, 'project.updated',
      'Updated project ' || new.name,
      jsonb_build_object('name', new.name, 'changed', to_jsonb(changed))
        || case when new.status is distinct from old.status
             then jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status))
             else '{}'::jsonb end
    );
  end if;
  return new;
end;
$$;

create trigger projects_activity
  after insert or update or delete on public.projects
  for each row execute function private.projects_activity();

------------------------------------------------------------------------------
-- RLS + grants
------------------------------------------------------------------------------
alter table public.projects enable row level security;

create policy "projects: owner can read" on public.projects
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "projects: owner can insert" on public.projects
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "projects: owner can update" on public.projects
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "projects: owner can delete" on public.projects
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- owner_id is never client-supplied: it defaults to auth.uid() and isn't insertable/updatable.
revoke all on table public.projects from anon, authenticated;
grant select, delete on table public.projects to authenticated;
grant insert (name, description, project_type, status, priority, start_date, target_date,
              project_url, documentation_url, notes)
  on table public.projects to authenticated;
grant update (name, description, project_type, status, priority, start_date, target_date,
              project_url, documentation_url, notes)
  on table public.projects to authenticated;
