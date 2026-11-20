-- M17 command snippets (Plan P6.3; Spec FR-11, §8, §9.3)
--
-- Saved setup, build, test, migration and deployment commands. DevWorkspace never runs them; it
-- shows the shell, OS and environment and copies the text. Command text can't hold secret
-- material (public.no_secret_text): use $VAR placeholders.

create type public.command_shell as enum ('powershell', 'bash', 'zsh', 'cmd', 'other');
create type public.command_os as enum ('windows', 'macos', 'linux', 'cross_platform');
create type public.command_category as enum (
  'install', 'development', 'test', 'build', 'database', 'deployment', 'maintenance', 'other'
);

create table public.command_snippets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- null: a global command.
  project_id uuid,
  repository_id uuid,
  environment_id uuid,
  title public.no_secret_text not null check (char_length(btrim(title)) between 1 and 300),
  command_text public.no_secret_text not null check (char_length(btrim(command_text)) between 1 and 10000),
  description public.no_secret_text check (description is null or char_length(description) <= 2000),
  shell public.command_shell not null default 'bash',
  operating_system public.command_os not null default 'cross_platform',
  category public.command_category not null default 'other',
  prerequisites public.no_secret_text check (prerequisites is null or char_length(prerequisites) <= 2000),
  is_destructive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title::text, '')), 'A')
    || setweight(to_tsvector('english', coalesce(description::text, '')), 'B')
    || setweight(to_tsvector('english', coalesce(command_text::text, '')), 'C')
  ) stored,

  constraint command_snippets_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  constraint command_snippets_repository_project_fkey foreign key (repository_id, project_id)
    references public.repositories (id, project_id) on delete set null (repository_id),
  constraint command_snippets_environment_project_fkey foreign key (environment_id, project_id)
    references public.environments (id, project_id) on delete set null (environment_id),
  -- As for documents: a global command can't point at a repository or environment.
  constraint command_snippets_links_need_project check (
    project_id is not null or (repository_id is null and environment_id is null)
  ),
  constraint command_snippets_id_owner_key unique (id, owner_id)
);

comment on table public.command_snippets is
  'Saved commands (FR-11). Never executed by the app. Placeholders, never secret values.';

create index command_snippets_owner_idx on public.command_snippets (owner_id, category, title);
create index command_snippets_project_idx on public.command_snippets (project_id, title)
  where project_id is not null;
create index command_snippets_repository_idx on public.command_snippets (repository_id)
  where repository_id is not null;
create index command_snippets_environment_idx on public.command_snippets (environment_id)
  where environment_id is not null;
create index command_snippets_search_idx on public.command_snippets using gin (search_vector);

create trigger command_snippets_set_updated_at
  before update on public.command_snippets
  for each row execute function private.set_updated_at();

create or replace function private.command_snippets_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  -- Title, category and shell only: the command text stays out of history.
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'command.created',
      'Saved command ' || new.title,
      jsonb_build_object('command_id', new.id, 'title', new.title, 'category', new.category,
        'shell', new.shell, 'destructive', new.is_destructive));
    return new;
  end if;

  if tg_op = 'DELETE' then
    if exists (select 1 from public.profiles where id = old.owner_id)
       and (old.project_id is null or exists (select 1 from public.projects where id = old.project_id)) then
      perform private.record_activity(old.owner_id, old.project_id, null, 'command.deleted',
        'Deleted command ' || old.title,
        jsonb_build_object('command_id', old.id, 'title', old.title));
    end if;
    return old;
  end if;

  if new.title is distinct from old.title then changed := array_append(changed, 'title'); end if;
  if new.command_text is distinct from old.command_text then changed := array_append(changed, 'command'); end if;
  if new.description is distinct from old.description then changed := array_append(changed, 'description'); end if;
  if new.shell is distinct from old.shell then changed := array_append(changed, 'shell'); end if;
  if new.operating_system is distinct from old.operating_system then changed := array_append(changed, 'operating_system'); end if;
  if new.category is distinct from old.category then changed := array_append(changed, 'category'); end if;
  if new.prerequisites is distinct from old.prerequisites then changed := array_append(changed, 'prerequisites'); end if;
  if new.is_destructive is distinct from old.is_destructive then changed := array_append(changed, 'destructive'); end if;
  if new.project_id is distinct from old.project_id then changed := array_append(changed, 'project'); end if;
  if new.repository_id is distinct from old.repository_id then changed := array_append(changed, 'repository'); end if;
  if new.environment_id is distinct from old.environment_id then changed := array_append(changed, 'environment'); end if;

  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, null, 'command.updated',
      'Updated command ' || new.title,
      jsonb_build_object('command_id', new.id, 'title', new.title, 'changed', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

create trigger command_snippets_activity
  after insert or update or delete on public.command_snippets
  for each row execute function private.command_snippets_activity();

alter table public.command_snippets enable row level security;

create policy "command_snippets: owner can read" on public.command_snippets
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "command_snippets: owner can insert" on public.command_snippets
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "command_snippets: owner can update" on public.command_snippets
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "command_snippets: owner can delete" on public.command_snippets
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.command_snippets from anon, authenticated;
grant select, delete on table public.command_snippets to authenticated;
grant insert (project_id, repository_id, environment_id, title, command_text, description, shell,
              operating_system, category, prerequisites, is_destructive),
      update (project_id, repository_id, environment_id, title, command_text, description, shell,
              operating_system, category, prerequisites, is_destructive)
  on table public.command_snippets to authenticated;
grant select, insert, update, delete on table public.command_snippets to service_role;
