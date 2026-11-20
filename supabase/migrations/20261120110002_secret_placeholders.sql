-- M15b placeholders are not secrets (Plan P6.6; Spec FR-11 "use placeholders such as $DATABASE_URL")
--
-- Runbooks and commands often show a connection string with the password slot filled by a
-- placeholder: postgres://app:$PGPASSWORD@db:5432/app, ${DB_PASSWORD}, <password>, {password},
-- %PASSWORD% or ****. The Phase 5 rule rejected those as credential URLs. The password slot may
-- now start with a placeholder character; a literal password is still refused. The other checks
-- (private keys, token prefixes, AWS key ids, JWTs) are unchanged. Relaxing only, so every
-- existing value still passes.

do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint where contypid = 'public.no_secret_text'::regtype
  loop
    execute format('alter domain public.no_secret_text drop constraint %I', c.conname);
  end loop;
end;
$$;

alter domain public.no_secret_text add constraint no_secret_text_check check (
  value !~ '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  and value !~* '[a-z][a-z0-9+.-]*://[^\s/?#@:]*:(?![$<{%*])[^\s/?#@]+@'
  and value !~ '(sk_live_|rk_live_|ghp_|gho_|ghs_|ghr_|github_pat_|glpat-|xox[abposr]-|sb_secret_|sbp_)[A-Za-z0-9_-]{8,}'
  and value !~ 'AKIA[0-9A-Z]{16}'
  and value !~ 'eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}'
);
