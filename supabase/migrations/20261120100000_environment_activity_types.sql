-- M12a environment, service and configuration activity types (Plan P5.1–P5.3; Spec FR-08, FR-09, FR-13)
-- Separate migration: a new enum value can't be used in the transaction that adds it.

alter type public.activity_event_type add value if not exists 'environment.created';
alter type public.activity_event_type add value if not exists 'environment.updated';
alter type public.activity_event_type add value if not exists 'environment.archived';
alter type public.activity_event_type add value if not exists 'environment.restored';
alter type public.activity_event_type add value if not exists 'environment.reviewed';
alter type public.activity_event_type add value if not exists 'environment.deleted';
alter type public.activity_event_type add value if not exists 'service.added';
alter type public.activity_event_type add value if not exists 'service.updated';
alter type public.activity_event_type add value if not exists 'service.removed';
alter type public.activity_event_type add value if not exists 'service_instance.added';
alter type public.activity_event_type add value if not exists 'service_instance.updated';
alter type public.activity_event_type add value if not exists 'service_instance.removed';
alter type public.activity_event_type add value if not exists 'variable.added';
alter type public.activity_event_type add value if not exists 'variable.updated';
alter type public.activity_event_type add value if not exists 'variable.removed';
alter type public.activity_event_type add value if not exists 'secret_reference.added';
alter type public.activity_event_type add value if not exists 'secret_reference.removed';
