create extension if not exists pgcrypto;

create table if not exists public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  context_label text,
  language text not null default 'zh-TW',
  tone text default 'confident',
  status text not null default 'success',
  error_message text,
  input_chars integer not null default 0,
  output_chars integer not null default 0,
  app_name text not null default 'reality_hack',
  event_type text not null default 'mission_generation',
  mission_type text,
  safety_level text,
  story_mood text,
  available_minutes integer,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  alias text,
  safety_level text not null default 'low' check (safety_level in ('low', 'medium')),
  story_mood text not null default 'glitch' check (story_mood in ('mysterious', 'glitch', 'calm', 'campus')),
  preferred_minutes integer not null default 3 check (preferred_minutes between 1 and 10),
  location_hint text,
  language text not null default 'zh-TW' check (language in ('zh-TW', 'en')),
  cloud_sync_enabled boolean not null default false
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  mission_type text not null check (mission_type in ('observe', 'action', 'mind', 'time')),
  mission jsonb not null,
  feedback text check (feedback in ('completed', 'skipped', 'unsafe')),
  completed boolean not null default false,
  safety_level text check (safety_level in ('low', 'medium')),
  story_mood text check (story_mood in ('mysterious', 'glitch', 'calm', 'campus')),
  system_summary jsonb not null default '{}'::jsonb
);

create table if not exists public.mission_records (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  note text,
  local_only boolean not null default false
);

create table if not exists public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  storage_bucket text not null default 'mission-evidence',
  storage_path text not null,
  mime_type text,
  file_size integer,
  local_only boolean not null default false
);

create table if not exists public.device_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  platform text not null,
  push_token text not null,
  timezone text,
  notifications_enabled boolean not null default true,
  unique (user_id, push_token)
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  product_id text not null,
  status text not null check (status in ('active', 'expired', 'revoked', 'trial')),
  expires_at timestamptz,
  source text not null default 'app_store'
);

alter table public.generation_logs
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists expires_at timestamptz not null default (now() + interval '90 days'),
  add column if not exists redaction_level text not null default 'summary_only';

create index if not exists missions_user_created_idx on public.missions (user_id, created_at desc);
create index if not exists mission_records_user_mission_idx on public.mission_records (user_id, mission_id);
create index if not exists evidence_files_user_mission_idx on public.evidence_files (user_id, mission_id);
create index if not exists device_installations_user_idx on public.device_installations (user_id);
create index if not exists entitlements_user_status_idx on public.entitlements (user_id, status);
create index if not exists generation_logs_expires_at_idx on public.generation_logs (expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists missions_set_updated_at on public.missions;
create trigger missions_set_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

drop trigger if exists mission_records_set_updated_at on public.mission_records;
create trigger mission_records_set_updated_at
before update on public.mission_records
for each row execute function public.set_updated_at();

drop trigger if exists device_installations_set_updated_at on public.device_installations;
create trigger device_installations_set_updated_at
before update on public.device_installations
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.mission_records enable row level security;
alter table public.evidence_files enable row level security;
alter table public.device_installations enable row level security;
alter table public.entitlements enable row level security;

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
for delete to authenticated
using ((select auth.uid()) = id);

drop policy if exists "missions_read_own" on public.missions;
create policy "missions_read_own" on public.missions
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "missions_insert_own" on public.missions;
create policy "missions_insert_own" on public.missions
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "missions_update_own" on public.missions;
create policy "missions_update_own" on public.missions
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "missions_delete_own" on public.missions;
create policy "missions_delete_own" on public.missions
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "mission_records_read_own" on public.mission_records;
create policy "mission_records_read_own" on public.mission_records
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "mission_records_insert_own" on public.mission_records;
create policy "mission_records_insert_own" on public.mission_records
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "mission_records_update_own" on public.mission_records;
create policy "mission_records_update_own" on public.mission_records
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "mission_records_delete_own" on public.mission_records;
create policy "mission_records_delete_own" on public.mission_records
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "evidence_files_read_own" on public.evidence_files;
create policy "evidence_files_read_own" on public.evidence_files
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "evidence_files_insert_own" on public.evidence_files;
create policy "evidence_files_insert_own" on public.evidence_files
for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "evidence_files_update_own" on public.evidence_files;
create policy "evidence_files_update_own" on public.evidence_files
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "evidence_files_delete_own" on public.evidence_files;
create policy "evidence_files_delete_own" on public.evidence_files
for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "device_installations_manage_own" on public.device_installations;
create policy "device_installations_manage_own" on public.device_installations
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "entitlements_read_own" on public.entitlements;
create policy "entitlements_read_own" on public.entitlements
for select to authenticated
using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mission-evidence',
  'mission-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mission_evidence_read_own" on storage.objects;
create policy "mission_evidence_read_own" on storage.objects
for select to authenticated
using (
  bucket_id = 'mission-evidence'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "mission_evidence_insert_own" on storage.objects;
create policy "mission_evidence_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'mission-evidence'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "mission_evidence_update_own" on storage.objects;
create policy "mission_evidence_update_own" on storage.objects
for update to authenticated
using (
  bucket_id = 'mission-evidence'
  and split_part(name, '/', 1) = (select auth.uid())::text
)
with check (
  bucket_id = 'mission-evidence'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

drop policy if exists "mission_evidence_delete_own" on storage.objects;
create policy "mission_evidence_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'mission-evidence'
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create or replace function public.delete_my_reality_hack_data()
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  delete from storage.objects
  where bucket_id = 'mission-evidence'
    and split_part(name, '/', 1) = current_user_id::text;

  delete from public.device_installations where user_id = current_user_id;
  delete from public.entitlements where user_id = current_user_id;
  delete from public.evidence_files where user_id = current_user_id;
  delete from public.mission_records where user_id = current_user_id;
  delete from public.missions where user_id = current_user_id;
  delete from public.profiles where id = current_user_id;
  delete from public.generation_logs where user_id = current_user_id;
end;
$$;

revoke all on function public.delete_my_reality_hack_data() from public;
grant execute on function public.delete_my_reality_hack_data() to authenticated;
