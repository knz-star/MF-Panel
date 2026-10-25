-- MF MPanel v2.16.1 safe additive backend fixes.
-- IMPORTANT: This migration intentionally does NOT replace public.mfp_web_api.
-- Existing production-only dispatcher actions and data are preserved.

create table if not exists public.mfp_link_timeline_events (
  id uuid primary key default gen_random_uuid(), collection_name text not null,
  document_id text not null, canonical_url text, stage text not null, action text not null,
  previous_status text, new_status text, actor_uid uuid,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists mfp_link_timeline_events_doc_time_idx on public.mfp_link_timeline_events(collection_name,document_id,created_at);
create index if not exists mfp_link_timeline_events_url_idx on public.mfp_link_timeline_events(canonical_url);
create index if not exists mfp_documents_normalized_url_idx on public.mfp_documents (lower(public.mfp_normalize_link_url(coalesce(data->>'canonicalUrl',data->>'originalUrl',data->>'url','')))) where collection_name in ('profiles','posts');
create table if not exists public.mfp_team_contact_settings (
  team_key text primary key check(team_key in ('searching','checking','reports','evidence')),
  whatsapp_number text not null default '', updated_by uuid, updated_at timestamptz not null default now()
);
alter table public.mfp_link_timeline_events enable row level security;
alter table public.mfp_team_contact_settings enable row level security;

create or replace function public.mfp_capture_document_status_event()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare old_status text; new_status text; url text;
begin
  if new.collection_name not in ('profiles','posts') then return new; end if;
  old_status:=coalesce(old.data->>'currentWorkflowStatus','SEARCHED');
  new_status:=coalesce(new.data->>'currentWorkflowStatus',old_status);
  if old_status is distinct from new_status then
    url:=coalesce(new.data->>'canonicalUrl',new.data->>'originalUrl',new.data->>'url');
    insert into public.mfp_link_timeline_events(collection_name,document_id,canonical_url,stage,action,previous_status,new_status,actor_uid,metadata)
    values(new.collection_name,new.document_id,url,
      case when new_status in ('QUEUED_CHECKING','CHECKING','CHECKING_ASSIGNED','OPEN','REOPEN','RECHECK','VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED') then 'CHECKING'
           when new_status ilike '%EVIDENCE%' then 'EVIDENCE' when new_status ilike '%REPORT%' then 'REPORTS' else 'WORKFLOW' end,
      'STATUS_CHANGED',old_status,new_status,auth.uid(),jsonb_build_object('platform',new.data->>'platform','notes',coalesce(new.data->>'checkingNotes',new.data->>'notes','')));
  end if;
  return new;
end; $$;
drop trigger if exists mfp_documents_capture_status_event on public.mfp_documents;
create trigger mfp_documents_capture_status_event after update of data on public.mfp_documents
for each row when(old.data->>'currentWorkflowStatus' is distinct from new.data->>'currentWorkflowStatus')
execute function public.mfp_capture_document_status_event();

create or replace function public.mfp_admin_dashboard_metrics(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); p public.mfp_user_profiles%rowtype; v_days integer:=greatest(1,least(coalesce(p_days,7),31)); result jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into p from public.mfp_user_profiles where user_id=uid;
  if not found or p.account_status<>'ACTIVE' or p.role<>'ADMIN' then raise exception 'Senior administrator access required'; end if;
  with dates as(select g.gs::date as metric_date from generate_series(current_date-(v_days-1),current_date,interval '1 day') as g(gs)),
  searching as(select d.created_at::date as metric_date,count(*) filter(where d.collection_name='profiles')::int as profile_count,count(*) filter(where d.collection_name='posts')::int as post_count,count(distinct d.owner_uid)::int as user_count
    from public.mfp_documents d where d.collection_name in('profiles','posts') and d.team_key='searching' and coalesce(lower(d.data->>'isTestData'),'false')<>'true' and d.created_at>=current_date-(v_days-1) and d.created_at<current_date+interval '1 day' group by d.created_at::date),
  checking_assigned as(select ca.assigned_at::date as metric_date,count(*)::int as assigned_count from public.mfp_checking_assignments ca where ca.assigned_at>=current_date-(v_days-1) and ca.assigned_at<current_date+interval '1 day' group by ca.assigned_at::date),
  checking_done as(select coalesce(ca.completed_at,ca.updated_at,ca.assigned_at)::date as metric_date,count(*)::int as checked_count,count(*) filter(where upper(ca.status)='VERIFIED')::int as verified_count,count(*) filter(where upper(ca.status) in('INVALID','BLOCKED','FAILED_BLOCKED'))::int as failed_count
    from public.mfp_checking_assignments ca where upper(ca.status) in('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED') and coalesce(ca.completed_at,ca.updated_at,ca.assigned_at)>=current_date-(v_days-1) and coalesce(ca.completed_at,ca.updated_at,ca.assigned_at)<current_date+interval '1 day' group by coalesce(ca.completed_at,ca.updated_at,ca.assigned_at)::date),
  evidence_assigned as(select wi.assigned_at::date as metric_date,coalesce(nullif(wi.link_id,''),wi.id::text) as item_key from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to and up.team_key='evidence' where wi.assigned_at>=current_date-(v_days-1) and wi.assigned_at<current_date+interval '1 day'
    union select la.assigned_at::date,coalesce(nullif(la.canonical_url,''),la.id::text) from public.mfp_link_assignments la join public.mfp_user_profiles up on up.user_id=la.assigned_to and up.team_key='evidence' where la.assigned_at>=current_date-(v_days-1) and la.assigned_at<current_date+interval '1 day'),
  evidence_completed as(select wi.completed_at::date as metric_date,coalesce(nullif(wi.link_id,''),wi.id::text) as item_key from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to and up.team_key='evidence' where wi.completed_at is not null and wi.completed_at>=current_date-(v_days-1) and wi.completed_at<current_date+interval '1 day' and upper(wi.status) in('COMPLETED','VERIFIED') union select r.uploaded_at::date,coalesce(nullif(la.canonical_url,''),la.id::text) from public.mfp_link_upload_receipts r join public.mfp_link_assignments la on la.id=r.assignment_id join public.mfp_user_profiles up on up.user_id=la.assigned_to and up.team_key='evidence' where r.uploaded_at>=current_date-(v_days-1) and r.uploaded_at<current_date+interval '1 day')
  select jsonb_build_object('generatedAt',now(),'days',v_days,'totals',jsonb_build_object(
    'profiles',(select count(*) from public.mfp_documents where collection_name='profiles' and coalesce(lower(data->>'isTestData'),'false')<>'true'),
    'posts',(select count(*) from public.mfp_documents where collection_name='posts' and coalesce(lower(data->>'isTestData'),'false')<>'true'),
    'totalLinks',(select count(*) from public.mfp_documents where collection_name in('profiles','posts') and coalesce(lower(data->>'isTestData'),'false')<>'true'),
    'activeUsers',(select count(*) from public.mfp_user_profiles where account_status='ACTIVE'),
    'checkingAssigned',(select count(*) from public.mfp_checking_assignments),
    'checkingChecked',(select count(*) from public.mfp_checking_assignments where upper(status) in('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED')),
    'checkingVerified',(select count(*) from public.mfp_checking_assignments where upper(status)='VERIFIED'),
    'checkingFailed',(select count(*) from public.mfp_checking_assignments where upper(status) in('INVALID','BLOCKED','FAILED_BLOCKED')),
    'evidenceAssigned',(select count(*) from (select coalesce(nullif(wi.url,''),nullif(wi.link_id,''),wi.id::text) as item_key from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to and up.team_key='evidence' union select coalesce(nullif(la.canonical_url,''),la.id::text) from public.mfp_link_assignments la join public.mfp_user_profiles up on up.user_id=la.assigned_to and up.team_key='evidence') evidence_items),
    'evidenceCompleted',(select count(distinct r.assignment_id) from public.mfp_link_upload_receipts r join public.mfp_link_assignments la on la.id=r.assignment_id join public.mfp_user_profiles up on up.user_id=la.assigned_to and up.team_key='evidence'),'reportsCountedSeparately',false),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',to_char(d.metric_date,'YYYY-MM-DD'),'searchingProfiles',coalesce(s.profile_count,0),'searchingPosts',coalesce(s.post_count,0),'searchingTotal',coalesce(s.profile_count,0)+coalesce(s.post_count,0),'searchingUsers',coalesce(s.user_count,0),'checkingAssigned',coalesce(ca.assigned_count,0),'checkingChecked',coalesce(cd.checked_count,0),'checkingVerified',coalesce(cd.verified_count,0),'checkingFailed',coalesce(cd.failed_count,0),'evidenceAssigned',(select count(distinct ea.item_key) from evidence_assigned ea where ea.metric_date=d.metric_date),'evidenceCompleted',(select count(distinct ec.item_key) from evidence_completed ec where ec.metric_date=d.metric_date),'reportsCountedSeparately',false) order by d.metric_date) from dates d left join searching s on s.metric_date=d.metric_date left join checking_assigned ca on ca.metric_date=d.metric_date left join checking_done cd on cd.metric_date=d.metric_date),'[]'::jsonb)) into result;
  return result;
end; $$;
revoke all on function public.mfp_admin_dashboard_metrics(integer) from public,anon;
grant execute on function public.mfp_admin_dashboard_metrics(integer) to authenticated;

create or replace function public.mfp_team_operational_metrics(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); p public.mfp_user_profiles%rowtype; v_team text; v_days integer:=greatest(1,least(coalesce(p_days,7),31)); result jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into p from public.mfp_user_profiles where user_id=uid;
  if not found or p.account_status<>'ACTIVE' then raise exception 'Active MF MPanel account required'; end if;
  if p.role='ADMIN' then return public.mfp_admin_dashboard_metrics(v_days); end if;
  v_team:=coalesce(p.team_key,'');
  if v_team='reports' then v_team:='evidence'; end if;
  if v_team not in('searching','checking','reports','evidence') or not p.team_confirmed then raise exception 'An active assigned team is required'; end if;
  with dates as(select g.gs::date as metric_date from generate_series(current_date-(v_days-1),current_date,interval '1 day') as g(gs)),
  searching as(select d.created_at::date as metric_date,count(*) filter(where d.collection_name='profiles')::int as profile_count,count(*) filter(where d.collection_name='posts')::int as post_count,count(distinct d.owner_uid)::int as user_count from public.mfp_documents d where v_team='searching' and d.collection_name in('profiles','posts') and d.team_key='searching' and coalesce(lower(d.data->>'isTestData'),'false')<>'true' and d.created_at>=current_date-(v_days-1) and d.created_at<current_date+interval '1 day' group by d.created_at::date),
  checking_assigned as(select ca.assigned_at::date as metric_date,count(*)::int as assigned_count from public.mfp_checking_assignments ca where v_team='checking' and ca.assigned_at>=current_date-(v_days-1) and ca.assigned_at<current_date+interval '1 day' group by ca.assigned_at::date),
  checking_done as(select coalesce(ca.completed_at,ca.updated_at,ca.assigned_at)::date as metric_date,count(*)::int as checked_count,count(*) filter(where upper(ca.status)='VERIFIED')::int as verified_count,count(*) filter(where upper(ca.status) in('INVALID','BLOCKED','FAILED_BLOCKED'))::int as failed_count from public.mfp_checking_assignments ca where v_team='checking' and upper(ca.status) in('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED') and coalesce(ca.completed_at,ca.updated_at,ca.assigned_at)>=current_date-(v_days-1) and coalesce(ca.completed_at,ca.updated_at,ca.assigned_at)<current_date+interval '1 day' group by coalesce(ca.completed_at,ca.updated_at,ca.assigned_at)::date),
  evidence_assigned as(select wi.assigned_at::date as metric_date,coalesce(nullif(wi.link_id,''),wi.id::text) as item_key from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to and up.team_key='evidence' where v_team='evidence' and wi.assigned_at>=current_date-(v_days-1) and wi.assigned_at<current_date+interval '1 day' union select la.assigned_at::date,coalesce(nullif(la.canonical_url,''),la.id::text) from public.mfp_link_assignments la join public.mfp_user_profiles up on up.user_id=la.assigned_to and up.team_key='evidence' where v_team='evidence' and la.assigned_at>=current_date-(v_days-1) and la.assigned_at<current_date+interval '1 day'),
  evidence_completed as(select wi.completed_at::date as metric_date,coalesce(nullif(wi.link_id,''),wi.id::text) as item_key from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to and up.team_key='evidence' where v_team='evidence' and wi.completed_at is not null and upper(wi.status) in('COMPLETED','VERIFIED') and wi.completed_at>=current_date-(v_days-1) and wi.completed_at<current_date+interval '1 day' union select r.uploaded_at::date,coalesce(nullif(la.canonical_url,''),la.id::text) from public.mfp_link_upload_receipts r join public.mfp_link_assignments la on la.id=r.assignment_id join public.mfp_user_profiles up on up.user_id=la.assigned_to and up.team_key='evidence' where v_team='evidence' and r.uploaded_at>=current_date-(v_days-1) and r.uploaded_at<current_date+interval '1 day')
  select jsonb_build_object('generatedAt',now(),'days',v_days,'team',v_team,'totals',jsonb_build_object(
    'profiles',case when v_team='searching' then (select count(*) from public.mfp_documents where collection_name='profiles' and team_key='searching' and coalesce(lower(data->>'isTestData'),'false')<>'true') else 0 end,
    'posts',case when v_team='searching' then (select count(*) from public.mfp_documents where collection_name='posts' and team_key='searching' and coalesce(lower(data->>'isTestData'),'false')<>'true') else 0 end,
    'totalLinks',case when v_team='searching' then (select count(*) from public.mfp_documents where collection_name in('profiles','posts') and team_key='searching' and coalesce(lower(data->>'isTestData'),'false')<>'true') else 0 end,
    'activeUsers',(select count(*) from public.mfp_user_profiles where team_key=v_team and account_status='ACTIVE'),
    'checkingAssigned',case when v_team='checking' then (select count(*) from public.mfp_checking_assignments ca where true) else 0 end,
    'checkingChecked',case when v_team='checking' then (select count(*) from public.mfp_checking_assignments ca where upper(ca.status) in('VERIFIED','INVALID','BLOCKED','FAILED_BLOCKED')) else 0 end,
    'checkingVerified',case when v_team='checking' then (select count(*) from public.mfp_checking_assignments ca where upper(ca.status)='VERIFIED') else 0 end,
    'checkingFailed',case when v_team='checking' then (select count(*) from public.mfp_checking_assignments ca where upper(ca.status) in('INVALID','BLOCKED','FAILED_BLOCKED')) else 0 end,
    'evidenceAssigned',case when v_team='evidence' then (select count(*) from (select coalesce(nullif(wi.url,''),nullif(wi.link_id,''),wi.id::text) as item_key from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to and up.team_key='evidence' union select coalesce(nullif(la.canonical_url,''),la.id::text) from public.mfp_link_assignments la join public.mfp_user_profiles up on up.user_id=la.assigned_to and up.team_key='evidence') evidence_items) else 0 end,
    'evidenceCompleted',case when v_team='evidence' then (select count(distinct r.assignment_id) from public.mfp_link_upload_receipts r join public.mfp_link_assignments la on la.id=r.assignment_id join public.mfp_user_profiles up on up.user_id=la.assigned_to and up.team_key='evidence') else 0 end,'reportsCountedSeparately',false),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',to_char(d.metric_date,'YYYY-MM-DD'),'searchingProfiles',coalesce(s.profile_count,0),'searchingPosts',coalesce(s.post_count,0),'searchingTotal',coalesce(s.profile_count,0)+coalesce(s.post_count,0),'searchingUsers',coalesce(s.user_count,0),'checkingAssigned',coalesce(ca.assigned_count,0),'checkingChecked',coalesce(cd.checked_count,0),'checkingVerified',coalesce(cd.verified_count,0),'checkingFailed',coalesce(cd.failed_count,0),'evidenceAssigned',(select count(distinct ea.item_key) from evidence_assigned ea where ea.metric_date=d.metric_date),'evidenceCompleted',(select count(distinct ec.item_key) from evidence_completed ec where ec.metric_date=d.metric_date),'reportsCountedSeparately',false) order by d.metric_date) from dates d left join searching s on s.metric_date=d.metric_date left join checking_assigned ca on ca.metric_date=d.metric_date left join checking_done cd on cd.metric_date=d.metric_date),'[]'::jsonb)) into result;
  return result;
end; $$;
revoke all on function public.mfp_team_operational_metrics(integer) from public,anon;
grant execute on function public.mfp_team_operational_metrics(integer) to authenticated;

create or replace function public.mfp_global_tracker_lookup(p_query text,p_public boolean default false)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); p public.mfp_user_profiles%rowtype; q text:=lower(trim(coalesce(p_query,''))); result jsonb; public_mode boolean:=coalesce(p_public,false);
begin
  if length(q)<4 then raise exception 'Enter at least 4 characters of a URL or link ID'; end if;
  if public_mode and length(q)<5 then raise exception 'Enter at least 5 characters for public tracking'; end if;
  if not public_mode then if uid is null then raise exception 'Authentication required'; end if; select * into p from public.mfp_user_profiles where user_id=uid; if not found or p.account_status<>'ACTIVE' or p.role not in('ADMIN','TEAM_ADMIN') then raise exception 'Authorized admin access required'; end if; end if;
  with matched as(select d.* from public.mfp_documents d where d.collection_name in('profiles','posts') and (
    lower(d.document_id)=q or lower(coalesce(d.data->>'mfpProfileId',''))=q or lower(coalesce(d.data->>'mfpPostId',''))=q or lower(coalesce(d.data->>'profileId',''))=q or lower(coalesce(d.data->>'canonicalUrl',d.data->>'originalUrl',d.data->>'url',''))=q
    or (not public_mode and lower(coalesce(d.data->>'canonicalUrl',d.data->>'originalUrl',d.data->>'url','')) like '%'||q||'%') or coalesce(d.data->'srcReferences','[]'::jsonb) ? q)
    and (public_mode or p.role='ADMIN' or d.team_key=p.team_key) order by case when lower(d.document_id)=q then 0 when lower(coalesce(d.data->>'mfpProfileId',d.data->>'mfpPostId',''))=q then 1 else 2 end,d.created_at desc limit 20)
  select jsonb_build_object('query',p_query,'generatedAt',now(),'public',public_mode,'records',coalesce(jsonb_agg(jsonb_build_object('kind',case when m.collection_name='posts' then 'post' else 'profile' end,'id',m.document_id,'publicId',coalesce(m.data->>'mfpProfileId',m.data->>'mfpPostId',m.data->>'profileId',m.document_id),'profileId',coalesce(m.data->>'mfpProfileId',m.data->>'profileId',case when m.collection_name='profiles' then m.document_id end),'url',coalesce(m.data->>'canonicalUrl',m.data->>'originalUrl',m.data->>'url',''),'platform',coalesce(m.data->>'platform','UNKNOWN'),'status',coalesce(m.data->>'currentWorkflowStatus',m.data->>'outcome','SEARCHED'),'createdAt',m.created_at,'updatedAt',m.updated_at,
    'timeline',coalesce((select jsonb_agg(jsonb_build_object('stage',ev.stage,'action',ev.action,'previousStatus',ev.previous_status,'newStatus',ev.new_status,'createdAt',ev.created_at,'actor',case when public_mode or p.role<>'ADMIN' then null else coalesce(up.display_name,up.email,ev.actor_uid::text) end,'metadata',case when public_mode or p.role<>'ADMIN' then '{}'::jsonb else ev.metadata end) order by ev.created_at) from (
      select 'SEARCHING'::text stage,'Link registered'::text action,null::text previous_status,coalesce(m.data->>'currentWorkflowStatus','SEARCHED') new_status,m.created_at created_at,m.owner_uid actor_uid,jsonb_build_object('platform',m.data->>'platform') metadata
      union all select te.stage,te.action,te.previous_status,te.new_status,te.created_at,te.actor_uid,te.metadata from public.mfp_link_timeline_events te where te.collection_name=m.collection_name and te.document_id=m.document_id
      union all select 'CHECKING','Checking '||upper(ca.status),null,ca.status,coalesce(ca.completed_at,ca.updated_at,ca.assigned_at),ca.checker_id,jsonb_build_object('notes',ca.outcome_notes) from public.mfp_checking_assignments ca where ca.profile_id=m.document_id or ca.profile_id=coalesce(m.data->>'mfpProfileId',m.document_id)
      union all select case when la.status='RECEIVED' then 'REPORTS' else 'EVIDENCE' end,case when la.status='RECEIVED' then 'Report ZIP received' else 'Link assigned to Evidence' end,null,la.status,coalesce(la.received_at,la.assigned_at),la.assigned_to,jsonb_build_object('batchId',la.report_job_id,'linkId',la.id) from public.mfp_link_assignments la where la.source_profile_id=m.document_id or lower(la.canonical_url)=lower(coalesce(m.data->>'canonicalUrl',''))
      union all select 'EVIDENCE','Evidence '||upper(wi.status),null,wi.status,coalesce(wi.completed_at,wi.last_activity_at,wi.assigned_at,wi.created_at),wi.assigned_to,jsonb_build_object('batchId',wi.batch_id,'linkId',wi.link_id) from public.mfp_evidence_work_items wi where wi.profile_id=m.document_id or wi.profile_id=coalesce(m.data->>'mfpProfileId',m.document_id) or lower(wi.url)=lower(coalesce(m.data->>'canonicalUrl',''))
    ) ev left join public.mfp_user_profiles up on up.user_id=ev.actor_uid),'[]'::jsonb)) order by m.created_at desc),'[]'::jsonb)) into result from matched m;
  return result;
end; $$;
revoke all on function public.mfp_global_tracker_lookup(text,boolean) from public;
grant execute on function public.mfp_global_tracker_lookup(text,boolean) to authenticated,anon;

create or replace function public.mfp_team_whatsapp(p_action text,p_team text default null,p_whatsapp_number text default null)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); p public.mfp_user_profiles%rowtype; team text:=coalesce(p_team,''); number text:=regexp_replace(coalesce(p_whatsapp_number,''),'[^0-9+]','','g'); admin_ok boolean:=false; result jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if; select * into p from public.mfp_user_profiles where user_id=uid;
  if not found or p.account_status<>'ACTIVE' then raise exception 'Active account required'; end if; admin_ok:=p.role='ADMIN';
  if team not in('searching','checking','reports','evidence') then team:=coalesce(nullif(p.team_key,''),''); end if;
  if not (p_action='read' and admin_ok and team='') and team not in('searching','checking','reports','evidence') then raise exception 'Valid team is required'; end if;
  if not admin_ok and not exists(select 1 from public.mfp_team_admin_assignments ta where ta.team_key=team and ta.admin_user_id=uid) and p.team_key<>team then raise exception 'You can manage only your assigned team'; end if;
  if p_action='read' then
    if admin_ok then select coalesce(jsonb_agg(jsonb_build_object('team_key',t.team_key,'whatsapp_number',coalesce(s.whatsapp_number,''),'updated_at',s.updated_at)),'[]'::jsonb) into result from unnest(array['searching','checking','reports','evidence']::text[]) t(team_key) left join public.mfp_team_contact_settings s on s.team_key=t.team_key; return result; end if;
    select jsonb_build_object('team_key',team,'whatsapp_number',coalesce(s.whatsapp_number,''),'updated_at',s.updated_at) into result from (select team_key,whatsapp_number,updated_at from public.mfp_team_contact_settings where team_key=team) s; return coalesce(result,jsonb_build_object('team_key',team,'whatsapp_number',''));
  elsif p_action='write' then
    if not admin_ok and (p.role<>'TEAM_ADMIN' or p.team_key<>team) then raise exception 'Assigned Team Admin access required to change WhatsApp number'; end if;
    if length(regexp_replace(number,'[^0-9]','','g')) not between 7 and 20 then raise exception 'Enter a valid WhatsApp number including country code'; end if;
    insert into public.mfp_team_contact_settings(team_key,whatsapp_number,updated_by,updated_at) values(team,number,uid,now()) on conflict(team_key) do update set whatsapp_number=excluded.whatsapp_number,updated_by=uid,updated_at=now(); return jsonb_build_object('success',true,'team_key',team,'whatsapp_number',number);
  end if; raise exception 'Unsupported action';
end; $$;
revoke all on function public.mfp_team_whatsapp(text,text,text) from public,anon;
grant execute on function public.mfp_team_whatsapp(text,text,text) to authenticated;

create or replace function public.mfp_ingest_links(p_items jsonb,p_is_test_data boolean default false)
returns jsonb language plpgsql security definer set search_path=public,extensions,auth,pg_temp as $$
declare uid uuid:=auth.uid(); p public.mfp_user_profiles%rowtype; rec record; raw_url text; input_url text; normalized_url text; link_type text; document_key text; created_profiles integer:=0; created_posts integer:=0; duplicates integer:=0; invalid integer:=0; seen_urls text[]:=array[]::text[]; submitted integer:=0;
begin
  if uid is null then raise exception 'Authentication required'; end if; select * into p from public.mfp_user_profiles where user_id=uid;
  if not found or p.account_status<>'ACTIVE' then raise exception 'Active MF MPanel account required'; end if;
  if p.role<>'ADMIN' and not(p.team_key='searching' and p.team_confirmed and 'searching'=any(coalesce(p.allowed_modules,'{}'::text[]))) then raise exception 'Searching team access required'; end if;
  if jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' then raise exception 'Items must be an array'; end if; submitted:=jsonb_array_length(coalesce(p_items,'[]'::jsonb));
  for rec in select value as item from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    raw_url:=trim(coalesce(rec.item->>'rawUrl','')); input_url:=trim(coalesce(rec.item->>'canonicalUrl',''));
    if input_url='' or coalesce(rec.item->>'error','')<>'' then invalid:=invalid+1; continue; end if;
    begin normalized_url:=public.mfp_normalize_link_url(input_url); exception when others then normalized_url:=null; end;
    if normalized_url is null or normalized_url !~* '^https?://[^[:space:]]+' then invalid:=invalid+1; continue; end if;
    normalized_url:=trim(normalized_url); if normalized_url='' then invalid:=invalid+1; continue; end if;
    if normalized_url=any(seen_urls) then duplicates:=duplicates+1; continue; end if; seen_urls:=array_append(seen_urls,normalized_url);
    perform pg_advisory_xact_lock(hashtext(lower(normalized_url)));
    if exists(select 1 from public.mfp_documents d where d.collection_name in('profiles','posts') and lower(public.mfp_normalize_link_url(coalesce(d.data->>'canonicalUrl',d.data->>'originalUrl',d.data->>'url','')))=lower(normalized_url)) then duplicates:=duplicates+1; continue; end if;
    link_type:=case when normalized_url ~* '(instagram\.com/(p|reel|tv)/|facebook\.com/.*/(posts|videos|watch)|youtube\.com/(watch|shorts)|youtu\.be/|tiktok\.com/.*/video/|(x|twitter)\.com/.*/status/)' then 'POST' when normalized_url ~* '/(p|reel|reels|tv|posts?|videos?|photos?|status|shorts|watch|live|clips?|stories|story)(/|$)' then 'POST' when upper(coalesce(rec.item->>'urlType',''))='POST' then 'POST' else 'PROFILE' end;
    if link_type='POST' then
      document_key:='PST-'||upper(substr(md5(normalized_url),1,12));
      insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key) values('posts',document_key,jsonb_build_object('postId',document_key,'profileId','','canonicalUrl',normalized_url,'originalUrl',coalesce(nullif(raw_url,''),input_url),'platform',coalesce(nullif(rec.item->>'platform',''),'Other'),'region','','notes',coalesce(rec.item->>'notes',''),'linkType','POST','currentWorkflowStatus','SEARCHED','createdBy',uid::text,'isTestData',coalesce(p_is_test_data,false),'createdAt',now(),'updatedAt',now()),uid,'searching') on conflict(collection_name,document_id) do nothing;
      if found then created_posts:=created_posts+1; else duplicates:=duplicates+1; end if;
    else
      insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key) values('profiles',gen_random_uuid()::text,jsonb_build_object('canonicalUrl',normalized_url,'rawUrl',coalesce(nullif(raw_url,''),input_url),'platform',coalesce(nullif(rec.item->>'platform',''),'Other'),'notes',coalesce(rec.item->>'notes',''),'linkType','PROFILE','currentWorkflowStatus','SEARCHED','createdBy',uid::text,'isTestData',coalesce(p_is_test_data,false),'createdAt',now(),'updatedAt',now()),uid,'searching'); created_profiles:=created_profiles+1;
    end if;
  end loop;
  return jsonb_build_object('success',true,'created',created_profiles+created_posts,'queued',created_profiles+created_posts,'profileLinks',created_profiles,'postedLinks',created_posts,'duplicates',duplicates,'invalid',invalid,'submittedCount',submitted,'message',created_profiles::text||' profile links and '||created_posts::text||' post links imported; '||duplicates::text||' duplicates and '||invalid::text||' invalid links.');
