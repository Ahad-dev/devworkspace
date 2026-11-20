-- Activity ordering within one transaction (Plan P4.2; decision log 2026-11-20)
-- now() is the transaction's start time, so events written by one RPC (e.g. "paused" then
-- "handoff saved") shared a timestamp and showed in arbitrary order. clock_timestamp() advances
-- per insert, so the timeline keeps the order things happened.

alter table public.activity_events alter column created_at set default clock_timestamp();
