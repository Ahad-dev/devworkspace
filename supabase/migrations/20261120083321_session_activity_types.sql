-- M11a work-session activity event types (Plan P4.1; Spec FR-07, FR-13)
-- Separate migration: a new enum value can't be used in the transaction that adds it.

alter type public.activity_event_type add value if not exists 'session.started';
alter type public.activity_event_type add value if not exists 'session.paused';
alter type public.activity_event_type add value if not exists 'session.resumed';
alter type public.activity_event_type add value if not exists 'session.completed';
alter type public.activity_event_type add value if not exists 'handoff.saved';
