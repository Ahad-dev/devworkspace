-- M18 dashboard summary and global search (Plan P7.1, P7.4; Spec FR-02, FR-12)
--
-- Both are SECURITY INVOKER: they run as the signed-in user, so RLS scopes every table to the
-- owner. The explicit owner filters only help the planner use the owner indexes.

------------------------------------------------------------------------------
-- dashboard_summary(): the counts the dashboard shows, in one round trip. Overdue is derived
-- from due_at (stored as the end of the due day in the owner's timezone), never stored.
------------------------------------------------------------------------------
create or replace function public.dashboard_summary()
returns table (
  inbox integer,
  ready integer,
  in_progress integer,
  blocked integer,
  review integer,
  overdue integer,
  missing_next_action integer,
  environments_needing_review integer,
  active_projects integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*) filter (where t.status = 'inbox')::int,
    count(*) filter (where t.status = 'ready')::int,
    count(*) filter (where t.status = 'in_progress')::int,
    count(*) filter (where t.status = 'blocked')::int,
    count(*) filter (where t.status = 'review')::int,
    count(*) filter (where t.status <> 'done' and t.due_at < now())::int,
    count(*) filter (
      where t.status = 'in_progress' and nullif(btrim(t.next_action), '') is null
    )::int,
    (select count(*)
       from public.environments e
      where e.owner_id = (select auth.uid())
        and e.status <> 'archived'
        and (e.status = 'needs_review'
             or e.last_reviewed_at is null
             or e.last_reviewed_at < now() - interval '90 days'))::int,
    (select count(*)
       from public.projects p
      where p.owner_id = (select auth.uid()) and p.status in ('active', 'maintenance'))::int
  from public.tasks t
  where t.owner_id = (select auth.uid()) and t.archived_at is null;
$$;

comment on function public.dashboard_summary() is
  'Dashboard counts for the signed-in user (FR-02). Security invoker: RLS applies.';

------------------------------------------------------------------------------
-- global_search(q, limit): projects, tasks, repositories, technologies, environments, services
-- (and their instances' resource names and endpoints), documents, commands and environment
-- variable NAMES. Full-text search (english) plus a substring match for identifiers such as
-- DATABASE_URL. Up to p_limit results per kind, each with project context and an excerpt whose
-- matches are wrapped in ⟪ ⟫ (plain characters; the UI turns them into highlights).
------------------------------------------------------------------------------
create or replace function public.global_search(p_query text, p_limit integer default 5)
returns table (
  kind text,
  id uuid,
  title text,
  excerpt text,
  meta text,
  project_id uuid,
  project_name text,
  parent_id uuid,
  rank real
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_q text := left(btrim(coalesce(p_query, '')), 100);
  v_limit integer := least(greatest(coalesce(p_limit, 5), 1), 50);
  v_tsq tsquery;
  v_pat text;
begin
  if v_uid is null or char_length(v_q) < 2 then
    return;
  end if;
  v_tsq := websearch_to_tsquery('english', v_q);
  v_pat := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with hits as (
    select 'project'::text as kind, p.id, p.name::text as title,
           coalesce(p.description, '')::text as body, p.status::text as meta,
           p.id as project_id, p.name::text as project_name, null::uuid as parent_id,
           (ts_rank(to_tsvector('english', p.name || ' ' || coalesce(p.description, '')), v_tsq)
             + case when p.name ilike v_pat then 1::real else 0::real end)
             * case when p.status = 'archived' then 0.5::real else 1::real end as rank,
           p.updated_at
      from public.projects p
     where p.owner_id = v_uid
       and (to_tsvector('english', p.name || ' ' || coalesce(p.description, '')) @@ v_tsq
            or p.name ilike v_pat)

    union all
    select 'task', t.id, t.title::text,
           concat_ws(' · ', nullif(btrim(t.next_action), ''), t.description)::text,
           case when t.archived_at is not null then 'archived' else t.status::text end,
           t.project_id, p.name::text, null::uuid,
           (ts_rank(to_tsvector('english', t.title || ' ' || coalesce(t.next_action, '') || ' '
                      || coalesce(t.description, '')), v_tsq)
             + case when t.title ilike v_pat then 1::real else 0::real end)
             * case when t.archived_at is null and t.status <> 'done' then 1::real else 0.5::real end,
           t.updated_at
      from public.tasks t
      join public.projects p on p.id = t.project_id
     where t.owner_id = v_uid
       and (to_tsvector('english', t.title || ' ' || coalesce(t.next_action, '') || ' '
              || coalesce(t.description, '')) @@ v_tsq
            or t.title ilike v_pat)

    union all
    select 'repository', r.id, r.name::text,
           concat_ws(' · ', r.remote_url, r.primary_language, r.notes)::text,
           r.provider::text, r.project_id, p.name::text, null::uuid,
           ts_rank(to_tsvector('english', r.name || ' ' || coalesce(r.primary_language, '') || ' '
                     || coalesce(r.notes, '')), v_tsq)
             + case when r.name ilike v_pat or coalesce(r.remote_url, '') ilike v_pat
                    then 1::real else 0::real end,
           r.updated_at
      from public.repositories r
      join public.projects p on p.id = r.project_id
     where r.owner_id = v_uid
       and (to_tsvector('english', r.name || ' ' || coalesce(r.primary_language, '') || ' '
              || coalesce(r.notes, '')) @@ v_tsq
            or r.name ilike v_pat or coalesce(r.remote_url, '') ilike v_pat)

    union all
    select 'technology', pt.id,
           (pt.name || coalesce(' ' || pt.version, ''))::text, ''::text,
           pt.category::text, pt.project_id, p.name::text, null::uuid,
           ts_rank(to_tsvector('english', pt.name), v_tsq)
             + case when pt.name ilike v_pat then 1::real else 0::real end,
           pt.updated_at
      from public.project_technologies pt
      join public.projects p on p.id = pt.project_id
     where pt.owner_id = v_uid
       and (to_tsvector('english', pt.name) @@ v_tsq or pt.name ilike v_pat)

    union all
    select 'environment', e.id, e.name::text,
           concat_ws(' · ', e.deployment_provider, e.application_url, e.server_hostname,
                     e.notes)::text,
           e.environment_type::text, e.project_id, p.name::text, null::uuid,
           (ts_rank(to_tsvector('english', e.name || ' ' || coalesce(e.deployment_provider, '')
                      || ' ' || coalesce(e.operating_system, '') || ' ' || coalesce(e.notes, '')
                      || ' ' || coalesce(e.deployment_method, '')), v_tsq)
             + case when e.name ilike v_pat then 1::real else 0::real end)
             * case when e.status = 'archived' then 0.5::real else 1::real end,
           e.updated_at
      from public.environments e
      join public.projects p on p.id = e.project_id
     where e.owner_id = v_uid
       and (to_tsvector('english', e.name || ' ' || coalesce(e.deployment_provider, '') || ' '
              || coalesce(e.operating_system, '') || ' ' || coalesce(e.notes, '') || ' '
              || coalesce(e.deployment_method, '')) @@ v_tsq
            or e.name ilike v_pat
            or coalesce(e.application_url, '') ilike v_pat
            or coalesce(e.server_hostname, '') ilike v_pat)

    union all
    select 'service', s.id, s.name::text,
           concat_ws(' · ', s.provider, s.purpose, s.notes)::text,
           s.category::text, s.project_id, p.name::text, null::uuid,
           ts_rank(to_tsvector('english', s.name || ' ' || coalesce(s.provider, '') || ' '
                     || coalesce(s.purpose, '') || ' ' || coalesce(s.notes, '')), v_tsq)
             + case when s.name ilike v_pat or coalesce(s.provider, '') ilike v_pat
                    then 1::real else 0::real end,
           s.updated_at
      from public.project_services s
      join public.projects p on p.id = s.project_id
     where s.owner_id = v_uid
       and (to_tsvector('english', s.name || ' ' || coalesce(s.provider, '') || ' '
              || coalesce(s.purpose, '') || ' ' || coalesce(s.notes, '')) @@ v_tsq
            or s.name ilike v_pat
            or coalesce(s.provider, '') ilike v_pat
            or exists (
              select 1 from public.service_instances si
               where si.project_service_id = s.id
                 and (coalesce(si.resource_name, '') ilike v_pat
                      or coalesce(si.endpoint_hostname, '') ilike v_pat)))

    union all
    select 'document', d.id, d.title::text,
           (coalesce(d.summary || E'\n', '') || d.content_markdown)::text,
           case when d.archived_at is not null then 'archived' else d.category::text end,
           d.project_id, p.name::text, null::uuid,
           (ts_rank(d.search_vector, v_tsq)
             + case when d.title ilike v_pat then 1::real else 0::real end)
             * case when d.archived_at is null then 1::real else 0.5::real end,
           d.updated_at
      from public.documents d
      left join public.projects p on p.id = d.project_id
     where d.owner_id = v_uid
       and (d.search_vector @@ v_tsq or d.title ilike v_pat)

    union all
    select 'command', c.id, c.title::text, c.command_text::text, c.shell::text,
           c.project_id, p.name::text, null::uuid,
           ts_rank(c.search_vector, v_tsq)
             + case when c.title ilike v_pat then 1::real else 0::real end,
           c.updated_at
      from public.command_snippets c
      left join public.projects p on p.id = c.project_id
     where c.owner_id = v_uid
       and (c.search_vector @@ v_tsq or c.title ilike v_pat or c.command_text ilike v_pat)

    -- Names only: environment_variables has no value column.
    union all
    select 'variable', v.id, v.name::text,
           (e.name || ' · ' || replace(v.configuration_status::text, '_', ' '))::text,
           e.environment_type::text, v.project_id, p.name::text, v.environment_id,
           case when lower(v.name) = lower(v_q) then 2::real else 1::real end,
           v.updated_at
      from public.environment_variables v
      join public.environments e on e.id = v.environment_id
      join public.projects p on p.id = v.project_id
     where v.owner_id = v_uid and v.name ilike v_pat
  ),
  ranked as (
    select h.*, row_number() over (partition by h.kind order by h.rank desc, h.updated_at desc) as rn
      from hits h
  )
  select r.kind::text,
         r.id::uuid,
         r.title::text,
         case when r.body = '' then null::text
              else ts_headline('english', left(r.body, 4000), v_tsq,
                     'MaxWords=24, MinWords=10, ShortWord=2, MaxFragments=1, StartSel=⟪, StopSel=⟫')::text
         end,
         r.meta::text,
         r.project_id::uuid,
         r.project_name::text,
         r.parent_id::uuid,
         r.rank::real
    from ranked r
   where r.rn <= v_limit
   order by r.kind, r.rn;
end;
$$;

comment on function public.global_search(text, integer) is
  'Owner-scoped search across the workspace (FR-12). Names and metadata only: no secret values exist to index.';

revoke all on function public.dashboard_summary() from public, anon;
revoke all on function public.global_search(text, integer) from public, anon;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.global_search(text, integer) to authenticated;
