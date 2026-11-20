-- M15 documents and task links (Plan P6.1; Spec FR-10, §6.10, §8, §9.3)
--
-- Markdown documents: setup guides, runbooks, ADRs, troubleshooting notes. A document belongs to
-- a project or, with no project, is a global note. It can point at one of that project's
-- repositories and environments. Text is screened for secret material (public.no_secret_text);
-- placeholders such as $DATABASE_URL are fine.

create type public.doc_category as enum (
  'architecture', 'requirements', 'setup', 'api', 'database', 'deployment',
  'troubleshooting', 'adr', 'notes', 'general'
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- null: a global (personal) document.
  project_id uuid,
  repository_id uuid,
  environment_id uuid,
  title public.no_secret_text not null check (char_length(btrim(title)) between 1 and 300),
  category public.doc_category not null default 'general',
  summary public.no_secret_text check (summary is null or char_length(summary) <= 500),
  content_markdown public.no_secret_text not null default '' check (char_length(content_markdown) <= 100000),
  -- Stamped with the server's time by documents_before_write.
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title::text, '')), 'A')
    || setweight(to_tsvector('english', coalesce(summary::text, '')), 'B')
    || setweight(to_tsvector('english', coalesce(content_markdown::text, '')), 'C')
  ) stored,

  constraint documents_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  -- Same project as the document. Deleting the repository or environment keeps the document.
  constraint documents_repository_project_fkey foreign key (repository_id, project_id)
    references public.repositories (id, project_id) on delete set null (repository_id),
  constraint documents_environment_project_fkey foreign key (environment_id, project_id)
    references public.environments (id, project_id) on delete set null (environment_id),
  -- A composite FK with a null project_id isn't checked at all (MATCH SIMPLE), so a global
  -- document may not point at a repository or environment.
  constraint documents_links_need_project check (
    project_id is not null or (repository_id is null and environment_id is null)
  ),
  constraint documents_id_owner_key unique (id, owner_id)
);

comment on table public.documents is
  'Markdown documents (FR-10). Global when project_id is null. No secret values.';

create index documents_owner_updated_idx on public.documents (owner_id, updated_at desc);
create index documents_project_updated_idx on public.documents (project_id, updated_at desc)
  where project_id is not null;
create index documents_repository_idx on public.documents (repository_id) where repository_id is not null;
create index documents_environment_idx on public.documents (environment_id) where environment_id is not null;
create index documents_search_idx on public.documents using gin (search_vector);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function private.set_updated_at();

-- Archive time is the server's, whatever the client sends.
create or replace function private.documents_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.archived_at is not null
     and (tg_op = 'INSERT' or new.archived_at is distinct from old.archived_at) then
    new.archived_at := now();
  end if;
  return new;
end;
$$;

create trigger documents_before_write
  before insert or update on public.documents
  for each row execute function private.documents_before_write();

create or replace function private.documents_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
  meta jsonb;
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'document.created',
      'Created document ' || new.title,
      jsonb_build_object('document_id', new.id, 'title', new.title, 'category', new.category));
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Skip when the owner or the project is being deleted along with it.
    if exists (select 1 from public.profiles where id = old.owner_id)
       and (old.project_id is null or exists (select 1 from public.projects where id = old.project_id)) then
      perform private.record_activity(old.owner_id, old.project_id, null, 'document.deleted',
        'Deleted document ' || old.title,
        jsonb_build_object('document_id', old.id, 'title', old.title, 'category', old.category));
    end if;
    return old;
  end if;

  meta := jsonb_build_object('document_id', new.id, 'title', new.title);

  if new.archived_at is not null and old.archived_at is null then
    perform private.record_activity(new.owner_id, new.project_id, null, 'document.archived',
      'Archived document ' || new.title, meta);
  elsif new.archived_at is null and old.archived_at is not null then
    perform private.record_activity(new.owner_id, new.project_id, null, 'document.restored',
      'Restored document ' || new.title, meta);
  end if;

  if new.title is distinct from old.title then changed := array_append(changed, 'title'); end if;
  if new.category is distinct from old.category then changed := array_append(changed, 'category'); end if;
  if new.summary is distinct from old.summary then changed := array_append(changed, 'summary'); end if;
  if new.content_markdown is distinct from old.content_markdown then changed := array_append(changed, 'content'); end if;
  if new.project_id is distinct from old.project_id then changed := array_append(changed, 'project'); end if;
  if new.repository_id is distinct from old.repository_id then changed := array_append(changed, 'repository'); end if;
  if new.environment_id is distinct from old.environment_id then changed := array_append(changed, 'environment'); end if;

  if cardinality(changed) = 0 then
    return new;
  end if;

  -- Writing is saved often (Ctrl+S). Edits to the text alone within 15 minutes of the last
  -- recorded edit of this document fold into that entry instead of adding one per save.
  if changed <@ array['content', 'summary']
     and exists (
       select 1 from public.activity_events e
       where e.owner_id = new.owner_id
         and e.event_type = 'document.updated'
         and e.created_at > now() - interval '15 minutes'
         and e.metadata ->> 'document_id' = new.id::text
     ) then
    return new;
  end if;

  perform private.record_activity(new.owner_id, new.project_id, null, 'document.updated',
    'Updated document ' || new.title,
    meta || jsonb_build_object('changed', to_jsonb(changed), 'category', new.category));
  return new;
end;
$$;

create trigger documents_activity
  after insert or update or delete on public.documents
  for each row execute function private.documents_activity();

------------------------------------------------------------------------------
-- task_document_links: a document that explains or supports a task (Spec FR-10 "link documents
-- to tasks"). Same owner on both sides through composite FKs.
------------------------------------------------------------------------------
create table public.task_document_links (
  task_id uuid not null,
  document_id uuid not null,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),

  primary key (task_id, document_id),
  constraint task_document_links_task_owner_fkey foreign key (task_id, owner_id)
    references public.tasks (id, owner_id) on delete cascade,
  constraint task_document_links_document_owner_fkey foreign key (document_id, owner_id)
    references public.documents (id, owner_id) on delete cascade
);

create index task_document_links_document_idx on public.task_document_links (document_id);

------------------------------------------------------------------------------
-- RLS + grants
------------------------------------------------------------------------------
alter table public.documents enable row level security;
alter table public.task_document_links enable row level security;

create policy "documents: owner can read" on public.documents
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "documents: owner can insert" on public.documents
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "documents: owner can update" on public.documents
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "documents: owner can delete" on public.documents
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "task_document_links: owner can read" on public.task_document_links
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "task_document_links: owner can insert" on public.task_document_links
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "task_document_links: owner can delete" on public.task_document_links
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.documents, public.task_document_links from anon, authenticated;
grant select, delete on table public.documents, public.task_document_links to authenticated;
grant insert (project_id, repository_id, environment_id, title, category, summary, content_markdown)
  on table public.documents to authenticated;
grant update (project_id, repository_id, environment_id, title, category, summary, content_markdown,
              archived_at)
  on table public.documents to authenticated;
grant insert (task_id, document_id) on table public.task_document_links to authenticated;
grant select, insert, update, delete on table public.documents, public.task_document_links
  to service_role;
