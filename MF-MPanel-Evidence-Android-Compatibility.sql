-- MF MPanel website-only compatibility layer for the existing MF Evidence Android app.
-- Adds the exact PostgREST resources queried/written by the current app.
-- Does not alter or drop the website's existing workflow tables.

create extension if not exists pgcrypto;

-- Android checks only user_id and status with GET /rest/v1/app_registrations?user_id=eq.<uid>&select=*.
-- Use a private backing table and a narrow compatibility view so the unchanged app can read status
-- without exposing email/device metadata from the older sample schema.
create table if not exists public.mfp_android_app_registrations (
  user_id text primary key,
  status text not null default 'NOT_LINKED'
    check (status in ('ACTIVATED','LINKED','WAITING_CONFIRMATION','ACCESS_REVOKED','NOT_LINKED')),
  team_id text,
  updated_at timestamptz not null default now()
);

-- If the app's original broad table was already created, copy the fields the app actually needs,
-- rename the old table out of the public API, and revoke client access to its potentially sensitive rows.
do $$
declare existing_kind "char";
begin
  select c.relkind into existing_kind
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='app_registrations';
  if existing_kind = 'r' then
    execute 'insert into public.mfp_android_app_registrations(user_id,status,team_id,updated_at) select user_id,status,team_id,updated_at from public.app_registrations on conflict (user_id) do update set status=excluded.status, team_id=excluded.team_id, updated_at=excluded.updated_at';
    if to_regclass('public.app_registrations_legacy_backup') is null then
      execute 'alter table public.app_registrations rename to app_registrations_legacy_backup';
      execute 'alter table public.app_registrations_legacy_backup enable row level security';
      execute 'revoke all on public.app_registrations_legacy_backup from anon, authenticated';
    else
      raise exception 'public.app_registrations_legacy_backup already exists; manually review the old app_registrations table before rerunning this migration';
    end if;
  elsif existing_kind = 'v' then
    execute 'drop view public.app_registrations';
  end if;
end $$;
create or replace view public.app_registrations as
  select user_id, status, team_id, updated_at from public.mfp_android_app_registrations;
grant select on public.app_registrations to anon, authenticated;
alter table public.mfp_android_app_registrations enable row level security;
drop policy if exists mf_android_registration_admin_read on public.mfp_android_app_registrations;
create policy mf_android_registration_admin_read on public.mfp_android_app_registrations
  for select to authenticated using ((select mfp_private.is_admin()));
grant select, insert, update on public.mfp_android_app_registrations to authenticated;

