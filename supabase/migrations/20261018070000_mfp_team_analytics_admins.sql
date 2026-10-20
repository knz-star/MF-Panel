-- MF MPanel team analytics and team-admin assignments.
-- Applied to the live project on 2026-10-18; kept here for reproducibility.
create table if not exists public.mfp_team_admin_assignments (
  team_key text primary key check (team_key in ('searching','checking','evidence')),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.mfp_team_score_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  team_key text not null check (team_key in ('searching','checking','evidence')),
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW','KEPT_ACTIVE','DISABLED','CLEARED')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, team_key, status)
);
alter table public.mfp_team_admin_assignments enable row level security;
alter table public.mfp_team_score_warnings enable row level security;
-- Intentionally no client policies. Read/write access is through the authenticated Edge Function only.
revoke all on public.mfp_team_admin_assignments from anon, authenticated;
revoke all on public.mfp_team_score_warnings from anon, authenticated;
grant all on public.mfp_team_admin_assignments to service_role;
grant all on public.mfp_team_score_warnings to service_role;
-- Team leads are a distinct restricted role; only the senior ADMIN retains global access.
alter table public.mfp_user_profiles drop constraint if exists mfp_user_profiles_role_check;
alter table public.mfp_user_profiles add constraint mfp_user_profiles_role_check check (role = any (array['USER','ADMIN','TEAM_ADMIN','CHECKER','SEARCHER']::text[]));
alter table public.mfp_team_admin_assignments add column if not exists previous_role text not null default 'ADMIN' check (previous_role in ('ADMIN','TEAM_ADMIN'));
create table if not exists public.mfp_team_trend_alerts (
  id uuid primary key default gen_random_uuid(),
  team_key text not null check (team_key in ('searching','checking','evidence')),
  alert_date date not null default current_date,
  recent_scores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(team_key, alert_date)
);
alter table public.mfp_team_trend_alerts enable row level security;
revoke all on public.mfp_team_trend_alerts from anon, authenticated;
grant all on public.mfp_team_trend_alerts to service_role;

notify pgrst, 'reload schema';
