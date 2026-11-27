-- M31 one-step "Add service" (Plan P12.1): a project service and its environment links in one
-- transaction, so a failure never leaves a service linked to only some environments.
-- security invoker: the caller's RLS, column grants and composite FKs apply to both inserts.

create or replace function public.add_project_service(
  p_project_id uuid,
  p_name text,
  p_category public.service_category,
  p_provider text,
  p_account_id uuid,
  p_environment_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(cardinality(p_environment_ids), 0) > 50 then
    raise exception 'Too many environments' using errcode = '22023';
  end if;

  insert into public.project_services (project_id, name, category, provider, account_id)
  values (p_project_id, p_name, p_category, nullif(btrim(coalesce(p_provider, '')), ''), p_account_id)
  returning id into v_id;

  insert into public.service_instances (project_id, project_service_id, environment_id, status)
  select p_project_id, v_id, e.id, 'active'
    from (select distinct unnest(coalesce(p_environment_ids, '{}'::uuid[])) as id) e;

  return v_id;
end;
$$;

revoke all on function public.add_project_service(uuid, text, public.service_category, text, uuid, uuid[])
  from public, anon;
grant execute on function public.add_project_service(uuid, text, public.service_category, text, uuid, uuid[])
  to authenticated, service_role;
