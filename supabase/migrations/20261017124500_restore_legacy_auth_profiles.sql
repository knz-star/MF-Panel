-- Compatibility profile table required by the current auth/signup flow.
-- Does not remove or replace mfp_user_profiles.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  country text not null default 'Pakistan',
  whatsapp text not null default '',
  email text not null default '',
  role text not null default 'USER' check (role in ('USER','ADMIN','REVIEWER')),
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE','INACTIVE','SUSPENDED','DISABLED','PENDING')),
  total_processed integer not null default 0 check (total_processed >= 0),
  today_processed integer not null default 0 check (today_processed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_lower_idx on public.profiles(lower(email));
alter table public.profiles enable row level security;
grant select,insert,update on public.profiles to authenticated;
revoke all on public.profiles from anon;
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select to authenticated using (id=(select auth.uid()) or public.is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id=(select auth.uid()));
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

insert into public.profiles(id,full_name,country,whatsapp,email,role,account_status,total_processed,today_processed)
select u.id,coalesce(u.raw_user_meta_data->>'full_name',p.display_name,''),coalesce(u.raw_user_meta_data->>'country','Pakistan'),coalesce(u.raw_user_meta_data->>'whatsapp',''),lower(coalesce(u.email,'')),case when p.role='ADMIN' then 'ADMIN' else 'USER' end,'ACTIVE',0,0
from auth.users u join public.mfp_user_profiles p on p.user_id=u.id
on conflict(id) do update set email=excluded.email,full_name=case when public.profiles.full_name='' then excluded.full_name else public.profiles.full_name end,role=case when excluded.role='ADMIN' then 'ADMIN' else public.profiles.role end,account_status='ACTIVE',updated_at=now();

notify pgrst, 'reload schema';
