-- M02 activity (Plan P2.1; Spec FR-13)
-- Read-only activity history per owner. Rows are written only by trusted triggers through
-- private.record_activity(); clients can SELECT their own rows and nothing else.

-- Shared URL type for user-entered http(s) links: no embedded credentials (user:pass@ or token@),
-- no whitespace, bounded length. A domain so every table applies the same rule.
create domain public.http_url as text
  check (
    char_length(value) <= 2048
    and value ~ '^https?://[^\s/?#@]+([/?#][^\s]*)?$'
  );

comment on domain public.http_url is 'http(s) URL without userinfo (credentials) or whitespace; max 2048 chars.';

-- Event registry. Later phases extend it with ALTER TYPE ... ADD VALUE.
create type public.activity_event_type as enum (
  'project.created',
  'project.updated',
  'project.archived',
  'project.restored',
  'project.deleted',
  'repository.added',
  'repository.updated',
  'repository.removed',
  'technology.added',
  'technology.removed'
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  -- FK to projects is added in M03; FK to tasks in M06.
  project_id uuid,
  task_id uuid,
  event_type public.activity_event_type not null,
  summary text not null check (char_length(summary) between 1 and 300),
  -- Safe metadata only: ids, names, enum values, changed field names. Never free text or secrets.
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096),
  created_at timestamptz not null default now()
);

comment on table public.activity_events is 'Read-only activity history. Written only by triggers via private.record_activity().';

create index activity_events_owner_created_idx on public.activity_events (owner_id, created_at desc);
create index activity_events_project_created_idx on public.activity_events (project_id, created_at desc)
  where project_id is not null;

alter table public.activity_events enable row level security;

create policy "activity_events: owner can read"
  on public.activity_events for select
  to authenticated
  using ((select auth.uid()) = owner_id);

revoke all on table public.activity_events from anon, authenticated;
grant select on table public.activity_events to authenticated;

-- Trusted writer. security definer so trigger functions can append history even though the
-- acting user has no INSERT privilege on activity_events.
create or replace function private.record_activity(
  p_owner_id uuid,
  p_project_id uuid,
  p_task_id uuid,
  p_event_type public.activity_event_type,
  p_summary text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_events (owner_id, project_id, task_id, event_type, summary, metadata)
  values (
    p_owner_id,
    p_project_id,
    p_task_id,
    p_event_type,
    left(p_summary, 300),
    coalesce(p_metadata, '{}'::jsonb)
  );
$$;

revoke all on function private.record_activity(uuid, uuid, uuid, public.activity_event_type, text, jsonb)
  from public, anon, authenticated;