-- The app directly reads this key with the public Supabase key. Do not put private credentials here.
create table if not exists public.config (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.config(key, value)
values ('export_settings', jsonb_build_object('zip_password', 'MF-Evidence-Secure-2026!'))
on conflict (key) do nothing;

-- Android sends BATCH_IMPORTED with both camelCase payload fields and operation_id/batch_id.
create table if not exists public.evidence_batches (
  id uuid primary key default gen_random_uuid(),
  operation_id text unique,
  batch_id text,
  "batchId" text,
  name text,
  title text,
  email text,
  item_count integer not null default 0,
  "totalLinks" integer,
  total_links integer,
  user_id text,
  "userId" text,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);
-- Add Android compatibility columns if evidence_batches was created earlier from the smaller sample schema.
alter table public.evidence_batches add column if not exists operation_id text;
alter table public.evidence_batches add column if not exists batch_id text;
alter table public.evidence_batches add column if not exists "batchId" text;
alter table public.evidence_batches add column if not exists name text;
alter table public.evidence_batches add column if not exists title text;
alter table public.evidence_batches add column if not exists email text;
alter table public.evidence_batches add column if not exists item_count integer not null default 0;
alter table public.evidence_batches alter column user_id drop not null;
alter table public.evidence_batches alter column email drop not null;
alter table public.evidence_batches add column if not exists "totalLinks" integer;
alter table public.evidence_batches add column if not exists total_links integer;
alter table public.evidence_batches add column if not exists user_id text;
alter table public.evidence_batches add column if not exists "userId" text;
alter table public.evidence_batches add column if not exists payload jsonb not null default '{}'::jsonb;

-- The supplied older schema uses text id without a default; the Android app omits id and sends batch_id.
create or replace function public.mf_evidence_batches_compat_before_insert()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare id_type text;
begin
  select data_type into id_type from information_schema.columns
    where table_schema='public' and table_name='evidence_batches' and column_name='id';
  if id_type='text' and (new.id is null or new.id::text='') then
    new.id := coalesce(nullif(new.batch_id,''), nullif(new."batchId",''), gen_random_uuid()::text);
  end if;
  if id_type <> 'text' and new.operation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.id := new.operation_id::uuid;
  end if;
  if new.batch_id is null or new.batch_id='' then
    new.batch_id := coalesce(nullif(new."batchId",''), nullif(new.id::text,''));
  end if;
  if new.title is null or new.title='' then new.title := new.name; end if;
  if new.item_count is null or new.item_count=0 then new.item_count := coalesce(new.total_links, new."totalLinks", 0); end if;
  if new.user_id is null or new.user_id='' then new.user_id := nullif(new."userId",''); end if;
  return new;
end $$;
drop trigger if exists mf_evidence_batches_compat_insert on public.evidence_batches;
create trigger mf_evidence_batches_compat_insert before insert on public.evidence_batches
for each row execute function public.mf_evidence_batches_compat_before_insert();

create index if not exists evidence_batches_batch_id_idx
  on public.evidence_batches(batch_id) where batch_id is not null;

-- Android sends SCREENSHOT_CAPTURED metadata only; image bytes remain local to the device.
create table if not exists public.evidence_screenshots (
  id uuid primary key default gen_random_uuid(),
  operation_id text unique,
  "screenshotId" text,
  screenshot_id text,
  "internalId" text,
  internal_id text,
  "linkId" text,
  link_id text,
  batch_id text,
  "batchId" text,
  user_id text,
  "userId" text,
  platform text,
  "capturedAt" bigint,
  captured_at timestamptz,
  sha256 text,
  "fileSize" bigint,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);
create unique index if not exists evidence_screenshots_screenshot_id_uniq
  on public.evidence_screenshots(screenshot_id) where screenshot_id is not null;

create or replace function public.mf_evidence_screenshots_compat_before_insert()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if coalesce(new."screenshotId", new.screenshot_id) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      new.id := coalesce(new."screenshotId", new.screenshot_id)::uuid;
  elsif new.operation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.id := new.operation_id::uuid;
  end if;
  return new;
end $$;
drop trigger if exists mf_evidence_screenshots_compat_insert on public.evidence_screenshots;
create trigger mf_evidence_screenshots_compat_insert before insert on public.evidence_screenshots
for each row execute function public.mf_evidence_screenshots_compat_before_insert();

-- Android writes export manifests / hashes, not the actual ZIP archive.
create table if not exists public.evidence_exports (
  id uuid primary key default gen_random_uuid(),
  operation_id text unique,
  export_id text unique,
  "exportId" text,
  batch_id text,
  "batchId" text,
  file_name text,
  "fileName" text,
  manifest_sha256 text,
  "manifestSha256" text,
  archive_sha256 text,
  "archiveSha256" text,
  file_size_bytes bigint,
  "fileSize" bigint,
  link_count integer,
  "linkCount" integer,
  screenshot_count integer,
  "screenshotCount" integer,
  created_by_user text,
  "createdByUser" text,
  admin_manageable_only boolean default true,
  encryption_algorithm text,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

-- Other Android outbox events are recorded here, with known payload fields retained.
create or replace function public.mf_evidence_exports_compat_before_insert()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if coalesce(new.export_id, new."exportId") ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.id := coalesce(new.export_id, new."exportId")::uuid;
  elsif new.operation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.id := new.operation_id::uuid;
  end if;
  return new;
end $$;
drop trigger if exists mf_evidence_exports_compat_insert on public.evidence_exports;
create trigger mf_evidence_exports_compat_insert before insert on public.evidence_exports
for each row execute function public.mf_evidence_exports_compat_before_insert();

create table if not exists public.evidence_workflow_events (
  id uuid primary key default gen_random_uuid(),
  operation_id text unique,
  event_type text default 'ANDROID_SYNC_EVENT',
  "eventType" text,
  batch_id text,
  "batchId" text,
  "linkId" text,
  link_id text,
  "screenshotId" text,
  screenshot_id text,
  user_id text,
  "userId" text,
  created_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

create or replace function public.mf_evidence_workflow_events_compat_before_insert()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.operation_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    new.id := new.operation_id::uuid;
  end if;
  return new;
end $$;
drop trigger if exists mf_evidence_workflow_events_compat_insert on public.evidence_workflow_events;
create trigger mf_evidence_workflow_events_compat_insert before insert on public.evidence_workflow_events
for each row execute function public.mf_evidence_workflow_events_compat_before_insert();

create index if not exists evidence_batches_created_at_idx on public.evidence_batches(created_at desc);
create index if not exists evidence_screenshots_created_at_idx on public.evidence_screenshots(created_at desc);
create index if not exists evidence_screenshots_batch_id_idx on public.evidence_screenshots(batch_id);
create index if not exists evidence_exports_created_at_idx on public.evidence_exports(created_at desc);
create index if not exists evidence_exports_batch_id_idx on public.evidence_exports(batch_id);
create index if not exists evidence_workflow_events_created_at_idx on public.evidence_workflow_events(created_at desc);
create index if not exists mfp_android_app_registrations_updated_at_idx on public.mfp_android_app_registrations(updated_at desc);

-- RLS: Android uses the public key and no per-user JWT for direct metadata inserts.
-- Therefore anon is insert-only for sync tables; reads are restricted to active website admins.
-- Unauthenticated insert endpoints can still be abused; the unchanged app cannot provide stronger
-- per-user database identity without changing its request/auth design. Do not grant anon SELECT/UPDATE/DELETE.
alter table public.config enable row level security;
alter table public.evidence_batches enable row level security;
alter table public.evidence_screenshots enable row level security;
alter table public.evidence_exports enable row level security;
alter table public.evidence_workflow_events enable row level security;

grant select on public.app_registrations to anon, authenticated;
grant insert, select, update on public.config to authenticated;
grant select on public.config to anon;
grant insert on public.evidence_batches, public.evidence_screenshots, public.evidence_exports, public.evidence_workflow_events to anon, authenticated;
grant select on public.evidence_batches, public.evidence_screenshots, public.evidence_exports, public.evidence_workflow_events to authenticated;

-- Remove the broad development policies from the sample SQL if they were applied earlier.
drop policy if exists "Allow public read on config" on public.config;
drop policy if exists "Allow public read/write on evidence_batches" on public.evidence_batches;
drop policy if exists "Allow public read/write on evidence_items" on public.evidence_items;

-- Recreate only policies owned by this compatibility migration.
drop policy if exists mf_config_public_read on public.config;
create policy mf_config_public_read on public.config for select to anon, authenticated using (key = 'export_settings');
drop policy if exists mf_config_admin_write on public.config;
create policy mf_config_admin_write on public.config for all to authenticated
  using ((select mfp_private.is_admin())) with check ((select mfp_private.is_admin()));

-- Android metadata writes are public-key only; admin reads are authenticated and role-gated.
drop policy if exists mf_evidence_batches_android_insert on public.evidence_batches;
create policy mf_evidence_batches_android_insert on public.evidence_batches for insert to anon, authenticated with check (true);
drop policy if exists mf_evidence_batches_admin_read on public.evidence_batches;
create policy mf_evidence_batches_admin_read on public.evidence_batches for select to authenticated using ((select mfp_private.is_admin()));

drop policy if exists mf_evidence_screenshots_android_insert on public.evidence_screenshots;
create policy mf_evidence_screenshots_android_insert on public.evidence_screenshots for insert to anon, authenticated with check (true);
drop policy if exists mf_evidence_screenshots_admin_read on public.evidence_screenshots;
create policy mf_evidence_screenshots_admin_read on public.evidence_screenshots for select to authenticated using ((select mfp_private.is_admin()));

drop policy if exists mf_evidence_exports_android_insert on public.evidence_exports;
create policy mf_evidence_exports_android_insert on public.evidence_exports for insert to anon, authenticated with check (true);
drop policy if exists mf_evidence_exports_admin_read on public.evidence_exports;
create policy mf_evidence_exports_admin_read on public.evidence_exports for select to authenticated using ((select mfp_private.is_admin()));

drop policy if exists mf_evidence_events_android_insert on public.evidence_workflow_events;
create policy mf_evidence_events_android_insert on public.evidence_workflow_events for insert to anon, authenticated with check (true);
drop policy if exists mf_evidence_events_admin_read on public.evidence_workflow_events;
create policy mf_evidence_events_admin_read on public.evidence_workflow_events for select to authenticated using ((select mfp_private.is_admin()));

-- Website admin policies use the existing MF MPanel mfp_private.is_admin() authorization helper.
