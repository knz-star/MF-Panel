-- Separate gender-group leads from functional workspace Team Admin assignments.
-- Gender grouping never grants workflow-module access by itself.
create table if not exists public.mfp_gender_team_admin_assignments (
  gender_group text primary key check (gender_group in ('male','female')),
  admin_user_id uuid not null unique references auth.users(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mfp_gender_team_admin_assignments enable row level security;
revoke all on public.mfp_gender_team_admin_assignments from public, anon, authenticated;
grant all on public.mfp_gender_team_admin_assignments to service_role;

create or replace function mfp_private.current_gender_group()
returns text language sql stable security definer set search_path=public,auth,pg_temp as $$
  select gender_group from public.mfp_user_profiles
  where user_id = auth.uid() and account_status = 'ACTIVE' and team_confirmed = true
  limit 1;
$$;
revoke all on function mfp_private.current_gender_group() from public, anon;
grant execute on function mfp_private.current_gender_group() to authenticated;

-- The documents SELECT policy that honours sharedGenderGroups is installed by 20261020133000 (team-scoped).
notify pgrst, 'reload schema';
