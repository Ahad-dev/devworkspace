-- M30b Accounts and the end-to-end encrypted vault (Plan P11.1; owner's decision 2026-11-27, Plan §10)
--
-- accounts: which platform account (Neon, Resend, Vercel…) uses which login, owner-level.
-- account_secrets: its passwords, API keys, tokens, recovery codes and secure notes, stored ONLY as
--   AES-256-GCM ciphertext made in the owner's browser. The server never sees a plaintext value, the
--   master password, the recovery key or the vault key (docs/SECURITY.md §8).
-- vault_keys: one row per owner holding the vault key wrapped by the master password and by the
--   recovery key, plus the key-derivation settings. Wrapped keys are ciphertext too.
-- project_services.account_id: which account a project's service runs under.

-- Standard base64 (no URL-safe alphabet, padded). Ciphertext is not user text, so it doesn't use
-- no_secret_text: random bytes could, very rarely, look like a key prefix.
create domain public.base64_bytes as text
  check (char_length(value) % 4 = 0 and value ~ '^[A-Za-z0-9+/]+={0,2}$');

create type public.account_two_factor as enum (
  'unknown', 'none', 'authenticator_app', 'sms', 'email', 'security_key'
);
create type public.account_secret_kind as enum (
  'password', 'api_key', 'token', 'recovery_codes', 'note'
);

------------------------------------------------------------------------------
-- vault_keys
------------------------------------------------------------------------------
create table public.vault_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  format_version smallint not null default 1 check (format_version = 1),
  -- PBKDF2-SHA256 iterations for the master password; the browser refuses anything weaker too.
  kdf_iterations integer not null check (kdf_iterations between 600000 and 5000000),
  kdf_salt public.base64_bytes not null check (char_length(kdf_salt) = 24),                       -- 16 B
  master_wrapped_key public.base64_bytes not null check (char_length(master_wrapped_key) = 64),   -- 32 B key + 16 B tag
  master_wrap_iv public.base64_bytes not null check (char_length(master_wrap_iv) = 16),           -- 12 B
  recovery_salt public.base64_bytes not null check (char_length(recovery_salt) = 24),
  recovery_wrapped_key public.base64_bytes not null check (char_length(recovery_wrapped_key) = 64),
  recovery_wrap_iv public.base64_bytes not null check (char_length(recovery_wrap_iv) = 16),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint vault_keys_owner_key unique (owner_id)
);

comment on table public.vault_keys is
  'The vault key, wrapped by the master password and by the recovery key. Never a usable key.';

create trigger vault_keys_set_updated_at
  before update on public.vault_keys
  for each row execute function private.set_updated_at();

------------------------------------------------------------------------------
-- accounts
------------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  platform public.no_secret_text not null check (char_length(btrim(platform)) between 1 and 80),
  label public.no_secret_text check (label is null or char_length(label) <= 80),
  -- The login email or username: not a secret, so it is plain and searchable. No spaces.
  login_identifier public.no_secret_text check (
    login_identifier is null or login_identifier ~ '^\S{1,254}$'
  ),
  login_url public.http_url,
  two_factor public.account_two_factor not null default 'unknown',
  notes public.no_secret_text check (notes is null or char_length(notes) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounts_id_owner_key unique (id, owner_id)
);

create unique index accounts_owner_platform_label_key
  on public.accounts (owner_id, lower(platform), lower(coalesce(label, '')));

create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function private.set_updated_at();

------------------------------------------------------------------------------
-- account_secrets
------------------------------------------------------------------------------
create table public.account_secrets (
  -- Chosen by the browser: the id is bound into the encryption's associated data, so a ciphertext
  -- copied to another row (or account) fails to decrypt.
  id uuid primary key,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  account_id uuid not null,
  label public.no_secret_text not null check (char_length(btrim(label)) between 1 and 80),
  kind public.account_secret_kind not null default 'password',
  format_version smallint not null default 1 check (format_version = 1),
  -- AES-256-GCM output (padded plaintext + 16 B tag): 48 B to about 16 KiB.
  ciphertext public.base64_bytes not null check (char_length(ciphertext) between 64 and 22000),
  iv public.base64_bytes not null check (char_length(iv) = 16),
  value_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint account_secrets_account_owner_fkey foreign key (account_id, owner_id)
    references public.accounts (id, owner_id) on delete cascade,
  -- No secrets without a vault; resetting the vault (deleting its row) removes them.
  constraint account_secrets_vault_owner_fkey foreign key (owner_id)
    references public.vault_keys (owner_id) on delete cascade,
  constraint account_secrets_id_owner_key unique (id, owner_id),
  -- GCM must never reuse an IV with the same key: the database refuses it.
  constraint account_secrets_owner_iv_key unique (owner_id, iv)
);

