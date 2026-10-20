-- Additive recovery migration. No existing rows are deleted.
create table if not exists public.mfp_evidence_work_items (
  id uuid primary key default gen_random_uuid(), link_id text not null unique,
  profile_id text, url text not null, platform text not null default 'Other', batch_id text,
  assigned_to uuid references auth.users(id) on delete set null,
  last_assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'AVAILABLE' check(status in ('AVAILABLE','ASSIGNED','PENDING','COMPLETED')),
  assigned_at timestamptz, completed_at timestamptz, returned_at timestamptz, last_activity_at timestamptz,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists mfp_evidence_work_items_assignee_status_idx on public.mfp_evidence_work_items(assigned_to,status,assigned_at desc);
create index if not exists mfp_evidence_work_items_platform_status_idx on public.mfp_evidence_work_items(platform,status);
alter table public.mfp_evidence_work_items enable row level security;
create table if not exists public.mfp_evidence_activity_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  link_id text, event_type text not null check(event_type in ('ASSIGNED','OPENED','PENDING','COMPLETED','FAILED','RETURNED','AUTO_RETURNED_LOW_SCORE','ACCESS_REVOKED')),
  platform text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists mfp_evidence_activity_events_user_time_idx on public.mfp_evidence_activity_events(user_id,created_at desc);
create index if not exists mfp_evidence_activity_events_type_time_idx on public.mfp_evidence_activity_events(event_type,created_at desc);
alter table public.mfp_evidence_activity_events enable row level security;
create table if not exists public.mfp_evidence_score_snapshots (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null default '30d', score numeric(5,2), assigned_count integer not null default 0,
  completed_count integer not null default 0, failed_count integer not null default 0, pending_count integer not null default 0,
  auto_action text, created_at timestamptz not null default now()
);
create index if not exists mfp_evidence_score_snapshots_user_time_idx on public.mfp_evidence_score_snapshots(user_id,created_at desc);
alter table public.mfp_evidence_score_snapshots enable row level security;
revoke all on public.mfp_evidence_work_items, public.mfp_evidence_activity_events, public.mfp_evidence_score_snapshots from anon;
grant select,insert,update,delete on public.mfp_evidence_work_items, public.mfp_evidence_activity_events, public.mfp_evidence_score_snapshots to authenticated;
notify pgrst, 'reload schema';
