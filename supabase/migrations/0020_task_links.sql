-- ============================================================
-- 0020 — Structured task results: description + N links, with optional
-- publishing of a link into Super Link.
--
-- `tasks.result` keeps holding the free-text DESCRIPTION. Each attached link
-- becomes a row here instead of being pasted into that text, so we can:
--   * validate each URL on its own,
--   * publish a link into Super Link and remember WHICH links row it created
--     (`link_id`) — so re-saving the task updates that row instead of
--     inserting a duplicate,
--   * cascade: editing/removing the link here edits/removes the Super Link row.
-- Run after 0001-0019.
-- ============================================================
begin;

create table if not exists task_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  url text not null,
  label text default '',
  -- when true, this link is mirrored into the `links` (Super Link) table
  in_super_link boolean not null default false,
  -- the Super Link row this link owns; null when not published.
  -- ON DELETE SET NULL so deleting the Super Link row directly just unlinks.
  link_id uuid references links(id) on delete set null,
  "order" int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists task_links_task_idx on task_links(task_id);
create index if not exists task_links_link_idx on task_links(link_id);

-- One Super Link row can only be owned by one task link.
create unique index if not exists task_links_link_uniq on task_links(link_id) where link_id is not null;

alter table task_links enable row level security;

drop policy if exists "task_links_read" on task_links;
create policy "task_links_read" on task_links for select using (auth.uid() is not null);

-- Anyone who can fill in a task result can manage its links; the app enforces
-- the finer per-division rules (can.editTaskProgress).
drop policy if exists "task_links_write" on task_links;
create policy "task_links_write" on task_links for all
  using (auth_role() in ('admin','coordinator','staff','intern'))
  with check (auth_role() in ('admin','coordinator','staff','intern'));

commit;
