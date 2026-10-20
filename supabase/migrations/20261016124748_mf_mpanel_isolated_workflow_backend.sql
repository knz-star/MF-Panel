-- MF MPanel isolated backend. Additive only: does not alter MF Links Panel tables/data.
create schema if not exists mfp_private;
revoke all on schema mfp_private from public, anon;
grant usage on schema mfp_private to authenticated;

create table if not exists public.mfp_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, display_name text not null default 'User',
  role text not null default 'USER' check (role in ('USER','ADMIN','CHECKER','SEARCHER')),
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE','INACTIVE','SUSPENDED','DISABLED','PENDING')),
  team_key text, team_confirmed boolean not null default false,
  allowed_modules text[] not null default '{}', preferences jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mfp_documents (
  id uuid primary key default gen_random_uuid(), collection_name text not null, document_id text not null,
  data jsonb not null default '{}', owner_uid uuid references auth.users(id) on delete set null,
  team_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(collection_name,document_id)
);
alter table public.mfp_user_profiles drop constraint if exists mfp_user_profiles_role_check;
alter table public.mfp_user_profiles add constraint mfp_user_profiles_role_check check (role in ('USER','ADMIN','CHECKER','SEARCHER'));
alter table public.mfp_user_profiles drop constraint if exists mfp_user_profiles_account_status_check;
alter table public.mfp_user_profiles add constraint mfp_user_profiles_account_status_check check (account_status in ('ACTIVE','INACTIVE','SUSPENDED','DISABLED','PENDING'));
create index if not exists mfp_documents_collection_idx on public.mfp_documents(collection_name);
create index if not exists mfp_documents_owner_idx on public.mfp_documents(owner_uid);
create index if not exists mfp_documents_team_idx on public.mfp_documents(team_key);
create index if not exists mfp_documents_data_gin_idx on public.mfp_documents using gin(data);

