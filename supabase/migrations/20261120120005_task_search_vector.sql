-- M18b stored search vector for tasks (Plan P7.7)
--
-- Timed through the API as a seeded user (1,500 tasks): every list and dashboard query cost about
-- one network round trip, but global_search spent 40-130 ms, mostly building a tsvector for every
-- task on every search. Tasks now keep a generated, indexed search_vector (title A, next action B,
-- description C), like documents and commands, and global_search reads it.

alter table public.tasks
  add column search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(next_action, '')), 'B')
    || setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored;

create index tasks_search_idx on public.tasks using gin (search_vector);

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
           (ts_rank(t.search_vector, v_tsq)
             + case when t.title ilike v_pat then 1::real else 0::real end)
             * case when t.archived_at is null and t.status <> 'done' then 1::real else 0.5::real end,
           t.updated_at
      from public.tasks t
      join public.projects p on p.id = t.project_id
     where t.owner_id = v_uid
       and (t.search_vector @@ v_tsq or t.title ilike v_pat)

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
