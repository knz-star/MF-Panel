-- MF MPanel v2.10.0: atomic link assignment, ZIP receipt matching and private checking batches.
create or replace function public.mfp_normalize_link_url(p_url text)
returns text language sql immutable set search_path = pg_catalog, pg_temp as $$
 select regexp_replace(
   replace(replace(regexp_replace(lower(regexp_replace(trim(coalesce(p_url,'')), '#.*$', '')), '/+$', ''), 'https://www.', 'https://'), 'http://www.', 'http://'),
   '/+$','');
$$;

create table if not exists public.mfp_link_assignments (
  id uuid primary key default gen_random_uuid(),
  source_profile_id text not null,
  canonical_url text not null unique,
  platform text not null default 'Other',
  assigned_to uuid not null references auth.users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  status text not null default 'PENDING' check (status in ('PENDING','RECEIVED','REVIEW')),
  report_job_id text,
  received_at timestamptz,
  source_data jsonb not null default '{}'::jsonb
);
create index if not exists mfp_link_assignments_user_status_idx on public.mfp_link_assignments(assigned_to,status,assigned_at desc);
create index if not exists mfp_link_assignments_platform_status_idx on public.mfp_link_assignments(platform,status);
alter table public.mfp_link_assignments enable row level security;
revoke all on public.mfp_link_assignments from anon, authenticated;
grant all on public.mfp_link_assignments to service_role;

create table if not exists public.mfp_checking_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null unique,
  checker_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null default gen_random_uuid(),
  assigned_at timestamptz not null default now(),
  opened_at timestamptz,
  status text not null default 'ASSIGNED' check (status in ('ASSIGNED','OPEN','REOPEN','RECHECK','BLOCKED','INVALID','VERIFIED')),
  outcome_notes text,
  post_urls jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists mfp_checking_assignments_checker_idx on public.mfp_checking_assignments(checker_id,status,assigned_at);
create index if not exists mfp_checking_assignments_status_idx on public.mfp_checking_assignments(status,assigned_at);
alter table public.mfp_checking_assignments enable row level security;
revoke all on public.mfp_checking_assignments from anon, authenticated;
grant all on public.mfp_checking_assignments to service_role;

create table if not exists public.mfp_link_upload_receipts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.mfp_link_assignments(id) on delete restrict,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  report_job_id text,
  matched_url text not null,
  uploaded_at timestamptz not null default now(),
  unique(assignment_id, report_job_id)
);
alter table public.mfp_link_upload_receipts enable row level security;
revoke all on public.mfp_link_upload_receipts from anon, authenticated;
grant all on public.mfp_link_upload_receipts to service_role;

create or replace function public.mfp_available_link_counts()
returns table(platform text, available_count bigint)
language sql security definer set search_path=public,pg_temp as $$
 select coalesce(nullif(trim(d.data->>'platform'),''),'Other') as platform, count(distinct public.mfp_normalize_link_url(d.data->>'canonicalUrl')) as available_count
 from public.mfp_documents d
 where d.collection_name='profiles'
   and nullif(trim(d.data->>'canonicalUrl'),'') is not null
   and coalesce(lower(d.data->>'isTestData'),'false') <> 'true'
   and coalesce(upper(d.data->>'currentWorkflowStatus'),'') not in ('INVALID','BLOCKED','FAILED_BLOCKED','DELETED')
   and not exists (select 1 from public.mfp_link_assignments a where a.canonical_url=public.mfp_normalize_link_url(d.data->>'canonicalUrl'))
 group by 1 order by 1;
$$;

create or replace function public.mfp_available_link_total()
returns bigint language sql security definer set search_path=public,pg_temp as $$
 select count(distinct public.mfp_normalize_link_url(d.data->>'canonicalUrl'))
 from public.mfp_documents d
 where d.collection_name='profiles'
   and nullif(trim(d.data->>'canonicalUrl'),'') is not null
   and coalesce(lower(d.data->>'isTestData'),'false') <> 'true'
   and coalesce(upper(d.data->>'currentWorkflowStatus'),'') not in ('INVALID','BLOCKED','FAILED_BLOCKED','DELETED')
   and not exists (select 1 from public.mfp_link_assignments a where a.canonical_url=public.mfp_normalize_link_url(d.data->>'canonicalUrl'));
