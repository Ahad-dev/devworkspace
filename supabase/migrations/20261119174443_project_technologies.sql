-- M05 project_technologies + project_summaries view (Plan P2.4–P2.5; Spec FR-05)

create type public.technology_category as enum (
  'frontend', 'backend', 'database', 'mobile', 'infrastructure', 'styling', 'testing', 'tooling', 'other'
);

create table public.project_technologies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null,
  repository_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  category public.technology_category not null default 'other',
  version text check (version is null or char_length(version) <= 50),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_technologies_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  -- The repository must belong to the same project. Deleting it just unlinks the technology.
  constraint project_technologies_repository_project_fkey foreign key (repository_id, project_id)
    references public.repositories (id, project_id) on delete set null (repository_id)
);

-- One entry per technology per project (and per repository when linked).
create unique index project_technologies_unique_name
  on public.project_technologies (project_id, lower(name), repository_id) nulls not distinct;
create index project_technologies_project_idx on public.project_technologies (project_id);

create trigger project_technologies_set_updated_at
  before update on public.project_technologies
  for each row execute function private.set_updated_at();

create or replace function private.project_technologies_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'technology.added',
      'Added technology ' || new.name,
      jsonb_build_object('technology_id', new.id, 'name', new.name, 'category', new.category));
    return new;
  end if;
  -- DELETE; skip during a project or account cascade.
  if exists (select 1 from public.projects where id = old.project_id) then
    perform private.record_activity(old.owner_id, old.project_id, null, 'technology.removed',
      'Removed technology ' || old.name,
      jsonb_build_object('technology_id', old.id, 'name', old.name));
  end if;
  return old;
end;
$$;

create trigger project_technologies_activity
  after insert or delete on public.project_technologies
  for each row execute function private.project_technologies_activity();

alter table public.project_technologies enable row level security;

create policy "project_technologies: owner can read" on public.project_technologies
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "project_technologies: owner can insert" on public.project_technologies
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "project_technologies: owner can update" on public.project_technologies
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "project_technologies: owner can delete" on public.project_technologies
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.project_technologies from anon, authenticated;
grant select, delete on table public.project_technologies to authenticated;
grant insert (project_id, repository_id, name, category, version, notes)
  on table public.project_technologies to authenticated;
grant update (repository_id, name, category, version, notes)
  on table public.project_technologies to authenticated;

------------------------------------------------------------------------------
-- project_summaries (P2.5): security_invoker so the caller's RLS applies to every table read.
-- Redefined in later phases to add task/environment counts.
------------------------------------------------------------------------------
create view public.project_summaries
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
  (select count(*) from public.project_technologies t where t.project_id = p.id)::int as technology_count
from public.projects p;

revoke all on table public.project_summaries from anon, authenticated;
grant select on table public.project_summaries to authenticated;