end; $$;
revoke all on function public.mfp_ingest_links(jsonb,boolean) from public,anon;
grant execute on function public.mfp_ingest_links(jsonb,boolean) to authenticated;

create or replace function public.mfp_admin_list_users(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.mfp_user_profiles where user_id=uid and role='ADMIN' and account_status='ACTIVE') then raise exception 'Administrator access required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'email',email,'display_name',display_name,'gender',gender,'gender_group',gender_group,'role',role,'account_status',account_status,'team_key',team_key,'team_confirmed',team_confirmed,'allowed_modules',allowed_modules,'created_at',created_at,'updated_at',updated_at,'preferences',preferences) order by created_at desc),'[]'::jsonb)
  into result from (select * from public.mfp_user_profiles order by created_at desc limit greatest(1,least(coalesce(p_limit,100),500))) rows;
  return result;
end; $$;
revoke all on function public.mfp_admin_list_users(integer) from public,anon;
grant execute on function public.mfp_admin_list_users(integer) to authenticated;

-- Pledge helpers are additive; the existing no-argument admin-list function is preserved.
create or replace function public.mfp_save_pledge(p_signature text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); sig text:=btrim(coalesce(p_signature,'')); ts timestamptz:=now();
begin
  if uid is null then raise exception 'Authentication required'; end if; if char_length(sig)<2 then raise exception 'Full name is required as signature'; end if;
  perform public.mfp_ensure_profile();
  update public.mfp_user_profiles set preferences=coalesce(preferences,'{}'::jsonb)||jsonb_build_object('pledgeAccepted',true,'pledgeSignature',sig,'pledgeAcceptedAt',ts),updated_at=ts where user_id=uid;
  if not found then raise exception 'User profile missing after profile initialization'; end if;
  return jsonb_build_object('success',true,'pledgeAccepted',true,'pledgeSignature',sig,'pledgeAcceptedAt',ts);
