-- M06a task activity event types (Plan P3.1; Spec FR-13)
-- Separate migration: a new enum value can't be used in the transaction that adds it.

alter type public.activity_event_type add value if not exists 'task.created';
alter type public.activity_event_type add value if not exists 'task.updated';
alter type public.activity_event_type add value if not exists 'task.status_changed';
alter type public.activity_event_type add value if not exists 'task.priority_changed';
alter type public.activity_event_type add value if not exists 'task.completed';
alter type public.activity_event_type add value if not exists 'task.reopened';
alter type public.activity_event_type add value if not exists 'task.archived';
alter type public.activity_event_type add value if not exists 'task.restored';
alter type public.activity_event_type add value if not exists 'task.deleted';
alter type public.activity_event_type add value if not exists 'task.comment_added';
alter type public.activity_event_type add value if not exists 'task.dependency_added';
alter type public.activity_event_type add value if not exists 'task.dependency_removed';
