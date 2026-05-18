alter table public.generation_logs enable row level security;

drop policy if exists "generation_logs_read_own" on public.generation_logs;
create policy "generation_logs_read_own" on public.generation_logs
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "generation_logs_insert_own" on public.generation_logs;
create policy "generation_logs_insert_own" on public.generation_logs
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "generation_logs_delete_own" on public.generation_logs;
create policy "generation_logs_delete_own" on public.generation_logs
for delete to authenticated
using ((select auth.uid()) = user_id);