create table if not exists public.mfp_evidence_pairing_requests (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique, status text not null default 'PENDING' check (status in ('PENDING','CONSUMED','CANCELLED','EXPIRED')),
  device_label text, expires_at timestamptz not null, consumed_at timestamptz,
  registration_id uuid, created_at timestamptz not null default now()
);
create index if not exists mfp_pairing_user_status_idx on public.mfp_evidence_pairing_requests(user_id,status,created_at desc);
create table if not exists public.mfp_evidence_app_registrations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  team_id text, application_id text not null default 'MF_EVIDENCE',
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REVOKED','INACTIVE')),
  activation_status text not null default 'ACTIVE' check (activation_status in ('ACTIVE','INACTIVE')),
  user_verified boolean not null default true, team_authorized boolean not null default false,
  device_label text, linked_at timestamptz not null default now(), last_seen_at timestamptz, revoked_at timestamptz,
  created_at timestamptz not null default now(), unique(user_id,application_id)
);
create table if not exists public.mfp_evidence_connection_events (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  registration_id uuid references public.mfp_evidence_app_registrations(id) on delete set null,
  event_type text not null, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index if not exists mfp_evidence_events_user_idx on public.mfp_evidence_connection_events(user_id,created_at desc);

-- Normalized query tables, maintained by a trigger from the app-facing document store.
create table if not exists public.mfp_profiles (
  record_id text primary key, canonical_url text unique, platform text, workflow_status text not null default 'SEARCHED',
  data jsonb not null default '{}', owner_uid uuid references auth.users(id) on delete set null, team_key text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mfp_posts (
  record_id text primary key, profile_id text, canonical_url text unique, platform text, data jsonb not null default '{}',
  owner_uid uuid references auth.users(id) on delete set null, team_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mfp_checking_records (
  record_id text primary key, profile_id text, outcome text, data jsonb not null default '{}',
  owner_uid uuid references auth.users(id) on delete set null, team_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mfp_workflow_events (
  event_id text primary key, profile_id text, stage text, action text, data jsonb not null default '{}',
  owner_uid uuid references auth.users(id) on delete set null, team_key text, created_at timestamptz not null default now()
);
create table if not exists public.mfp_audit_logs (
  log_id text primary key, action text, data jsonb not null default '{}', owner_uid uuid references auth.users(id) on delete set null,
  team_key text, created_at timestamptz not null default now()
);
create table if not exists public.mfp_reports (
  record_id text primary key, report_type text, status text, data jsonb not null default '{}',
  owner_uid uuid references auth.users(id) on delete set null, team_key text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists mfp_profiles_status_platform_idx on public.mfp_profiles(workflow_status,platform);
create index if not exists mfp_posts_profile_idx on public.mfp_posts(profile_id);
create index if not exists mfp_checking_profile_idx on public.mfp_checking_records(profile_id);
create index if not exists mfp_workflow_profile_created_idx on public.mfp_workflow_events(profile_id,created_at desc);
create index if not exists mfp_profiles_owner_uid_idx on public.mfp_profiles(owner_uid);
create index if not exists mfp_posts_owner_uid_idx on public.mfp_posts(owner_uid);
create index if not exists mfp_checking_owner_uid_idx on public.mfp_checking_records(owner_uid);
create index if not exists mfp_workflow_owner_uid_idx on public.mfp_workflow_events(owner_uid);
create index if not exists mfp_audit_owner_uid_idx on public.mfp_audit_logs(owner_uid);
create index if not exists mfp_reports_owner_uid_idx on public.mfp_reports(owner_uid);
create index if not exists mfp_evidence_events_registration_idx on public.mfp_evidence_connection_events(registration_id);

create or replace function mfp_private.is_admin() returns boolean language sql stable security definer set search_path=public,auth,pg_temp
as $$ select exists(select 1 from public.mfp_user_profiles p where p.user_id=auth.uid() and p.role='ADMIN' and p.account_status='ACTIVE'); $$;
create or replace function mfp_private.current_team() returns text language sql stable security definer set search_path=public,auth,pg_temp
as $$ select p.team_key from public.mfp_user_profiles p where p.user_id=auth.uid() and p.account_status='ACTIVE' and p.team_confirmed=true limit 1; $$;
create or replace function mfp_private.current_role() returns text language sql stable security definer set search_path=public,auth,pg_temp
as $$ select p.role from public.mfp_user_profiles p where p.user_id=auth.uid() and p.account_status='ACTIVE' limit 1; $$;
revoke all on function mfp_private.is_admin() from public,anon;
revoke all on function mfp_private.current_team() from public,anon;
revoke all on function mfp_private.current_role() from public,anon;
grant execute on function mfp_private.is_admin() to authenticated;
grant execute on function mfp_private.current_team() to authenticated;
grant execute on function mfp_private.current_role() to authenticated;

create or replace function public.mfp_protect_user_profile() returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 if auth.uid() is not null and not mfp_private.is_admin() then
  if tg_op='INSERT' then
   if new.user_id<>auth.uid() then raise exception 'Cannot create another user profile'; end if;
   new.role:='USER'; new.account_status:='ACTIVE';
   if new.team_confirmed then
    if new.team_key not in ('searching','checking','reports','evidence') then raise exception 'Invalid team'; end if;
    new.allowed_modules:=array[new.team_key];
   else
    new.team_key:=null; new.allowed_modules:='{}';
   end if;
  else
   if new.user_id<>old.user_id then raise exception 'User id cannot be changed'; end if;
   new.role:=old.role; new.account_status:=old.account_status;
   if old.team_confirmed and (new.team_key is distinct from old.team_key or new.team_confirmed is distinct from old.team_confirmed) then
    new.team_key:=old.team_key; new.team_confirmed:=old.team_confirmed; new.allowed_modules:=old.allowed_modules;
   elsif not old.team_confirmed and new.team_confirmed then
    if new.team_key not in ('searching','checking','reports','evidence') then raise exception 'Invalid team'; end if;
    new.allowed_modules:=array[new.team_key];
   elsif not new.team_confirmed then
    new.team_key:=null; new.allowed_modules:='{}';
   end if;
  end if;
 end if;
 new.updated_at:=now(); return new;
end; $$;
drop trigger if exists mfp_user_profiles_protect on public.mfp_user_profiles;
create trigger mfp_user_profiles_protect before insert or update on public.mfp_user_profiles for each row execute function public.mfp_protect_user_profile();
revoke all on function public.mfp_protect_user_profile() from public,anon,authenticated;

create or replace function public.mfp_handle_new_auth_user() returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
 insert into public.mfp_user_profiles(user_id,email,display_name,role,account_status)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(coalesce(new.email,'user'),'@',1)),'USER','ACTIVE') on conflict(user_id) do nothing;
 return new;
end; $$;
drop trigger if exists mfp_auth_user_created on auth.users;
create trigger mfp_auth_user_created after insert on auth.users for each row execute function public.mfp_handle_new_auth_user();
revoke all on function public.mfp_handle_new_auth_user() from public,anon,authenticated;

create or replace function public.mfp_protect_user_document() returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare prior jsonb;
begin
 if new.collection_name<>'users' or auth.uid() is null or mfp_private.is_admin() then return new; end if;
 if tg_op='INSERT' then
  if new.document_id<>auth.uid()::text then raise exception 'Cannot create another user profile'; end if;
  new.data:=jsonb_set(jsonb_set(coalesce(new.data,'{}'::jsonb),'{role}','"USER"'::jsonb,true),'{accountStatus}','"ACTIVE"'::jsonb,true);
 else
  prior:=old.data;
  new.data:=jsonb_set(jsonb_set(coalesce(new.data,'{}'::jsonb),'{role}',coalesce(prior->'role','"USER"'::jsonb),true),'{accountStatus}',coalesce(prior->'accountStatus','"ACTIVE"'::jsonb),true);
  if coalesce(prior->>'teamConfirmed','false')='true' then
   new.data:=jsonb_set(jsonb_set(new.data,'{team}',coalesce(prior->'team','null'::jsonb),true),'{teamConfirmed}',coalesce(prior->'teamConfirmed','false'::jsonb),true);
   new.data:=jsonb_set(new.data,'{allowedModules}',coalesce(prior->'allowedModules','[]'::jsonb),true);
  end if;
 end if;
 return new;
end; $$;
drop trigger if exists mfp_user_document_protect on public.mfp_documents;
create trigger mfp_user_document_protect before insert or update on public.mfp_documents for each row execute function public.mfp_protect_user_document();
revoke all on function public.mfp_protect_user_document() from public,anon,authenticated;

create or replace function public.mfp_guard_document_identity_and_status() returns trigger language plpgsql security definer set search_path=public,auth,mfp_private,pg_temp as $$
declare admin_ok boolean:=mfp_private.is_admin(); team text:=mfp_private.current_team(); old_status text; new_status text;
begin
 if tg_op='UPDATE' and not admin_ok then
  if new.collection_name is distinct from old.collection_name or new.document_id is distinct from old.document_id or new.owner_uid is distinct from old.owner_uid then raise exception 'Document identity and owner cannot be reassigned'; end if;
  if new.team_key is distinct from old.team_key and not(old.collection_name='users' and old.team_key is null and new.team_key=team) then raise exception 'Document team cannot be reassigned'; end if;
 end if;
 if not admin_ok and new.collection_name='profiles' then
  new_status:=new.data->>'currentWorkflowStatus'; old_status:=case when tg_op='UPDATE' then old.data->>'currentWorkflowStatus' else null end;
  if team='searching' and new_status in ('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED') and new_status is distinct from old_status then raise exception 'Only Checking Team can set a final profile status'; end if;
  if tg_op='INSERT' and new_status in ('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED') then raise exception 'Profiles cannot be created with a final status'; end if;
 end if;
 if not admin_ok and new.collection_name in ('posts','checkingRecords') and team<>'checking' then raise exception 'Checking Team authorization is required for posts/checking records'; end if;
 return new;
end; $$;
drop trigger if exists mfp_guard_document_identity_status on public.mfp_documents;
create trigger mfp_guard_document_identity_status before insert or update on public.mfp_documents for each row execute function public.mfp_guard_document_identity_and_status();
revoke all on function public.mfp_guard_document_identity_and_status() from public,anon,authenticated;
revoke all on function public.mfp_guard_document_identity_and_status() from public,anon,authenticated;

create or replace function mfp_private.sync_workflow_document() returns trigger language plpgsql security definer set search_path=public,mfp_private,pg_temp as $$
declare d jsonb; coll text; rid text; owner_id uuid; team text;
begin
 if tg_op='DELETE' then
  coll:=old.collection_name; rid:=old.document_id;
  if coll='profiles' then delete from public.mfp_profiles where record_id=rid;
  elsif coll='posts' then delete from public.mfp_posts where record_id=rid;
  elsif coll='checkingRecords' then delete from public.mfp_checking_records where record_id=rid;
  elsif coll='workflowEvents' then delete from public.mfp_workflow_events where event_id=rid;
  elsif coll='auditLogs' then delete from public.mfp_audit_logs where log_id=rid;
  elsif coll in ('reportJobs','reportPackages') then delete from public.mfp_reports where record_id=rid; end if;
  return old;
 end if;
 d:=coalesce(new.data,'{}'::jsonb); coll:=new.collection_name; rid:=new.document_id; owner_id:=new.owner_uid; team:=new.team_key;
 if coll='profiles' then
  insert into public.mfp_profiles(record_id,canonical_url,platform,workflow_status,data,owner_uid,team_key,created_at,updated_at)
  values(rid,nullif(d->>'canonicalUrl',''),d->>'platform',coalesce(d->>'currentWorkflowStatus','SEARCHED'),d,owner_id,team,coalesce(nullif(d->>'createdAt','')::timestamptz,now()),now())
  on conflict(record_id) do update set canonical_url=excluded.canonical_url,platform=excluded.platform,workflow_status=excluded.workflow_status,data=excluded.data,owner_uid=excluded.owner_uid,team_key=excluded.team_key,updated_at=now();
 elsif coll='posts' then
  insert into public.mfp_posts(record_id,profile_id,canonical_url,platform,data,owner_uid,team_key,created_at,updated_at)
  values(rid,d->>'profileId',nullif(d->>'canonicalUrl',''),d->>'platform',d,owner_id,team,coalesce(nullif(d->>'createdAt','')::timestamptz,now()),now())
  on conflict(record_id) do update set profile_id=excluded.profile_id,canonical_url=excluded.canonical_url,platform=excluded.platform,data=excluded.data,owner_uid=excluded.owner_uid,team_key=excluded.team_key,updated_at=now();
 elsif coll='checkingRecords' then
  insert into public.mfp_checking_records(record_id,profile_id,outcome,data,owner_uid,team_key,created_at,updated_at)
  values(rid,d->>'profileId',d->>'outcome',d,owner_id,team,coalesce(nullif(d->>'createdAt','')::timestamptz,now()),now())
  on conflict(record_id) do update set profile_id=excluded.profile_id,outcome=excluded.outcome,data=excluded.data,owner_uid=excluded.owner_uid,team_key=excluded.team_key,updated_at=now();
 elsif coll='workflowEvents' then
  insert into public.mfp_workflow_events(event_id,profile_id,stage,action,data,owner_uid,team_key,created_at)
  values(rid,d->>'profileId',d->>'stage',d->>'action',d,owner_id,team,coalesce(nullif(d->>'createdAt','')::timestamptz,now()))
  on conflict(event_id) do update set profile_id=excluded.profile_id,stage=excluded.stage,action=excluded.action,data=excluded.data,owner_uid=excluded.owner_uid,team_key=excluded.team_key;
 elsif coll='auditLogs' then
  insert into public.mfp_audit_logs(log_id,action,data,owner_uid,team_key,created_at)
  values(rid,d->>'action',d,owner_id,team,coalesce(nullif(d->>'createdAt','')::timestamptz,now()))
  on conflict(log_id) do update set action=excluded.action,data=excluded.data,owner_uid=excluded.owner_uid,team_key=excluded.team_key;
 elsif coll in ('reportJobs','reportPackages') then
  insert into public.mfp_reports(record_id,report_type,status,data,owner_uid,team_key,created_at,updated_at)
  values(rid,coll,d->>'status',d,owner_id,team,coalesce(nullif(d->>'createdAt','')::timestamptz,now()),now())
  on conflict(record_id) do update set report_type=excluded.report_type,status=excluded.status,data=excluded.data,owner_uid=excluded.owner_uid,team_key=excluded.team_key,updated_at=now();
 end if;
 return new;
end; $$;
drop trigger if exists mfp_sync_workflow_document on public.mfp_documents;
create trigger mfp_sync_workflow_document after insert or update or delete on public.mfp_documents for each row execute function mfp_private.sync_workflow_document();

create or replace function public.mfp_ensure_profile() returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); u auth.users%rowtype; p public.mfp_user_profiles%rowtype;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 select * into u from auth.users where id=uid; if not found then raise exception 'Authenticated account not found'; end if;
 insert into public.mfp_user_profiles(user_id,email,display_name,role,account_status) values(uid,u.email,coalesce(u.raw_user_meta_data->>'full_name',split_part(coalesce(u.email,'user'),'@',1)),'USER','ACTIVE') on conflict(user_id) do nothing;
 select * into p from public.mfp_user_profiles where user_id=uid;
 return jsonb_build_object('user_id',p.user_id,'email',p.email,'display_name',p.display_name,'role',p.role,'account_status',p.account_status,'team_key',p.team_key,'team_confirmed',p.team_confirmed,'allowed_modules',p.allowed_modules);
end; $$;
revoke all on function public.mfp_ensure_profile() from public,anon;
grant execute on function public.mfp_ensure_profile() to authenticated;

create or replace function public.mfp_assign_team(p_team text) returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); profile_row public.mfp_user_profiles%rowtype; doc_data jsonb;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if p_team not in ('searching','checking','reports','evidence') then raise exception 'Invalid team'; end if;
 select * into profile_row from public.mfp_user_profiles where user_id=uid for update;
 if not found then raise exception 'User profile missing'; end if;
 if profile_row.account_status<>'ACTIVE' then raise exception 'Account is not active'; end if;
 if profile_row.role='ADMIN' then return jsonb_build_object('uid',uid,'email',profile_row.email,'displayName',profile_row.display_name,'role','ADMIN','teamConfirmed',true,'allowedModules',jsonb_build_array('searching','checking','reports','evidence','admin'),'accountStatus',profile_row.account_status); end if;
 if profile_row.team_confirmed and profile_row.team_key is not null then p_team:=profile_row.team_key;
 else update public.mfp_user_profiles set team_key=p_team,team_confirmed=true,allowed_modules=array[p_team],updated_at=now() where user_id=uid returning * into profile_row; end if;
 doc_data:=jsonb_build_object('uid',uid,'email',profile_row.email,'displayName',profile_row.display_name,'role',profile_row.role,'team',profile_row.team_key,'allowedModules',profile_row.allowed_modules,'teamConfirmed',profile_row.team_confirmed,'accountStatus',profile_row.account_status,'updatedAt',now());
 insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key) values('users',uid::text,doc_data,uid,profile_row.team_key)
 on conflict(collection_name,document_id) do update set data=excluded.data,team_key=excluded.team_key,updated_at=now();
 return doc_data;
