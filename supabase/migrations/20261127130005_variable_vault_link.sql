-- M32 "Where is the value?" (Plan P12.3): a variable can point at the vault item that holds its value.
-- Only the link is stored; the value stays encrypted in account_secrets. Deleting the vault item
-- (or resetting the vault) clears the link, not the variable.

alter table public.environment_variables add column account_secret_id uuid;
alter table public.environment_variables
  add constraint environment_variables_account_secret_owner_fkey
    foreign key (account_secret_id, owner_id)
    references public.account_secrets (id, owner_id) on delete set null (account_secret_id);
create index environment_variables_account_secret_idx on public.environment_variables (account_secret_id)
  where account_secret_id is not null;

grant insert (account_secret_id), update (account_secret_id)
  on table public.environment_variables to authenticated;

-- Same activity function as M14 plus 'vault_item' when the link changes.
create or replace function private.environment_variables_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_env text;
  changed text[] := array[]::text[];
begin
  if tg_op = 'DELETE' then
    select name into v_env from public.environments where id = old.environment_id;
    if v_env is not null then
      perform private.record_activity(old.owner_id, old.project_id, null, 'variable.removed',
        'Removed ' || old.name || ' from ' || v_env,
        jsonb_build_object('name', old.name, 'environment', v_env));
    end if;
    return old;
  end if;

  select name into v_env from public.environments where id = new.environment_id;

  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'variable.added',
      'Added ' || new.name || ' to ' || coalesce(v_env, 'an environment'),
      jsonb_build_object('name', new.name, 'environment', v_env, 'required', new.is_required,
        'sensitive', new.is_sensitive, 'status', new.configuration_status));
    return new;
  end if;

  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.is_required is distinct from old.is_required then changed := array_append(changed, 'required'); end if;
  if new.is_sensitive is distinct from old.is_sensitive then changed := array_append(changed, 'sensitive'); end if;
  if new.configuration_status is distinct from old.configuration_status then changed := array_append(changed, 'status'); end if;
  if new.verification_method is distinct from old.verification_method then changed := array_append(changed, 'verification'); end if;
  if new.secret_reference_id is distinct from old.secret_reference_id then changed := array_append(changed, 'secret_reference'); end if;
  if new.account_secret_id is distinct from old.account_secret_id then changed := array_append(changed, 'vault_item'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;
  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, null, 'variable.updated',
      'Updated ' || new.name || ' in ' || coalesce(v_env, 'an environment'),
      jsonb_build_object('name', new.name, 'environment', v_env, 'changed', to_jsonb(changed),
        'from', old.configuration_status, 'to', new.configuration_status));
  end if;
  return new;
end;
$$;
