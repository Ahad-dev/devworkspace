-- M09 task dependencies (Plan P3.4; Spec FR-06 workflow rules)
-- "task_id depends on depends_on_task_id". Both tasks must be in project_id (composite FKs);
-- self-dependency and cycles are rejected in the database.

create table public.task_dependencies (
  task_id uuid not null,
  depends_on_task_id uuid not null,
  project_id uuid not null,
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  constraint task_dependencies_not_self check (task_id <> depends_on_task_id),
  constraint task_dependencies_task_fkey foreign key (task_id, project_id)
    references public.tasks (id, project_id) on delete cascade,
  constraint task_dependencies_depends_on_fkey foreign key (depends_on_task_id, project_id)
    references public.tasks (id, project_id) on delete cascade,
  constraint task_dependencies_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade
);

create index task_dependencies_depends_on_idx on public.task_dependencies (depends_on_task_id);

create or replace function private.task_dependencies_prevent_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  creates_cycle boolean;
begin
  -- Serialize dependency writes per project so two concurrent inserts can't form a cycle together.
  perform pg_advisory_xact_lock(hashtextextended(new.project_id::text, 0));

  -- Adding task -> depends_on creates a cycle if depends_on already (transitively) depends on task.
  with recursive reachable(id) as (
    select new.depends_on_task_id
    union
    select d.depends_on_task_id
    from public.task_dependencies d
    join reachable r on d.task_id = r.id
  )
  select exists (select 1 from reachable where id = new.task_id) into creates_cycle;

  if creates_cycle then
    raise exception 'This dependency would create a cycle' using errcode = '23514', hint = 'task_dependency_cycle';
  end if;
  return new;
end;
$$;

create trigger task_dependencies_prevent_cycle
  before insert on public.task_dependencies
  for each row execute function private.task_dependencies_prevent_cycle();

create or replace function private.task_dependencies_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t_title text;
  d_title text;
begin
  if tg_op = 'INSERT' then
    select title into t_title from public.tasks where id = new.task_id;
    select title into d_title from public.tasks where id = new.depends_on_task_id;
    perform private.record_activity(new.owner_id, new.project_id, new.task_id, 'task.dependency_added',
      t_title || ' now depends on ' || d_title,
      jsonb_build_object('task_id', new.task_id, 'depends_on_task_id', new.depends_on_task_id));
    return new;
  end if;
  -- DELETE: skip when either task is gone (task or project cascade).
  select title into t_title from public.tasks where id = old.task_id;
  select title into d_title from public.tasks where id = old.depends_on_task_id;
  if t_title is not null and d_title is not null then
    perform private.record_activity(old.owner_id, old.project_id, old.task_id, 'task.dependency_removed',
      t_title || ' no longer depends on ' || d_title,
      jsonb_build_object('task_id', old.task_id, 'depends_on_task_id', old.depends_on_task_id));
  end if;
  return old;
end;
$$;

create trigger task_dependencies_activity
  after insert or delete on public.task_dependencies
  for each row execute function private.task_dependencies_activity();

alter table public.task_dependencies enable row level security;

create policy "task_dependencies: owner can read" on public.task_dependencies
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "task_dependencies: owner can insert" on public.task_dependencies
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "task_dependencies: owner can delete" on public.task_dependencies
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.task_dependencies from anon, authenticated;
grant select, delete on table public.task_dependencies to authenticated;
grant insert (task_id, depends_on_task_id, project_id) on table public.task_dependencies to authenticated;
