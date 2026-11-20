-- M15a knowledge-base activity types (Plan P6.1–P6.3; Spec FR-10, FR-11, FR-13)
-- Separate migration: a new enum value can't be used in the transaction that adds it.

alter type public.activity_event_type add value if not exists 'document.created';
alter type public.activity_event_type add value if not exists 'document.updated';
alter type public.activity_event_type add value if not exists 'document.archived';
alter type public.activity_event_type add value if not exists 'document.restored';
alter type public.activity_event_type add value if not exists 'document.deleted';
alter type public.activity_event_type add value if not exists 'attachment.added';
alter type public.activity_event_type add value if not exists 'attachment.removed';
alter type public.activity_event_type add value if not exists 'command.created';
alter type public.activity_event_type add value if not exists 'command.updated';
alter type public.activity_event_type add value if not exists 'command.deleted';
