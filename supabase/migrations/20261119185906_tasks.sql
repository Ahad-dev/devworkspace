-- M06 tasks + task_links (Plan P3.1; Spec FR-06, §8.2, §8.4)

create type public.task_status as enum ('inbox', 'ready', 'in_progress', 'blocked', 'review', 'done');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null,
  repository_id uuid,
  parent_task_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  description text check (description is null or char_length(description) <= 50000),
  status public.task_status not null default 'inbox',
  priority public.priority_level not null default 'medium',
  next_action text check (next_action is null or char_length(next_action) <= 1000),
  blocker_details text check (blocker_details is null or char_length(blocker_details) <= 2000),
  due_at timestamptz,
  -- Maintained by tasks_before_write: set on entering done, cleared on reopen.
  completed_at timestamptz,
  external_reference_url public.http_url,
  sort_order double precision not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_blocked_requires_details check (
    status <> 'blocked' or (blocker_details is not null and char_length(btrim(blocker_details)) > 0)
  ),
  constraint tasks_done_has_completed_at check ((status = 'done') = (completed_at is not null)),
  constraint tasks_not_own_parent check (parent_task_id is null or parent_task_id <> id),
  constraint tasks_id_project_key unique (id, project_id),
  constraint tasks_id_owner_key unique (id, owner_id),
  -- Same owner as the project.
  constraint tasks_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  -- Repository and parent must be in the same project.
  constraint tasks_repository_project_fkey foreign key (repository_id, project_id)
    references public.repositories (id, project_id) on delete set null (repository_id),
  -- NO ACTION (checked at statement end): a parent with subtasks can't be deleted on its own,
  -- but a project cascade that removes parent and children together succeeds.
  constraint tasks_parent_project_fkey foreign key (parent_task_id, project_id)
    references public.tasks (id, project_id)
);

create index tasks_owner_status_priority_idx on public.tasks (owner_id, status, priority);
create index tasks_project_status_sort_idx on public.tasks (project_id, status, sort_order);
create index tasks_owner_due_idx on public.tasks (owner_id, due_at) where due_at is not null;
create index tasks_repository_idx on public.tasks (repository_id) where repository_id is not null;
create index tasks_parent_idx on public.tasks (parent_task_id) where parent_task_id is not null;

alter table public.activity_events
  add constraint activity_events_task_id_fkey
  foreign key (task_id) references public.tasks (id) on delete set null;

------------------------------------------------------------------------------
-- Triggers
------------------------------------------------------------------------------
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

-- completed_at bookkeeping, blocker cleanup and parent-cycle prevention.
create or replace function private.tasks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  creates_cycle boolean;
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status is distinct from 'done' or new.completed_at is null then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
  else
    new.completed_at := null;
  end if;

  if new.status <> 'blocked' then
    new.blocker_details := null;
  end if;

  if new.parent_task_id is not null
     and (tg_op = 'INSERT' or new.parent_task_id is distinct from old.parent_task_id) then
    with recursive ancestors(id, parent_task_id) as (
      select t.id, t.parent_task_id from public.tasks t where t.id = new.parent_task_id
      union
      select t.id, t.parent_task_id
      from public.tasks t
      join ancestors a on t.id = a.parent_task_id
    )
    select exists (select 1 from ancestors where id = new.id) into creates_cycle;
    if creates_cycle then
      raise exception 'A task cannot be its own ancestor' using errcode = '23514', hint = 'task_parent_cycle';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_before_write
  before insert or update on public.tasks
  for each row execute function private.tasks_before_write();

