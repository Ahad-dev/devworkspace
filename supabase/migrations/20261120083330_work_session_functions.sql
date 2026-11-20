-- M11b work-session RPCs (Plan P4.2; Spec FR-07, §8.5)
--
-- Every session state change goes through these functions, so multi-row changes are atomic and
-- concurrent requests are serialized per user (pg_advisory_xact_lock).
--
-- They are SECURITY DEFINER because clients have no direct write access to sessions, segments or
-- handoffs (see M11). That bypasses RLS inside the function, so every statement filters by
-- auth.uid() explicitly, and no function accepts an owner id from the caller.
--
-- Errors carry a stable hint the app maps to a message:
--   active_session_exists (detail = the running session's id), session_not_found, task_not_found,
--   task_archived, session_not_active, session_not_paused, session_completed, invalid_end_time,
--   invalid_link, empty_handoff, task_required.

------------------------------------------------------------------------------
-- Internal: append a handoff snapshot (and optionally copy its next action to the task)
------------------------------------------------------------------------------
create or replace function private.session_insert_handoff(
  p_owner_id uuid,
  p_session_id uuid,
  p_project_id uuid,
  p_task_id uuid,
  p_handoff jsonb,
  p_update_task_next_action boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_completed text;
  v_state text;
  v_remaining text;
  v_next text;
  v_blockers text;
  v_notes text;
  v_links jsonb := '[]'::jsonb;
  v_link jsonb;
  v_label text;
  v_id uuid;
  v_title text;
begin
  if p_handoff is null or jsonb_typeof(p_handoff) <> 'object' then
    return null;
  end if;

  v_completed := nullif(btrim(p_handoff ->> 'completed_summary'), '');
  v_state := nullif(btrim(p_handoff ->> 'current_state'), '');
  v_remaining := nullif(btrim(p_handoff ->> 'remaining_work'), '');
  v_next := nullif(btrim(p_handoff ->> 'next_action'), '');
  v_blockers := nullif(btrim(p_handoff ->> 'blockers'), '');
  v_notes := nullif(btrim(p_handoff ->> 'technical_notes'), '');

  if jsonb_typeof(p_handoff -> 'related_links') = 'array' then
    for v_link in select value from jsonb_array_elements(p_handoff -> 'related_links') loop
      v_label := nullif(btrim(v_link ->> 'label'), '');
      if jsonb_typeof(v_link) <> 'object' or v_label is null or char_length(v_label) > 120
         or v_link ->> 'url' is null then
        raise exception 'Each related link needs a label and a URL'
          using errcode = '22023', hint = 'invalid_link';
      end if;
      -- The http_url domain rejects non-http(s) and credential-bearing URLs (23514).
      perform (v_link ->> 'url')::public.http_url;
      v_links := v_links || jsonb_build_array(jsonb_build_object('label', v_label, 'url', v_link ->> 'url'));
    end loop;
  end if;

  if v_completed is null and v_state is null and v_remaining is null and v_next is null
     and v_blockers is null and v_notes is null and jsonb_array_length(v_links) = 0 then
    return null;
  end if;

  insert into public.work_handoffs (
    owner_id, work_session_id, project_id, task_id, completed_summary, current_state,
    remaining_work, next_action, blockers, technical_notes, related_links
  )
  values (
    p_owner_id, p_session_id, p_project_id, p_task_id, v_completed, v_state,
    v_remaining, v_next, v_blockers, v_notes, v_links
  )
  returning id into v_id;

  if p_update_task_next_action and v_next is not null then
    update public.tasks set next_action = v_next where id = p_task_id and owner_id = p_owner_id;
  end if;

  select title into v_title from public.tasks where id = p_task_id;
  -- Ids and flags only: handoff text can hold anything, so it never goes into activity.
  perform private.record_activity(p_owner_id, p_project_id, p_task_id, 'handoff.saved',
    'Saved a handoff for ' || coalesce(v_title, 'a task'),
    jsonb_build_object(
      'title', v_title,
      'session_id', p_session_id,
      'handoff_id', v_id,
      'next_action_updated', p_update_task_next_action and v_next is not null
    ));
  return v_id;
end;
$$;

revoke all on function private.session_insert_handoff(uuid, uuid, uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;

------------------------------------------------------------------------------
-- Internal: per-user lock + signed-in check
------------------------------------------------------------------------------
create or replace function private.session_lock()
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('work_session:' || v_uid::text, 0));
  return v_uid;
end;
$$;

revoke all on function private.session_lock() from public, anon, authenticated;

------------------------------------------------------------------------------
-- start_work_session
------------------------------------------------------------------------------
create or replace function public.start_work_session(
  p_task_id uuid,
  p_repository_id uuid default null,
  p_branch_name text default null,
  p_notes text default null,
  p_move_task_to_in_progress boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.session_lock();
  v_task record;
  v_active uuid;
  v_id uuid;
begin
  if p_task_id is null then
    raise exception 'Choose a task to work on' using errcode = '22023', hint = 'task_required';
  end if;

  select t.id, t.project_id, t.title, t.status, t.archived_at, t.repository_id
    into v_task
    from public.tasks t
   where t.id = p_task_id and t.owner_id = v_uid;
  if not found then
    raise exception 'Task not found' using errcode = 'P0002', hint = 'task_not_found';
  end if;
  if v_task.archived_at is not null then
    raise exception 'Restore the task before working on it' using errcode = 'P0001', hint = 'task_archived';
  end if;

  select s.id into v_active from public.work_sessions s where s.owner_id = v_uid and s.status = 'active';
  if found then
    raise exception 'Another work session is running'
      using errcode = 'P0001', hint = 'active_session_exists', detail = v_active::text;
  end if;

  insert into public.work_sessions (owner_id, project_id, task_id, repository_id, branch_name, notes)
  values (
    v_uid,
    v_task.project_id,
    v_task.id,
    coalesce(p_repository_id, v_task.repository_id),
    nullif(btrim(p_branch_name), ''),
    nullif(btrim(p_notes), '')
  )
  returning id into v_id;

  insert into public.work_session_segments (owner_id, work_session_id) values (v_uid, v_id);

  -- Starting work on a queued or reviewed task means it's in progress; Blocked and Done stay as
  -- they are (the user decides whether starting work unblocks or reopens it).
  if p_move_task_to_in_progress and v_task.status in ('inbox', 'ready', 'review') then
    update public.tasks set status = 'in_progress' where id = v_task.id;
  end if;

  perform private.record_activity(v_uid, v_task.project_id, v_task.id, 'session.started',
    'Started work on ' || v_task.title,
    jsonb_build_object('title', v_task.title, 'session_id', v_id));
  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- pause_work_session: close the open segment (optionally at an earlier time, for a session left
-- running) and optionally save a handoff in the same transaction.
------------------------------------------------------------------------------
create or replace function public.pause_work_session(
  p_session_id uuid,
  p_ended_at timestamptz default null,
  p_handoff jsonb default null,
  p_update_task_next_action boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.session_lock();
  v_session record;
  v_segment record;
  v_end timestamptz := coalesce(p_ended_at, now());
  v_title text;
begin
  select s.* into v_session
    from public.work_sessions s
   where s.id = p_session_id and s.owner_id = v_uid
     for update;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002', hint = 'session_not_found';
  end if;
  if v_session.status <> 'active' then
    raise exception 'This session is not running' using errcode = 'P0001', hint = 'session_not_active';
  end if;

  select g.id, g.segment_started_at into v_segment
    from public.work_session_segments g
   where g.work_session_id = v_session.id and g.segment_ended_at is null
     for update;
  if found then
    if v_end < v_segment.segment_started_at or v_end > now() then
      raise exception 'The end time must be between the segment start and now'
        using errcode = '22023', hint = 'invalid_end_time';
    end if;
    update public.work_session_segments set segment_ended_at = v_end where id = v_segment.id;
  end if;

  update public.work_sessions set status = 'paused' where id = v_session.id;

  select title into v_title from public.tasks where id = v_session.task_id;
  perform private.record_activity(v_uid, v_session.project_id, v_session.task_id, 'session.paused',
    'Paused work on ' || coalesce(v_title, 'a task'),
    jsonb_build_object('title', v_title, 'session_id', v_session.id));

  if v_session.task_id is null then
    return null;
  end if;
  return private.session_insert_handoff(v_uid, v_session.id, v_session.project_id,
    v_session.task_id, p_handoff, p_update_task_next_action);
end;
$$;

------------------------------------------------------------------------------
-- resume_work_session: open a new segment. History stays intact.
------------------------------------------------------------------------------
create or replace function public.resume_work_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.session_lock();
  v_session record;
  v_active uuid;
  v_title text;
begin
  select s.* into v_session
    from public.work_sessions s
   where s.id = p_session_id and s.owner_id = v_uid
     for update;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002', hint = 'session_not_found';
  end if;
  if v_session.status = 'completed' then
    raise exception 'This session is completed; start a new one' using errcode = 'P0001', hint = 'session_completed';
  end if;
  if v_session.status <> 'paused' then
    raise exception 'This session is already running' using errcode = 'P0001', hint = 'session_not_paused';
  end if;

  select s.id into v_active from public.work_sessions s where s.owner_id = v_uid and s.status = 'active';
  if found then
    raise exception 'Another work session is running'
      using errcode = 'P0001', hint = 'active_session_exists', detail = v_active::text;
  end if;

  insert into public.work_session_segments (owner_id, work_session_id) values (v_uid, v_session.id);
  update public.work_sessions set status = 'active' where id = v_session.id;

  select title into v_title from public.tasks where id = v_session.task_id;
  perform private.record_activity(v_uid, v_session.project_id, v_session.task_id, 'session.resumed',
    'Resumed work on ' || coalesce(v_title, 'a task'),
    jsonb_build_object('title', v_title, 'session_id', v_session.id));
end;
$$;

------------------------------------------------------------------------------
-- complete_work_session: close the segment, complete the session and save the handoff, all in one
-- transaction (Spec §8.5). A failing handoff (bad link, too long) leaves the session unchanged.
------------------------------------------------------------------------------
create or replace function public.complete_work_session(
  p_session_id uuid,
  p_ended_at timestamptz default null,
  p_handoff jsonb default null,
  p_update_task_next_action boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.session_lock();
  v_session record;
  v_segment record;
  v_last_end timestamptz;
  v_end timestamptz := coalesce(p_ended_at, now());
  v_seconds bigint;
  v_title text;
  v_handoff uuid;
begin
  select s.* into v_session
    from public.work_sessions s
   where s.id = p_session_id and s.owner_id = v_uid
     for update;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002', hint = 'session_not_found';
  end if;
  if v_session.status = 'completed' then
    raise exception 'This session is already completed' using errcode = 'P0001', hint = 'session_completed';
  end if;

  if v_session.status = 'active' then
    select g.id, g.segment_started_at into v_segment
      from public.work_session_segments g
     where g.work_session_id = v_session.id and g.segment_ended_at is null
       for update;
    if found then
      if v_end < v_segment.segment_started_at or v_end > now() then
        raise exception 'The end time must be between the segment start and now'
          using errcode = '22023', hint = 'invalid_end_time';
      end if;
      update public.work_session_segments set segment_ended_at = v_end where id = v_segment.id;
    end if;
  else
    -- Paused: the work ended when the last segment closed; the session ends no earlier than that.
    select max(g.segment_ended_at) into v_last_end
      from public.work_session_segments g where g.work_session_id = v_session.id;
    if p_ended_at is not null and (v_end < coalesce(v_last_end, v_session.started_at) or v_end > now()) then
      raise exception 'The end time must be between the last pause and now'
        using errcode = '22023', hint = 'invalid_end_time';
    end if;
  end if;

  update public.work_sessions
     set status = 'completed', ended_at = greatest(v_end, v_session.started_at)
   where id = v_session.id;

  if v_session.task_id is not null then
    v_handoff := private.session_insert_handoff(v_uid, v_session.id, v_session.project_id,
      v_session.task_id, p_handoff, p_update_task_next_action);
  end if;

  select coalesce(sum(extract(epoch from (g.segment_ended_at - g.segment_started_at))), 0)::bigint
    into v_seconds
    from public.work_session_segments g where g.work_session_id = v_session.id;

  select title into v_title from public.tasks where id = v_session.task_id;
  perform private.record_activity(v_uid, v_session.project_id, v_session.task_id, 'session.completed',
    'Finished a work session on ' || coalesce(v_title, 'a task'),
    jsonb_build_object('title', v_title, 'session_id', v_session.id, 'duration_seconds', v_seconds));
  return v_handoff;
end;
$$;

------------------------------------------------------------------------------
-- save_work_handoff: "Save progress" without pausing (any session status).
------------------------------------------------------------------------------
create or replace function public.save_work_handoff(
  p_session_id uuid,
  p_handoff jsonb,
  p_update_task_next_action boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.session_lock();
  v_session record;
  v_id uuid;
begin
  select s.id, s.project_id, s.task_id into v_session
    from public.work_sessions s
   where s.id = p_session_id and s.owner_id = v_uid;
  if not found then
    raise exception 'Session not found' using errcode = 'P0002', hint = 'session_not_found';
  end if;
  if v_session.task_id is null then
    raise exception 'Handoffs need a task' using errcode = '22023', hint = 'task_required';
  end if;

  v_id := private.session_insert_handoff(v_uid, v_session.id, v_session.project_id,
    v_session.task_id, p_handoff, p_update_task_next_action);
  if v_id is null then
    raise exception 'Write at least one handoff field' using errcode = '22023', hint = 'empty_handoff';
  end if;
  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- Execute grants: signed-in users only.
------------------------------------------------------------------------------
revoke all on function public.start_work_session(uuid, uuid, text, text, boolean) from public, anon;
revoke all on function public.pause_work_session(uuid, timestamptz, jsonb, boolean) from public, anon;
revoke all on function public.resume_work_session(uuid) from public, anon;
revoke all on function public.complete_work_session(uuid, timestamptz, jsonb, boolean) from public, anon;
revoke all on function public.save_work_handoff(uuid, jsonb, boolean) from public, anon;

grant execute on function public.start_work_session(uuid, uuid, text, text, boolean) to authenticated;
grant execute on function public.pause_work_session(uuid, timestamptz, jsonb, boolean) to authenticated;
grant execute on function public.resume_work_session(uuid) to authenticated;
grant execute on function public.complete_work_session(uuid, timestamptz, jsonb, boolean) to authenticated;
grant execute on function public.save_work_handoff(uuid, jsonb, boolean) to authenticated;
