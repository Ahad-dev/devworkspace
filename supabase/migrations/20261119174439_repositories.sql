-- M04 repositories (Plan P2.3; Spec FR-04, §8.2)

create type public.repository_provider as enum (
  'github', 'bitbucket', 'gitlab', 'azure_devops', 'self_hosted', 'other'
);
create type public.repository_purpose as enum (
  'frontend', 'backend', 'mobile', 'infrastructure', 'docs', 'monorepo', 'other'
);

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  provider public.repository_provider not null default 'github',
  -- https without credentials, scp-like git@host:owner/repo.git, or ssh://[user@]host[:port]/path.
  remote_url text check (
    remote_url is null or (
      char_length(remote_url) <= 1000
      and (
        remote_url ~ '^https://[^\s/?#@]+/[^\s?#]+$'
        or remote_url ~ '^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+:[^\s]+$'
        or remote_url ~ '^ssh://([A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+(:[0-9]+)?/[^\s]+$'
      )
    )
  ),
  purpose public.repository_purpose not null default 'other',
  default_branch text check (default_branch is null or default_branch ~ '^[^\s]{1,255}$'),
  primary_language text check (primary_language is null or char_length(primary_language) <= 100),
  -- Informational, machine-specific; never inspected by the cloud app (Spec FR-04).
  local_path text check (local_path is null or char_length(local_path) <= 1000),
  readme_url public.http_url,
  notes text check (notes is null or char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Same owner as the project: a user can only attach repositories to their own projects.
  constraint repositories_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  -- Children (tasks, technologies) reference (id, project_id) to stay within one project.
  constraint repositories_id_project_key unique (id, project_id),
  constraint repositories_id_owner_key unique (id, owner_id)
);

create unique index repositories_project_name_key on public.repositories (project_id, lower(name));
create index repositories_project_owner_idx on public.repositories (project_id, owner_id);

create trigger repositories_set_updated_at
  before update on public.repositories
  for each row execute function private.set_updated_at();

create or replace function private.repositories_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'repository.added',
      'Added repository ' || new.name,
      jsonb_build_object('repository_id', new.id, 'name', new.name, 'provider', new.provider));
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Skip during a project (or account) cascade: the parent is already gone.
    if exists (select 1 from public.projects where id = old.project_id) then
      perform private.record_activity(old.owner_id, old.project_id, null, 'repository.removed',
        'Removed repository ' || old.name,
        jsonb_build_object('repository_id', old.id, 'name', old.name));
    end if;
    return old;
  end if;

  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.provider is distinct from old.provider then changed := array_append(changed, 'provider'); end if;
  if new.remote_url is distinct from old.remote_url then changed := array_append(changed, 'remote_url'); end if;
  if new.purpose is distinct from old.purpose then changed := array_append(changed, 'purpose'); end if;
  if new.default_branch is distinct from old.default_branch then changed := array_append(changed, 'default_branch'); end if;
  if new.primary_language is distinct from old.primary_language then changed := array_append(changed, 'primary_language'); end if;
  if new.local_path is distinct from old.local_path then changed := array_append(changed, 'local_path'); end if;
  if new.readme_url is distinct from old.readme_url then changed := array_append(changed, 'readme_url'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;

  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, null, 'repository.updated',
      'Updated repository ' || new.name,
      jsonb_build_object('repository_id', new.id, 'name', new.name, 'changed', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

create trigger repositories_activity
  after insert or update or delete on public.repositories
  for each row execute function private.repositories_activity();

alter table public.repositories enable row level security;

create policy "repositories: owner can read" on public.repositories
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "repositories: owner can insert" on public.repositories
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "repositories: owner can update" on public.repositories
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "repositories: owner can delete" on public.repositories
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- owner_id defaults to auth.uid() and is never client-supplied; project_id can't be changed after insert.
revoke all on table public.repositories from anon, authenticated;
grant select, delete on table public.repositories to authenticated;
grant insert (project_id, name, provider, remote_url, purpose, default_branch, primary_language,
              local_path, readme_url, notes)
  on table public.repositories to authenticated;
grant update (name, provider, remote_url, purpose, default_branch, primary_language,
              local_path, readme_url, notes)
  on table public.repositories to authenticated;