create or replace function private.tasks_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, new.id, 'task.created',
      'Created task ' || new.title,
      jsonb_build_object('title', new.title, 'status', new.status, 'priority', new.priority));
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- The row is gone, so task_id stays null; skip during a project/account cascade.
    if exists (select 1 from public.projects where id = old.project_id) then
      perform private.record_activity(old.owner_id, old.project_id, null, 'task.deleted',
        'Deleted task ' || old.title,
        jsonb_build_object('title', old.title, 'task_id', old.id));
    end if;
    return old;
  end if;

  -- UPDATE
  if new.status is distinct from old.status then
    if new.status = 'done' then
      perform private.record_activity(new.owner_id, new.project_id, new.id, 'task.completed',
        'Completed ' || new.title, jsonb_build_object('title', new.title, 'from', old.status));
    elsif old.status = 'done' then
      perform private.record_activity(new.owner_id, new.project_id, new.id, 'task.reopened',
        'Reopened ' || new.title, jsonb_build_object('title', new.title, 'to', new.status));
    else
      perform private.record_activity(new.owner_id, new.project_id, new.id, 'task.status_changed',
        'Moved ' || new.title || ' to ' || replace(new.status::text, '_', ' '),
        jsonb_build_object('title', new.title, 'from', old.status, 'to', new.status));
    end if;
  end if;

  if new.priority is distinct from old.priority then
    perform private.record_activity(new.owner_id, new.project_id, new.id, 'task.priority_changed',
      'Changed priority of ' || new.title || ' to ' || new.priority::text,
      jsonb_build_object('title', new.title, 'from', old.priority, 'to', new.priority));
  end if;

  if new.archived_at is distinct from old.archived_at then
    if new.archived_at is not null then
      perform private.record_activity(new.owner_id, new.project_id, new.id, 'task.archived',
        'Archived ' || new.title, jsonb_build_object('title', new.title));
    else
      perform private.record_activity(new.owner_id, new.project_id, new.id, 'task.restored',
        'Restored ' || new.title, jsonb_build_object('title', new.title));
    end if;
  end if;

  if new.title is distinct from old.title then changed := array_append(changed, 'title'); end if;
  if new.description is distinct from old.description then changed := array_append(changed, 'description'); end if;
  if new.next_action is distinct from old.next_action then changed := array_append(changed, 'next_action'); end if;
  if new.due_at is distinct from old.due_at then changed := array_append(changed, 'due_at'); end if;
  if new.repository_id is distinct from old.repository_id then changed := array_append(changed, 'repository'); end if;
  if new.parent_task_id is distinct from old.parent_task_id then changed := array_append(changed, 'parent'); end if;
  if new.external_reference_url is distinct from old.external_reference_url then changed := array_append(changed, 'external_reference_url'); end if;
  -- blocker_details follows status; sort_order is board housekeeping. Neither is logged.

  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, new.id, 'task.updated',
      'Updated ' || new.title, jsonb_build_object('title', new.title, 'changed', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

create trigger tasks_activity
  after insert or update or delete on public.tasks
  for each row execute function private.tasks_activity();

------------------------------------------------------------------------------
-- RLS + grants
------------------------------------------------------------------------------
alter table public.tasks enable row level security;

create policy "tasks: owner can read" on public.tasks
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "tasks: owner can insert" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "tasks: owner can update" on public.tasks
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "tasks: owner can delete" on public.tasks
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- owner_id is never client-supplied; project_id can't change; completed_at is trigger-maintained.
revoke all on table public.tasks from anon, authenticated;
grant select, delete on table public.tasks to authenticated;
grant insert (project_id, repository_id, parent_task_id, title, description, status, priority,
              next_action, blocker_details, due_at, external_reference_url, sort_order)
  on table public.tasks to authenticated;
grant update (repository_id, parent_task_id, title, description, status, priority, next_action,
              blocker_details, due_at, external_reference_url, sort_order, archived_at)
  on table public.tasks to authenticated;

------------------------------------------------------------------------------
-- task_links: related URLs on a task (Spec FR-06 "attach related documents or URLs").
------------------------------------------------------------------------------
create table public.task_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  task_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 120),
  url public.http_url not null,
  created_at timestamptz not null default now(),
  constraint task_links_task_owner_fkey foreign key (task_id, owner_id)
    references public.tasks (id, owner_id) on delete cascade
);

create index task_links_task_idx on public.task_links (task_id);

alter table public.task_links enable row level security;

create policy "task_links: owner can read" on public.task_links
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "task_links: owner can insert" on public.task_links
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "task_links: owner can delete" on public.task_links
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.task_links from anon, authenticated;
grant select, delete on table public.task_links to authenticated;
grant insert (task_id, label, url) on table public.task_links to authenticated;

------------------------------------------------------------------------------
-- project_summaries gains task counts (P3.11). New columns are appended, as CREATE OR REPLACE
-- VIEW requires. Progress = done / non-archived tasks (Plan §9 default 2).
------------------------------------------------------------------------------
create or replace view public.project_summaries
with (security_invoker = true)
as
select
  p.id,
  p.owner_id,
  p.name,
  p.description,
  p.project_type,
  p.status,
  p.priority,
  p.archived_at,
  p.created_at,
  p.updated_at,
  (select count(*) from public.repositories r where r.project_id = p.id)::int as repository_count,
  (select count(*) from public.project_technologies t where t.project_id = p.id)::int as technology_count,
  (select count(*) from public.tasks k where k.project_id = p.id and k.archived_at is null)::int as task_count,
  (select count(*) from public.tasks k
     where k.project_id = p.id and k.archived_at is null and k.status = 'done')::int as done_task_count,
  (select count(*) from public.tasks k
     where k.project_id = p.id and k.archived_at is null and k.status not in ('done', 'inbox'))::int as open_task_count
from public.projects p;