create unique index account_secrets_account_label_key
  on public.account_secrets (account_id, lower(label));

create trigger account_secrets_set_updated_at
  before update on public.account_secrets
  for each row execute function private.set_updated_at();

create or replace function private.account_secrets_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ciphertext is distinct from old.ciphertext then
    if new.iv = old.iv then
      raise exception 'A changed value needs a new IV'
        using errcode = '23514', hint = 'iv_reuse';
    end if;
    new.value_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger account_secrets_before_update
  before update on public.account_secrets
  for each row execute function private.account_secrets_before_update();

------------------------------------------------------------------------------
-- project_services.account_id
------------------------------------------------------------------------------
alter table public.project_services add column account_id uuid;
alter table public.project_services
  add constraint project_services_account_owner_fkey foreign key (account_id, owner_id)
    references public.accounts (id, owner_id) on delete set null (account_id);
create index project_services_account_idx on public.project_services (account_id)
  where account_id is not null;

------------------------------------------------------------------------------
-- Activity: names, kinds and changed field names only; never ciphertext, IVs, salts or logins.
------------------------------------------------------------------------------
create or replace function private.accounts_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
  v_name text;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.profiles where id = old.owner_id) then
      perform private.record_activity(old.owner_id, null, null, 'account.removed',
        'Removed account ' || old.platform || coalesce(' (' || old.label || ')', ''),
        jsonb_build_object('account_id', old.id, 'platform', old.platform));
    end if;
    return old;
  end if;

  v_name := new.platform || coalesce(' (' || new.label || ')', '');
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, null, null, 'account.added',
      'Added account ' || v_name,
      jsonb_build_object('account_id', new.id, 'platform', new.platform));
    return new;
  end if;

  if new.platform is distinct from old.platform then changed := array_append(changed, 'platform'); end if;
  if new.label is distinct from old.label then changed := array_append(changed, 'label'); end if;
  if new.login_identifier is distinct from old.login_identifier then changed := array_append(changed, 'login'); end if;
  if new.login_url is distinct from old.login_url then changed := array_append(changed, 'login_url'); end if;
  if new.two_factor is distinct from old.two_factor then changed := array_append(changed, 'two_factor'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;
  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, null, null, 'account.updated',
      'Updated account ' || v_name,
      jsonb_build_object('account_id', new.id, 'platform', new.platform, 'changed', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

create trigger accounts_activity
  after insert or update or delete on public.accounts
  for each row execute function private.accounts_activity();

create or replace function private.account_secrets_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
  v_platform text;
begin
  if tg_op = 'DELETE' then
    -- Skip the cascade from removing the account or resetting the vault: those log their own event.
    select platform into v_platform from public.accounts where id = old.account_id;
    if v_platform is not null and exists (select 1 from public.vault_keys where owner_id = old.owner_id) then
      perform private.record_activity(old.owner_id, null, null, 'account_secret.removed',
        'Removed ' || old.label || ' from ' || v_platform,
        jsonb_build_object('account_id', old.account_id, 'secret_id', old.id, 'kind', old.kind));
    end if;
    return old;
  end if;

  select platform into v_platform from public.accounts where id = new.account_id;
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, null, null, 'account_secret.added',
      'Added ' || new.label || ' to ' || coalesce(v_platform, 'an account'),
      jsonb_build_object('account_id', new.account_id, 'secret_id', new.id, 'kind', new.kind));
    return new;
  end if;

  if new.ciphertext is distinct from old.ciphertext then changed := array_append(changed, 'value'); end if;
  if new.label is distinct from old.label then changed := array_append(changed, 'label'); end if;
  if new.kind is distinct from old.kind then changed := array_append(changed, 'kind'); end if;
  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, null, null, 'account_secret.updated',
      'Updated ' || new.label || ' in ' || coalesce(v_platform, 'an account'),
      jsonb_build_object('account_id', new.account_id, 'secret_id', new.id, 'kind', new.kind,
        'changed', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

create trigger account_secrets_activity
  after insert or update or delete on public.account_secrets
  for each row execute function private.account_secrets_activity();

create or replace function private.vault_keys_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, null, null, 'vault.created',
      'Set up the password vault', '{}'::jsonb);
    return new;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.profiles where id = old.owner_id) then
      perform private.record_activity(old.owner_id, null, null, 'vault.reset',
        'Reset the password vault (stored secrets deleted)', '{}'::jsonb);
    end if;
    return old;
  end if;
  if new.master_wrapped_key is distinct from old.master_wrapped_key then
    perform private.record_activity(new.owner_id, null, null, 'vault.password_changed',
      'Changed the vault master password', '{}'::jsonb);
  end if;
  if new.recovery_wrapped_key is distinct from old.recovery_wrapped_key then
    perform private.record_activity(new.owner_id, null, null, 'vault.recovery_key_changed',
      'Created a new vault recovery key', '{}'::jsonb);
  end if;
  return new;