end; $$;
revoke all on function public.mfp_assign_team(text) from public,anon;
grant execute on function public.mfp_assign_team(text) to authenticated;

create or replace function public.mfp_redeem_evidence_pairing(p_code_hash text,p_user_id uuid,p_device_label text default 'Android device') returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_pairing public.mfp_evidence_pairing_requests%rowtype; v_profile public.mfp_user_profiles%rowtype; v_registration_id uuid;
begin
 select * into v_pairing from public.mfp_evidence_pairing_requests where code_hash=p_code_hash for update;
 if not found or v_pairing.status<>'PENDING' or v_pairing.expires_at<=now() then raise exception 'Pairing code is invalid, expired, or already used'; end if;
 if v_pairing.user_id<>p_user_id then raise exception 'Pairing account mismatch'; end if;
 select * into v_profile from public.mfp_user_profiles where user_id=p_user_id;
 if not found or v_profile.account_status<>'ACTIVE' or not(v_profile.role='ADMIN' or (v_profile.team_key='evidence' and v_profile.team_confirmed)) then raise exception 'Evidence team authorization is required'; end if;
 insert into public.mfp_evidence_app_registrations(user_id,team_id,application_id,status,activation_status,user_verified,team_authorized,device_label,linked_at,last_seen_at,revoked_at)
 values(p_user_id,v_profile.team_key,'MF_EVIDENCE','ACTIVE','ACTIVE',true,true,left(coalesce(p_device_label,'Android device'),120),now(),now(),null)
 on conflict(user_id,application_id) do update set team_id=excluded.team_id,status='ACTIVE',activation_status='ACTIVE',user_verified=true,team_authorized=true,device_label=excluded.device_label,linked_at=now(),last_seen_at=now(),revoked_at=null returning id into v_registration_id;
 update public.mfp_evidence_pairing_requests set status='CONSUMED',consumed_at=now(),registration_id=v_registration_id where id=v_pairing.id;
 insert into public.mfp_evidence_connection_events(user_id,registration_id,event_type,metadata) values(p_user_id,v_registration_id,'LINKED',jsonb_build_object('applicationId','MF_EVIDENCE','deviceLabel',left(coalesce(p_device_label,'Android device'),120)));
 return jsonb_build_object('success',true,'registrationId',v_registration_id,'status','ACTIVE');
