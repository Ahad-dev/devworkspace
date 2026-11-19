-- M01b service_role grants (Plan P1.10; decision log 2026-11-19)
-- This Supabase project doesn't auto-grant API roles on new public tables. service_role (the secret
-- key: server-only, bypasses RLS) is expected to have full table access for admin work and for
-- test verification. anon stays revoked; authenticated keeps the explicit per-table grants.

grant select, insert, update, delete on table public.profiles to service_role;

-- Future tables, sequences and functions created by the migration role.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