end; $$;
revoke all on function public.mfp_save_pledge(text) from public,anon;
grant execute on function public.mfp_save_pledge(text) to authenticated;

create or replace function public.mfp_searching_contributor_metrics(p_days integer default 7)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); p public.mfp_user_profiles%rowtype; v_days integer:=greatest(1,least(coalesce(p_days,7),31)); result jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into p from public.mfp_user_profiles where user_id=uid;
  if not found or p.account_status<>'ACTIVE' or p.role not in('ADMIN','TEAM_ADMIN') then raise exception 'Authorized team administrator required'; end if;
  if p.role='TEAM_ADMIN' and (p.team_key<>'searching' or not p.team_confirmed) then raise exception 'Searching Team Admin access required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('userId',s.user_id,'displayName',s.display_name,'email',s.email,'todayLinks',s.today_links,'last7Days',s.last7_days,'totalLinks',s.total_links,'lastLinkAt',s.last_link_at) order by s.last7_days desc,s.total_links desc,s.display_name),'[]'::jsonb)
  into result from (
    select up.user_id,coalesce(up.display_name,up.email,'Team member') as display_name,up.email,
      count(d.document_id) filter(where d.created_at::date=current_date)::int as today_links,
      count(d.document_id) filter(where d.created_at>=current_date-(v_days-1) and d.created_at<current_date+interval '1 day')::int as last7_days,
      count(d.document_id)::int as total_links,max(d.created_at) as last_link_at
    from public.mfp_user_profiles up left join public.mfp_documents d on d.owner_uid=up.user_id and d.collection_name in('profiles','posts') and d.team_key='searching' and coalesce(lower(d.data->>'isTestData'),'false')<>'true'
    where up.team_key='searching' and up.account_status='ACTIVE' and (p.role='ADMIN' or up.team_key=p.team_key)
    group by up.user_id,up.display_name,up.email
  ) s;
  return result;
end; $$;
revoke all on function public.mfp_searching_contributor_metrics(integer) from public,anon;
grant execute on function public.mfp_searching_contributor_metrics(integer) to authenticated;

notify pgrst,'reload schema';