$$;

create or replace function public.mfp_claim_link_batch(p_user_id uuid, p_platforms text[], p_limit integer)
returns table(assignment_id uuid, profile_id text, canonical_url text, platform text, assigned_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'service role required'; end if;
 if p_limit < 1 or p_limit > 2000 then raise exception 'Requested link count must be between 1 and 2000'; end if;
 return query
 with candidates as (
  select d.document_id, d.data, coalesce(nullif(trim(d.data->>'platform'),''),'Other') as p,
         public.mfp_normalize_link_url(d.data->>'canonicalUrl') as u
  from public.mfp_documents d
  where d.collection_name='profiles'
    and nullif(trim(d.data->>'canonicalUrl'),'') is not null
    and coalesce(lower(d.data->>'isTestData'),'false') <> 'true'
    and coalesce(upper(d.data->>'currentWorkflowStatus'),'') not in ('INVALID','BLOCKED','FAILED_BLOCKED','DELETED')
    and (coalesce(cardinality(p_platforms),0)=0 or 'ALL'=any(p_platforms) or lower(coalesce(nullif(trim(d.data->>'platform'),''),'Other')) = any (select lower(t.platform_name) from unnest(p_platforms) as t(platform_name)))
    and not exists(select 1 from public.mfp_link_assignments a where a.canonical_url=public.mfp_normalize_link_url(d.data->>'canonicalUrl'))
  order by d.created_at asc
  limit p_limit
  for update of d skip locked
 ), inserted as (
  insert into public.mfp_link_assignments(source_profile_id,canonical_url,platform,assigned_to,source_data)
  select c.document_id,c.u,c.p,p_user_id,c.data from candidates c
  on conflict(canonical_url) do nothing
  returning id,source_profile_id,canonical_url,platform,assigned_at
 ) select i.id,i.source_profile_id,i.canonical_url,i.platform,i.assigned_at from inserted i;
end $$;

create or replace function public.mfp_claim_checking_batch(p_checker_id uuid)
returns table(assignment_id uuid, profile_id text, batch_id uuid, assigned_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_batch_id uuid := gen_random_uuid();
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' then raise exception 'service role required'; end if;
 return query
 with candidates as (
  select d.id,d.document_id,d.data from public.mfp_documents d
  where d.collection_name='profiles' and upper(coalesce(d.data->>'currentWorkflowStatus',''))='QUEUED_CHECKING'
   and nullif(trim(d.data->>'canonicalUrl'),'') is not null
   and coalesce(lower(d.data->>'isTestData'),'false') <> 'true'
   and not exists(select 1 from public.mfp_checking_assignments a where a.profile_id=d.document_id)
  order by coalesce(nullif(d.data->>'queueAssignedAt','')::timestamptz,d.created_at) asc
  limit 10 for update of d skip locked
 ), inserted as (
  insert into public.mfp_checking_assignments(profile_id,checker_id,batch_id)
  select c.document_id,p_checker_id,v_batch_id from candidates c
  on conflict(profile_id) do nothing
  returning id,profile_id,batch_id,assigned_at
 ), updated as (
  update public.mfp_documents d set data=d.data || jsonb_build_object('currentWorkflowStatus','CHECKING_ASSIGNED','assignedCheckerUid',p_checker_id::text,'queueAssignedAt',coalesce(d.data->>'queueAssignedAt',now()::text)), updated_at=now()
  from inserted i where d.collection_name='profiles' and d.document_id=i.profile_id
  returning d.document_id
 ) select i.id,i.profile_id,i.batch_id,i.assigned_at from inserted i;
end $$;
revoke all on function public.mfp_available_link_counts() from public,anon,authenticated;
revoke all on function public.mfp_available_link_total() from public,anon,authenticated;
revoke all on function public.mfp_claim_link_batch(uuid,text[],integer) from public,anon,authenticated;
revoke all on function public.mfp_claim_checking_batch(uuid) from public,anon,authenticated;
grant execute on function public.mfp_available_link_counts() to service_role;
grant execute on function public.mfp_available_link_total() to service_role;
grant execute on function public.mfp_claim_link_batch(uuid,text[],integer) to service_role;
grant execute on function public.mfp_claim_checking_batch(uuid) to service_role;
