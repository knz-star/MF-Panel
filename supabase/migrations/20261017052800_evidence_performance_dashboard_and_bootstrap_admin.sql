-- Additive MF Evidence analytics and exact-email admin bootstrap. No existing rows are deleted.
create table if not exists public.mfp_evidence_work_items (
  id uuid primary key default gen_random_uuid(),
  link_id text not null unique,
  profile_id text,
  url text not null,
  platform text not null default 'Other',
  batch_id text,
  assigned_to uuid references auth.users(id) on delete set null,
  last_assigned_to uuid references auth.users(id) on delete set null,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE','ASSIGNED','PENDING','COMPLETED')),
  assigned_at timestamptz,
  completed_at timestamptz,
  returned_at timestamptz,
  last_activity_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mfp_evidence_work_items_assignee_status_idx on public.mfp_evidence_work_items (assigned_to, status, assigned_at desc);
create index if not exists mfp_evidence_work_items_platform_status_idx on public.mfp_evidence_work_items (platform, status);
alter table public.mfp_evidence_work_items enable row level security;

create table if not exists public.mfp_evidence_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  link_id text,
  event_type text not null check (event_type in ('ASSIGNED','OPENED','PENDING','COMPLETED','FAILED','RETURNED','AUTO_RETURNED_LOW_SCORE','ACCESS_REVOKED')),
  platform text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists mfp_evidence_activity_events_user_time_idx on public.mfp_evidence_activity_events (user_id, created_at desc);
create index if not exists mfp_evidence_activity_events_type_time_idx on public.mfp_evidence_activity_events (event_type, created_at desc);
alter table public.mfp_evidence_activity_events enable row level security;

create table if not exists public.mfp_evidence_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_key text not null default '30d',
  score numeric(5,2),
  assigned_count integer not null default 0,
  completed_count integer not null default 0,
  failed_count integer not null default 0,
  pending_count integer not null default 0,
  auto_action text,
  created_at timestamptz not null default now()
);
create index if not exists mfp_evidence_score_snapshots_user_time_idx on public.mfp_evidence_score_snapshots (user_id, created_at desc);
alter table public.mfp_evidence_score_snapshots enable row level security;

-- Exact, verified bootstrap email only. Existing ADMIN role is preserved; no other account can self-promote.
create or replace function public.mfp_ensure_profile()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  uid uuid := auth.uid();
  u auth.users%rowtype;
  p public.mfp_user_profiles%rowtype;
  bootstrap_admin boolean := false;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into u from auth.users where id=uid;
  if not found then raise exception 'Authenticated account not found'; end if;
  bootstrap_admin := lower(coalesce(u.email,'')) = 'knzbro602@gmail.com' and u.email_confirmed_at is not null;
  insert into public.mfp_user_profiles(user_id,email,display_name,role,account_status)
  values(uid,u.email,coalesce(u.raw_user_meta_data->>'full_name',split_part(coalesce(u.email,'user'),'@',1)),case when bootstrap_admin then 'ADMIN' else 'USER' end,'ACTIVE')
  on conflict(user_id) do update set email=excluded.email, role=case when bootstrap_admin then 'ADMIN' else public.mfp_user_profiles.role end, updated_at=now();
  select * into p from public.mfp_user_profiles where user_id=uid;
  return jsonb_build_object('user_id',p.user_id,'email',p.email,'display_name',p.display_name,'role',p.role,'account_status',p.account_status,'team_key',p.team_key,'team_confirmed',p.team_confirmed,'allowed_modules',p.allowed_modules);
end;
$function$;
