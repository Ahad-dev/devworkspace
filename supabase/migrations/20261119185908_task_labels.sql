-- M07 task labels (Plan P3.2; Spec FR-06, §8.2)

create table public.task_labels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 50),
  -- Named design tokens, not arbitrary CSS.
  color text not null default 'gray'
    check (color in ('gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'violet', 'pink')),
  created_at timestamptz not null default now(),
  constraint task_labels_id_owner_key unique (id, owner_id)
);

create unique index task_labels_owner_name_key on public.task_labels (owner_id, lower(name));

create table public.task_label_links (
  task_id uuid not null,
  label_id uuid not null,
  owner_id uuid not null default auth.uid(),
  primary key (task_id, label_id),
  -- Both sides must belong to the same owner.
  constraint task_label_links_task_owner_fkey foreign key (task_id, owner_id)
    references public.tasks (id, owner_id) on delete cascade,
  constraint task_label_links_label_owner_fkey foreign key (label_id, owner_id)
    references public.task_labels (id, owner_id) on delete cascade
);

create index task_label_links_label_idx on public.task_label_links (label_id);

alter table public.task_labels enable row level security;
alter table public.task_label_links enable row level security;

create policy "task_labels: owner can read" on public.task_labels
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "task_labels: owner can insert" on public.task_labels
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "task_labels: owner can update" on public.task_labels
  for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "task_labels: owner can delete" on public.task_labels
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "task_label_links: owner can read" on public.task_label_links
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy "task_label_links: owner can insert" on public.task_label_links
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "task_label_links: owner can delete" on public.task_label_links
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.task_labels from anon, authenticated;
grant select, delete on table public.task_labels to authenticated;
grant insert (name, color), update (name, color) on table public.task_labels to authenticated;

revoke all on table public.task_label_links from anon, authenticated;
grant select, delete on table public.task_label_links to authenticated;
grant insert (task_id, label_id) on table public.task_label_links to authenticated;
