-- ============================================================
-- Storage bucket for task results (photos / documents).
-- Public read (so links work anywhere); authenticated write.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('task-results', 'task-results', true)
on conflict (id) do nothing;

drop policy if exists "task_results_read" on storage.objects;
create policy "task_results_read" on storage.objects
  for select using (bucket_id = 'task-results');

drop policy if exists "task_results_insert" on storage.objects;
create policy "task_results_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'task-results');

drop policy if exists "task_results_update" on storage.objects;
create policy "task_results_update" on storage.objects
  for update to authenticated using (bucket_id = 'task-results');

drop policy if exists "task_results_delete" on storage.objects;
create policy "task_results_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'task-results');