end; $$;
revoke all on function public.mfp_redeem_evidence_pairing(text,uuid,text) from public,anon,authenticated;
grant execute on function public.mfp_redeem_evidence_pairing(text,uuid,text) to service_role;
revoke all on function mfp_private.sync_workflow_document() from public,anon,authenticated;

-- RLS for the new MF MPanel-only tables.
alter table public.mfp_user_profiles enable row level security;
alter table public.mfp_documents enable row level security;
alter table public.mfp_evidence_pairing_requests enable row level security;
alter table public.mfp_evidence_app_registrations enable row level security;
alter table public.mfp_evidence_connection_events enable row level security;
drop policy if exists mfp_user_profiles_select on public.mfp_user_profiles;
create policy mfp_user_profiles_select on public.mfp_user_profiles for select to authenticated using(user_id=(select auth.uid()) or (select mfp_private.is_admin()));
drop policy if exists mfp_user_profiles_insert on public.mfp_user_profiles;
create policy mfp_user_profiles_insert on public.mfp_user_profiles for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists mfp_user_profiles_update on public.mfp_user_profiles;
create policy mfp_user_profiles_update on public.mfp_user_profiles for update to authenticated using(user_id=(select auth.uid()) or (select mfp_private.is_admin())) with check(user_id=(select auth.uid()) or (select mfp_private.is_admin()));
drop policy if exists mfp_documents_select on public.mfp_documents;
create policy mfp_documents_select on public.mfp_documents for select to authenticated using((select mfp_private.is_admin()) or owner_uid=(select auth.uid()) or (team_key is not null and team_key=(select mfp_private.current_team())) or collection_name in ('profiles','posts','checkingRecords','workflowEvents','reportJobs','reportPackages','settings','landingAssets','siteSettings'));
drop policy if exists mfp_documents_public_landing_read on public.mfp_documents;
create policy mfp_documents_public_landing_read on public.mfp_documents for select to anon using(collection_name in ('landingAssets','siteSettings'));
drop policy if exists mfp_documents_insert on public.mfp_documents;
create policy mfp_documents_insert on public.mfp_documents for insert to authenticated with check(
 (select mfp_private.is_admin())
 or (collection_name='users' and document_id=(select auth.uid())::text and owner_uid=(select auth.uid()))
 or (collection_name='profiles' and (select mfp_private.current_team())='searching' and team_key='searching' and owner_uid=(select auth.uid()))
 or (collection_name in ('posts','checkingRecords') and (select mfp_private.current_team())='checking' and team_key='checking' and owner_uid=(select auth.uid()))
 or (collection_name in ('workflowEvents','auditLogs') and team_key=(select mfp_private.current_team()) and owner_uid=(select auth.uid()))
 or (collection_name in ('reportJobs','reportPackages') and (select mfp_private.current_team())='reports' and team_key='reports' and owner_uid=(select auth.uid()))
);
drop policy if exists mfp_documents_update on public.mfp_documents;
create policy mfp_documents_update on public.mfp_documents for update to authenticated
using((select mfp_private.is_admin()) or (collection_name='users' and document_id=(select auth.uid())::text and owner_uid=(select auth.uid())) or (collection_name='profiles' and (select mfp_private.current_team()) in ('searching','checking') and team_key='searching') or (collection_name in ('posts','checkingRecords') and (select mfp_private.current_team())='checking' and team_key='checking') or (collection_name in ('reportJobs','reportPackages') and (select mfp_private.current_team())='reports' and team_key='reports'))
with check((select mfp_private.is_admin()) or (collection_name='users' and document_id=(select auth.uid())::text and owner_uid=(select auth.uid())) or (collection_name='profiles' and (select mfp_private.current_team()) in ('searching','checking') and team_key='searching') or (collection_name in ('posts','checkingRecords') and (select mfp_private.current_team())='checking' and team_key='checking') or (collection_name in ('reportJobs','reportPackages') and (select mfp_private.current_team())='reports' and team_key='reports'));
drop policy if exists mfp_documents_delete on public.mfp_documents;
create policy mfp_documents_delete on public.mfp_documents for delete to authenticated using((select mfp_private.is_admin()) or (collection_name='profiles' and (select mfp_private.current_team())='searching' and team_key='searching') or (collection_name in ('posts','checkingRecords') and (select mfp_private.current_team())='checking' and team_key='checking') or (collection_name in ('reportJobs','reportPackages') and (select mfp_private.current_team())='reports' and team_key='reports'));
drop policy if exists mfp_pairing_select on public.mfp_evidence_pairing_requests;
create policy mfp_pairing_select on public.mfp_evidence_pairing_requests for select to authenticated using(user_id=(select auth.uid()) or (select mfp_private.is_admin()));
drop policy if exists mfp_registration_select on public.mfp_evidence_app_registrations;
create policy mfp_registration_select on public.mfp_evidence_app_registrations for select to authenticated using(user_id=(select auth.uid()) or (select mfp_private.is_admin()));
drop policy if exists mfp_events_select on public.mfp_evidence_connection_events;
create policy mfp_events_select on public.mfp_evidence_connection_events for select to authenticated using(user_id=(select auth.uid()) or (select mfp_private.is_admin()));
grant select,insert,update,delete on public.mfp_documents to authenticated;
grant select on public.mfp_documents to anon;
grant select,insert,update on public.mfp_user_profiles to authenticated;
grant select on public.mfp_evidence_pairing_requests,public.mfp_evidence_app_registrations,public.mfp_evidence_connection_events to authenticated;

