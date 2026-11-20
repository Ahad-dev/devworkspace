-- M11 work sessions, time segments and handoffs (Plan P4.1, P4.3; Spec FR-07, §8)
--
-- A session is a focused period of work on a task. Time is recorded as segments (pause closes one,
-- resume opens a new one), so duration never depends on a browser timer. Handoffs are append-only
-- progress snapshots.
--
-- All state changes go through the RPCs in the next migration. Clients can read their own rows and
-- edit a session's repository, branch and notes; they cannot insert, delete or change status, times,
-- segments or handoffs directly.

create type public.session_status as enum ('active', 'paused', 'completed');

------------------------------------------------------------------------------
-- work_sessions
------------------------------------------------------------------------------
create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  project_id uuid not null,
  -- MVP sessions always have a task (Plan §9 decision 3); nullable for later project-level sessions.
  task_id uuid,
  repository_id uuid,
  -- FK to environments is added with the environments table (Phase 5, M12).
  environment_id uuid,
  branch_name text check (
    branch_name is null or (char_length(branch_name) between 1 and 255 and branch_name !~ '\s')
  ),
  notes text check (notes is null or char_length(notes) <= 10000),
  status public.session_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint work_sessions_completed_has_end check ((status = 'completed') = (ended_at is not null)),
  constraint work_sessions_end_after_start check (ended_at is null or ended_at >= started_at),
  constraint work_sessions_id_owner_key unique (id, owner_id),

  constraint work_sessions_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade,
  -- Deleting a task deletes its sessions and handoffs, like its comments (decision log).
  constraint work_sessions_task_project_fkey foreign key (task_id, project_id)
    references public.tasks (id, project_id) on delete cascade,
  constraint work_sessions_repository_project_fkey foreign key (repository_id, project_id)
    references public.repositories (id, project_id) on delete set null (repository_id)
);

comment on table public.work_sessions is
  'Focused work on a task. Status and times change only through the session RPCs.';

-- Spec FR-07: at most one running session per user, enforced by the database.
create unique index work_sessions_one_active_per_owner
  on public.work_sessions (owner_id) where status = 'active';
create index work_sessions_owner_status_idx on public.work_sessions (owner_id, status);
create index work_sessions_task_started_idx on public.work_sessions (task_id, started_at desc)
  where task_id is not null;
create index work_sessions_project_started_idx on public.work_sessions (project_id, started_at desc);

create trigger work_sessions_set_updated_at
  before update on public.work_sessions
  for each row execute function private.set_updated_at();

------------------------------------------------------------------------------
-- work_session_segments: one row per uninterrupted stretch of work
------------------------------------------------------------------------------
create table public.work_session_segments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  work_session_id uuid not null,
  segment_started_at timestamptz not null default now(),
  segment_ended_at timestamptz,

  constraint work_session_segments_end_after_start
    check (segment_ended_at is null or segment_ended_at >= segment_started_at),
  constraint work_session_segments_session_owner_fkey foreign key (work_session_id, owner_id)
    references public.work_sessions (id, owner_id) on delete cascade
);

-- At most one open segment per session.
create unique index work_session_segments_one_open
  on public.work_session_segments (work_session_id) where segment_ended_at is null;
create index work_session_segments_session_started_idx
  on public.work_session_segments (work_session_id, segment_started_at);

------------------------------------------------------------------------------
-- work_handoffs: append-only progress snapshots (Spec FR-07 handoff fields)
------------------------------------------------------------------------------
create table public.work_handoffs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  work_session_id uuid not null,
  project_id uuid not null,
  task_id uuid not null,
  completed_summary text check (completed_summary is null or char_length(completed_summary) <= 10000),
  current_state text check (current_state is null or char_length(current_state) <= 10000),
  remaining_work text check (remaining_work is null or char_length(remaining_work) <= 10000),
  next_action text check (next_action is null or char_length(next_action) <= 1000),
  blockers text check (blockers is null or char_length(blockers) <= 2000),
  technical_notes text check (technical_notes is null or char_length(technical_notes) <= 20000),
  -- [{ "label": text, "url": http(s) URL without credentials }], validated by the RPC.
  related_links jsonb not null default '[]'::jsonb check (
    jsonb_typeof(related_links) = 'array'
    and jsonb_array_length(related_links) <= 20
    and pg_column_size(related_links) <= 16384
  ),
  created_at timestamptz not null default now(),

  constraint work_handoffs_session_owner_fkey foreign key (work_session_id, owner_id)
    references public.work_sessions (id, owner_id) on delete cascade,
  constraint work_handoffs_task_project_fkey foreign key (task_id, project_id)
    references public.tasks (id, project_id) on delete cascade,
  constraint work_handoffs_project_owner_fkey foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade
);

comment on table public.work_handoffs is 'Append-only progress snapshots. Written only by the session RPCs.';

create index work_handoffs_task_created_idx on public.work_handoffs (task_id, created_at desc);
create index work_handoffs_project_created_idx on public.work_handoffs (project_id, created_at desc);
create index work_handoffs_session_idx on public.work_handoffs (work_session_id);

------------------------------------------------------------------------------
-- Durations (Plan P4.3): computed from segments, never from a browser timer.
-- closed_seconds excludes the running segment so the UI can tick from open_segment_started_at.
------------------------------------------------------------------------------
create view public.work_session_summaries
with (security_invoker = true)
as
select
  s.id,
  s.owner_id,
  s.project_id,
  s.task_id,
  s.repository_id,
  s.branch_name,
  s.notes,
  s.status,
  s.started_at,
  s.ended_at,
  s.updated_at,
  coalesce(
    sum(extract(epoch from (g.segment_ended_at - g.segment_started_at)))
      filter (where g.segment_ended_at is not null),
    0
  )::bigint as closed_seconds,
  max(g.segment_started_at) filter (where g.segment_ended_at is null) as open_segment_started_at,
  max(g.segment_ended_at) as last_segment_ended_at,
  count(g.id)::int as segment_count
from public.work_sessions s
left join public.work_session_segments g on g.work_session_id = s.id
group by s.id;

comment on view public.work_session_summaries is
  'Session with recorded time: closed_seconds + (now - open_segment_started_at) while active.';

------------------------------------------------------------------------------
-- RLS + grants
------------------------------------------------------------------------------
alter table public.work_sessions enable row level security;
alter table public.work_session_segments enable row level security;
alter table public.work_handoffs enable row level security;

create policy "work_sessions: owner can read" on public.work_sessions
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "work_sessions: owner can update details" on public.work_sessions
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "work_session_segments: owner can read" on public.work_session_segments
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "work_handoffs: owner can read" on public.work_handoffs
  for select to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.work_sessions, public.work_session_segments, public.work_handoffs
  from anon, authenticated;
grant select on table public.work_sessions, public.work_session_segments, public.work_handoffs
  to authenticated;
-- Details only; status and times belong to the RPCs.
grant update (repository_id, branch_name, notes) on table public.work_sessions to authenticated;

revoke all on table public.work_session_summaries from anon, authenticated;
grant select on table public.work_session_summaries to authenticated;

grant select, insert, update, delete
  on table public.work_sessions, public.work_session_segments, public.work_handoffs
  to service_role;
grant select on table public.work_session_summaries to service_role;
