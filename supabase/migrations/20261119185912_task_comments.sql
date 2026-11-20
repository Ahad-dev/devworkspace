-- M08 task comments (Plan P3.3; Spec FR-06, FR-13)

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  task_id uuid not null,
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_comments_task_owner_fkey foreign key (task_id, owner_id)
    references public.tasks (id, owner_id) on delete cascade
);

create index task_comments_task_created_idx on public.task_comments (task_id, created_at);

create trigger task_comments_set_updated_at
  before update on public.task_comments
  for each row execute function private.set_updated_at();

-- Logs that a comment was added, never its content.
create or replace function private.task_comments_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  select project_id, title into t from public.tasks where id = new.task_id;
  perform private.record_activity(new.owner_id, t.project_id, new.task_id, 'task.comment_added',
    'Commented on ' || t.title, jsonb_build_object('title', t.title, 'comment_id', new.id));
  return new;
end;
$$;

create trigger task_comments_activity
  after insert on public.task_comments
  for each row execute function private.task_comments_activity();

alter table public.task_comments enable row level security;

create policy "task_comments: owner can read" on public.task_comments
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "task_comments: owner can insert" on public.task_comments
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "task_comments: owner can update" on public.task_comments
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "task_comments: owner can delete" on public.task_comments
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.task_comments from anon, authenticated;
grant select, delete on table public.task_comments to authenticated;
grant insert (task_id, content) on table public.task_comments to authenticated;
grant update (content) on table public.task_comments to authenticated;