do $$ declare t text; begin
 foreach t in array array['mfp_profiles','mfp_posts','mfp_checking_records','mfp_workflow_events','mfp_audit_logs','mfp_reports'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists %I on public.%I',t||'_select',t);
  if t='mfp_audit_logs' then execute format('create policy %I on public.%I for select to authenticated using((select mfp_private.is_admin()) or owner_uid=(select auth.uid()) or (team_key is not null and team_key=(select mfp_private.current_team())))',t||'_select',t);
  else execute format('create policy %I on public.%I for select to authenticated using(true)',t||'_select',t); end if;
  execute format('revoke insert,update,delete on public.%I from authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('mfp-assets','mfp-assets',true,5242880,array['image/svg+xml','image/png','image/jpeg','image/webp','image/gif']) on conflict(id) do nothing;
drop policy if exists mfp_assets_public_read on storage.objects;
create policy mfp_assets_public_read on storage.objects for select to anon,authenticated using(bucket_id='mfp-assets');
drop policy if exists mfp_assets_admin_insert on storage.objects;
create policy mfp_assets_admin_insert on storage.objects for insert to authenticated with check(bucket_id='mfp-assets' and (select mfp_private.is_admin()));
drop policy if exists mfp_assets_admin_update on storage.objects;
create policy mfp_assets_admin_update on storage.objects for update to authenticated using(bucket_id='mfp-assets' and (select mfp_private.is_admin())) with check(bucket_id='mfp-assets' and (select mfp_private.is_admin()));
drop policy if exists mfp_assets_admin_delete on storage.objects;
create policy mfp_assets_admin_delete on storage.objects for delete to authenticated using(bucket_id='mfp-assets' and (select mfp_private.is_admin()));

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  begin alter publication supabase_realtime add table public.mfp_documents; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.mfp_evidence_app_registrations; exception when duplicate_object then null; end;
 end if;
end $$;
