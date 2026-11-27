-- M30a account and vault activity types (Plan P11.1)
-- Separate migration: a new enum value can't be used in the transaction that adds it.

alter type public.activity_event_type add value if not exists 'account.added';
alter type public.activity_event_type add value if not exists 'account.updated';
alter type public.activity_event_type add value if not exists 'account.removed';
alter type public.activity_event_type add value if not exists 'account_secret.added';
alter type public.activity_event_type add value if not exists 'account_secret.updated';
alter type public.activity_event_type add value if not exists 'account_secret.removed';
alter type public.activity_event_type add value if not exists 'vault.created';
alter type public.activity_event_type add value if not exists 'vault.password_changed';
alter type public.activity_event_type add value if not exists 'vault.recovery_key_changed';
alter type public.activity_event_type add value if not exists 'vault.reset';