end;
$$;

create trigger vault_keys_activity
  after insert or update or delete on public.vault_keys
  for each row execute function private.vault_keys_activity();

-- project_services: also note when the linked account changes (same body as M13 plus 'account').
create or replace function private.project_services_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed text[] := array[]::text[];
begin
  if tg_op = 'INSERT' then
    perform private.record_activity(new.owner_id, new.project_id, null, 'service.added',
      'Added service ' || new.name,
      jsonb_build_object('service_id', new.id, 'name', new.name, 'category', new.category));
    return new;
  end if;
  if tg_op = 'DELETE' then
    if exists (select 1 from public.projects where id = old.project_id) then
      perform private.record_activity(old.owner_id, old.project_id, null, 'service.removed',
        'Removed service ' || old.name, jsonb_build_object('service_id', old.id, 'name', old.name));
    end if;
    return old;
  end if;

  if new.name is distinct from old.name then changed := array_append(changed, 'name'); end if;
  if new.category is distinct from old.category then changed := array_append(changed, 'category'); end if;
  if new.provider is distinct from old.provider then changed := array_append(changed, 'provider'); end if;
  if new.purpose is distinct from old.purpose then changed := array_append(changed, 'purpose'); end if;
  if new.dashboard_url is distinct from old.dashboard_url then changed := array_append(changed, 'dashboard_url'); end if;
  if new.documentation_url is distinct from old.documentation_url then changed := array_append(changed, 'documentation_url'); end if;
  if new.notes is distinct from old.notes then changed := array_append(changed, 'notes'); end if;
  if new.account_id is distinct from old.account_id then changed := array_append(changed, 'account'); end if;
  if cardinality(changed) > 0 then
    perform private.record_activity(new.owner_id, new.project_id, null, 'service.updated',
      'Updated service ' || new.name,
      jsonb_build_object('service_id', new.id, 'name', new.name, 'changed', to_jsonb(changed)));
  end if;
  return new;
end;
$$;

------------------------------------------------------------------------------
-- RLS + grants
------------------------------------------------------------------------------
alter table public.vault_keys enable row level security;
alter table public.accounts enable row level security;
alter table public.account_secrets enable row level security;

create policy "vault_keys: owner can read" on public.vault_keys
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "vault_keys: owner can insert" on public.vault_keys
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "vault_keys: owner can update" on public.vault_keys
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "vault_keys: owner can delete" on public.vault_keys
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "accounts: owner can read" on public.accounts
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "accounts: owner can insert" on public.accounts
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "accounts: owner can update" on public.accounts
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "accounts: owner can delete" on public.accounts
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "account_secrets: owner can read" on public.account_secrets
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "account_secrets: owner can insert" on public.account_secrets
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "account_secrets: owner can update" on public.account_secrets
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "account_secrets: owner can delete" on public.account_secrets
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.vault_keys, public.accounts, public.account_secrets from anon, authenticated;
grant select, delete on table public.vault_keys, public.accounts, public.account_secrets to authenticated;
grant insert (kdf_iterations, kdf_salt, master_wrapped_key, master_wrap_iv,
              recovery_salt, recovery_wrapped_key, recovery_wrap_iv),
      update (kdf_iterations, kdf_salt, master_wrapped_key, master_wrap_iv,
              recovery_salt, recovery_wrapped_key, recovery_wrap_iv)
  on table public.vault_keys to authenticated;
grant insert (platform, label, login_identifier, login_url, two_factor, notes),
      update (platform, label, login_identifier, login_url, two_factor, notes)
  on table public.accounts to authenticated;
-- account_id can't change: it is bound into the ciphertext.
grant insert (id, account_id, label, kind, ciphertext, iv),
      update (label, kind, ciphertext, iv)
  on table public.account_secrets to authenticated;
grant insert (account_id), update (account_id) on table public.project_services to authenticated;
grant select, insert, update, delete on table public.vault_keys, public.accounts, public.account_secrets
  to service_role;
