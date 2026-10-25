-- =====================================================================
-- MF MPanel BACKEND FIX FILE — v2.16.0
-- Run this ONCE in: Supabase Dashboard -> SQL Editor -> New query ->
-- paste this whole file -> Run. It is safe to run again (idempotent:
-- every statement is CREATE OR REPLACE / grants only, no data is deleted).
--
-- SECTION 1 — Pledge fix: users' pledge saving + the Admin user list now
--             returns each user's pledge data, so the Admin CAN download
--             every user's signed pledge PDF.
-- SECTION 2 — Searching intake fix: pasted links are classified as
--             PROFILE vs POST links. Post links are now tracked as posts
--             (previously EVERY link was stored as a profile and post
--             links were never tracked). Duplicates (against the whole
--             database and inside the same batch) and invalid links are
--             counted and routed to Admin Review, and the result returns
--             separate profile/post counts for the Searching screen.
-- =====================================================================

-- ===================== SECTION 1: PLEDGE =====================
create or replace function public.mfp_save_pledge(p_signature text)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); sig text:=btrim(coalesce(p_signature,'')); ts timestamptz:=now();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if char_length(sig)<2 then raise exception 'Full name is required as signature'; end if;
  perform public.mfp_ensure_profile();
  update public.mfp_user_profiles
  set preferences=coalesce(preferences,'{}'::jsonb)||jsonb_build_object('pledgeAccepted',true,'pledgeSignature',sig,'pledgeAcceptedAt',ts),updated_at=ts
  where user_id=uid;
  if not found then raise exception 'User profile missing after profile initialization'; end if;
  return jsonb_build_object('success',true,'pledgeAccepted',true,'pledgeSignature',sig,'pledgeAcceptedAt',ts);
end; $$;
revoke all on function public.mfp_save_pledge(text) from public,anon;
grant execute on function public.mfp_save_pledge(text) to authenticated;
notify pgrst,'reload schema';

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
grant execute on function public.mfp_team_analytics_data(text,integer) to authenticated;
notify pgrst,'reload schema';

-- ===================== SECTION 2: INTAKE (PROFILE vs POST) =====================
-- Full re-issue of mfp_web_api with ONLY the ingestLinks action changed;
-- every other action is byte-identical to the current production version.
create or replace function public.mfp_web_api(p_service text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,auth,pg_temp as $$
declare
  uid uuid := auth.uid(); p public.mfp_user_profiles%rowtype; action text := coalesce(p_payload->>'action','');
  admin_ok boolean := false; team_ok boolean := false; v_team text; v jsonb; code text; random_bytes bytea; request_id uuid; exp timestamptz;
  cnt integer; rec record; matches jsonb := '[]'::jsonb; unmatched integer := 0; job_id text;
  urls jsonb; profile_doc record; assn record; report jsonb; target_uid uuid; gender text; batch_uuid uuid := gen_random_uuid();
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into p from public.mfp_user_profiles where user_id=uid;
  if not found or p.account_status <> 'ACTIVE' then raise exception 'Active MF MPanel account required'; end if;
  admin_ok := p.role='ADMIN'; v_team := coalesce(p.team_key,'');
  team_ok := admin_ok or (p.team_confirmed and v_team in ('searching','checking','reports','evidence') and v_team = any(coalesce(p.allowed_modules,'{}'::text[])));
  if not admin_ok and not team_ok then raise exception 'Active account with one valid Admin-assigned team is required'; end if;

  -- Evidence linking: all website actions are direct RPCs; Android redemption remains compatible with its existing endpoint.
  if p_service in ('mfp-evidence-linking','evidence-linking') then
    if action='createPairing' then
      if not admin_ok and (not p.team_confirmed or v_team <> 'evidence') then raise exception 'Evidence team access is required'; end if;
      select count(*) into cnt from public.mfp_evidence_pairing_requests where user_id=uid and status='PENDING' and expires_at>now();
      if cnt>=3 then raise exception 'Too many active pairing codes; cancel one or wait for expiry'; end if;
      exp := now()+interval '10 minutes';
      for cnt in 1..5 loop
        random_bytes := gen_random_bytes(4); code := lpad(((get_byte(random_bytes,0)::bigint*16777216 + get_byte(random_bytes,1)::bigint*65536 + get_byte(random_bytes,2)::bigint*256 + get_byte(random_bytes,3)::bigint) % 1000000)::text,6,'0');
        insert into public.mfp_evidence_pairing_requests(user_id,code_hash,status,expires_at)
          values(uid,encode(digest(code,'sha256'),'hex'),'PENDING',exp)
          on conflict(code_hash) do nothing returning id into request_id;
        exit when request_id is not null;
      end loop;
      if request_id is null then raise exception 'Could not create a unique pairing code'; end if;
      return jsonb_build_object('code',code,'requestId',request_id,'expiresAt',extract(epoch from exp)*1000,'expiresInSeconds',600);
    elsif action='cancelPairing' then
      update public.mfp_evidence_pairing_requests set status='CANCELLED',updated_at=now() where id=(p_payload->>'requestId')::uuid and user_id=uid and status='PENDING';
      return jsonb_build_object('success',true);
    elsif action='disconnect' then
      target_uid := coalesce(nullif(p_payload->>'userId','')::uuid,uid);
      if target_uid<>uid and not admin_ok then raise exception 'Administrator access required'; end if;
      update public.mfp_evidence_app_registrations set status='REVOKED',activation_status='INACTIVE',team_authorized=false,revoked_at=now() where user_id=target_uid and application_id='MF_EVIDENCE';
      update public.mfp_evidence_pairing_requests set status='CANCELLED',updated_at=now() where user_id=target_uid and status='PENDING';
      insert into public.mfp_evidence_connection_events(user_id,event_type,metadata) values(target_uid,'ACCESS_REVOKED',jsonb_build_object('source','website_rpc'));
      return jsonb_build_object('success',true);
    elsif action='getSummary' then
      if not admin_ok and v_team <> 'evidence' then raise exception 'Evidence team access required'; end if;
      select jsonb_build_object('active',exists(select 1 from public.mfp_evidence_app_registrations r where r.user_id=uid and r.status='ACTIVE' and r.activation_status='ACTIVE'),
        'totalProfiles',(select count(*) from public.mfp_evidence_work_items where assigned_to=uid),
        'platformCounts',coalesce((select jsonb_object_agg(platform,n) from (select platform,count(*) n from public.mfp_evidence_work_items where assigned_to=uid group by platform) q),'{}'::jsonb),
        'teamId',p.team_key,'lastSync',(select extract(epoch from max(last_seen_at))*1000 from public.mfp_evidence_app_registrations where user_id=uid)) into v;
      return v;
    elsif action='getLinksPage' then
      if not admin_ok and v_team <> 'evidence' then raise exception 'Evidence team access required'; end if;
      with page as (
        select * from public.mfp_evidence_work_items where assigned_to=uid and (nullif(p_payload->>'cursor','') is null or id::text>(p_payload->>'cursor')) order by id limit 100
      ) select jsonb_build_object('links',coalesce(jsonb_agg(jsonb_build_object('id',id,'profileId',coalesce(profile_id,link_id),'url',url,'platform',platform,'status',status)),'[]'::jsonb),
          'nextCursor',case when count(*)=100 then max(id::text) else null end,'total',(select count(*) from public.mfp_evidence_work_items where assigned_to=uid)) into v from page;
      return v;
    elsif action='recordDownload' then
      if not admin_ok and v_team <> 'evidence' then raise exception 'Evidence team access required'; end if;
      insert into public.mfp_evidence_activity_events(user_id,event_type,metadata) values(uid,'ASSIGNED',jsonb_build_object('downloadCount',coalesce((p_payload->>'count')::integer,0),'platforms',coalesce(p_payload->'platforms','{}'::jsonb),'source','web_download'));
      return jsonb_build_object('success',true);
    elsif action='listAdmin' then
      if not admin_ok then raise exception 'Administrator access required'; end if;
      select jsonb_build_object('registrations',coalesce(jsonb_agg(jsonb_build_object('id',r.id,'userId',r.user_id,'email',up.email,'displayName',up.display_name,'teamId',r.team_id,'status',r.status,'activationStatus',r.activation_status,'deviceLabel',r.device_label,'linkedAt',extract(epoch from r.linked_at)*1000,'lastSeenAt',extract(epoch from r.last_seen_at)*1000)),'[]'::jsonb)) into v
        from public.mfp_evidence_app_registrations r left join public.mfp_user_profiles up on up.user_id=r.user_id;
      return v;
    end if;
    raise exception 'Unsupported Evidence action: %',action;
  end if;

  if p_service in ('mfp-link-workflow','link-workflow') then
    if action='summary' then
      if not admin_ok and v_team not in ('searching','reports','evidence') then raise exception 'Link assignment access required'; end if;
      select jsonb_build_object('platformCounts',coalesce((select jsonb_agg(jsonb_build_object('platform',platform,'available_count',n)) from (select coalesce(nullif(data->>'platform',''),'Other') platform,count(*) n from public.mfp_documents d where collection_name='profiles' and nullif(data->>'canonicalUrl','') is not null and coalesce(lower(data->>'isTestData'),'false') <> 'true' and coalesce(upper(data->>'currentWorkflowStatus'),'') not in ('INVALID','BLOCKED','FAILED_BLOCKED','DELETED') and not exists(select 1 from public.mfp_link_assignments a where a.canonical_url=public.mfp_normalize_link_url(d.data->>'canonicalUrl')) group by 1) s),'[]'::jsonb),
       'availableTotal',(select count(*) from public.mfp_documents d where collection_name='profiles' and nullif(data->>'canonicalUrl','') is not null and coalesce(lower(data->>'isTestData'),'false') <> 'true' and coalesce(upper(data->>'currentWorkflowStatus'),'') not in ('INVALID','BLOCKED','FAILED_BLOCKED','DELETED') and not exists(select 1 from public.mfp_link_assignments a where a.canonical_url=public.mfp_normalize_link_url(d.data->>'canonicalUrl'))),
       'systemPending',(select count(*) from public.mfp_link_assignments where status='PENDING')) into v; return v;
    elsif action='assign-links' then
      if not admin_ok and v_team not in ('searching','reports','evidence') then raise exception 'Link assignment access required'; end if;
      cnt := greatest(1,least(2000,coalesce((p_payload->>'count')::integer,0)));
      job_id := 'BATCH-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
      with candidates as (
        select d.document_id,d.data,coalesce(nullif(trim(d.data->>'platform'),''),'Other') platform,public.mfp_normalize_link_url(d.data->>'canonicalUrl') url
        from public.mfp_documents d where d.collection_name='profiles' and nullif(trim(d.data->>'canonicalUrl'),'') is not null
          and coalesce(lower(d.data->>'isTestData'),'false') <> 'true' and coalesce(upper(d.data->>'currentWorkflowStatus'),'') not in ('INVALID','BLOCKED','FAILED_BLOCKED','DELETED')
          and not exists(select 1 from public.mfp_link_assignments a where a.canonical_url=public.mfp_normalize_link_url(d.data->>'canonicalUrl'))
          and (coalesce(jsonb_array_length(p_payload->'platforms'),0)=0 or p_payload->'platforms' ? 'ALL' or coalesce(nullif(trim(d.data->>'platform'),''),'Other') in (select jsonb_array_elements_text(p_payload->'platforms')))
        order by d.created_at limit cnt for update of d skip locked
      ), ins as (
        insert into public.mfp_link_assignments(source_profile_id,canonical_url,platform,assigned_to,source_data)
        select document_id,url,platform,uid,data from candidates on conflict(canonical_url) do nothing
        returning id,source_profile_id,canonical_url,platform,assigned_at,source_data
      ) select jsonb_build_object('assigned',coalesce(jsonb_agg(jsonb_build_object('id',id,'profileId',coalesce(source_data->>'profileHandle',source_data->>'handle',source_data->>'username',source_profile_id),'mfpProfileId',coalesce(source_data->>'mfpProfileId',source_profile_id),'sourceProfileId',source_profile_id,'linkId','A'||lpad(row_number::text,2,'0'),'url',canonical_url,'platform',platform,'requiredScreenshots',1,'notes','','assignedAt',assigned_at)),'[]'::jsonb),
        'count',count(*),'requested',cnt,'downloadText',coalesce(string_agg(canonical_url,E'\n'),'') ,'batchId',job_id,'batchName',coalesce(nullif(p_payload->>'batchName',''),'MF MPanel Link Assignment'),'createdAt',now(),'createdBy',p.email,
        'links',coalesce(jsonb_agg(jsonb_build_object('linkId','A'||lpad(row_number::text,2,'0'),'url',canonical_url,'platform',platform,'profileId',coalesce(source_data->>'profileHandle',source_data->>'handle',source_data->>'username',source_profile_id),'mfpProfileId',coalesce(source_data->>'mfpProfileId',source_profile_id),'sourceProfileId',source_profile_id,'requiredScreenshots',1,'notes','')),'[]'::jsonb)) into v
        from (select i.*,row_number() over(order by assigned_at) from ins i) s;
      if coalesce((v->>'count')::integer,0)=0 then raise exception 'No available links match selected platforms'; end if; return v;
    elsif action='match-zip' then
      if not admin_ok then raise exception 'Administrator access required for ZIP matching'; end if;
      urls := coalesce(p_payload->'urls','[]'::jsonb); job_id := coalesce(nullif(p_payload->>'reportJobId',''),'ZIP-'||extract(epoch from now())::bigint::text);
      with input_urls as (select distinct public.mfp_normalize_link_url(value) url from jsonb_array_elements_text(urls) x(value) where value is not null and value<>'')
      select coalesce(jsonb_agg(jsonb_build_object('profileId',a.source_profile_id,'assignedTo',a.assigned_to,'url',a.canonical_url,'platform',a.platform,'assignmentId',a.id)), '[]'::jsonb), count(*) into matches,cnt
      from public.mfp_link_assignments a join input_urls u on u.url=a.canonical_url where a.status='PENDING';
      insert into public.mfp_link_upload_receipts(assignment_id,uploaded_by,report_job_id,matched_url)
      select a.id,uid,job_id,a.canonical_url from public.mfp_link_assignments a join (select distinct public.mfp_normalize_link_url(value) url from jsonb_array_elements_text(urls) x(value)) u on u.url=a.canonical_url where a.status='PENDING'
      on conflict(assignment_id,report_job_id) do nothing;
      update public.mfp_link_assignments a set status='RECEIVED',received_at=now(),report_job_id=job_id from (select distinct public.mfp_normalize_link_url(value) url from jsonb_array_elements_text(urls) x(value)) u where a.canonical_url=u.url and a.status='PENDING';
      select count(*) into unmatched from (select distinct public.mfp_normalize_link_url(value) url from jsonb_array_elements_text(urls) x(value) where value<>'') u where not exists(select 1 from public.mfp_link_assignments a where a.canonical_url=u.url and a.report_job_id=job_id);
      return jsonb_build_object('jobId',job_id,'inputUniqueCount',(select count(distinct public.mfp_normalize_link_url(value)) from jsonb_array_elements_text(urls) x(value)),'matchedCount',cnt,'matched',matches,'unmatchedCount',unmatched,'matchedUrls',coalesce((select jsonb_agg(x->>'url') from jsonb_array_elements(matches) x),'[]'::jsonb));
    elsif action='checker-next' then
      if not admin_ok and v_team <> 'checking' then raise exception 'Checking team access required'; end if;
      if not exists(select 1 from public.mfp_checking_assignments where checker_id=uid and status in ('ASSIGNED','OPEN','REOPEN','RECHECK')) then
        with candidates as (select d.document_id,d.data from public.mfp_documents d where d.collection_name='profiles' and upper(coalesce(d.data->>'currentWorkflowStatus',''))='QUEUED_CHECKING' and not exists(select 1 from public.mfp_checking_assignments a where a.profile_id=d.document_id) order by d.created_at limit 10 for update of d skip locked), ins as (
          insert into public.mfp_checking_assignments(profile_id,checker_id,batch_id) select document_id,uid,batch_uuid from candidates on conflict(profile_id) do nothing returning profile_id)
        update public.mfp_documents d set data=d.data||jsonb_build_object('currentWorkflowStatus','CHECKING_ASSIGNED','assignedCheckerUid',uid::text),updated_at=now() from ins where d.collection_name='profiles' and d.document_id=ins.profile_id;
      end if;
      select jsonb_build_object('item',case when a.id is null then null else jsonb_build_object('assignmentId',a.id,'profileId',coalesce(d.data->>'mfpProfileId',a.profile_id),'sourceProfileId',a.profile_id,'url',d.data->>'canonicalUrl','platform',coalesce(d.data->>'platform','Other'),'status',a.status,'postUrls',a.post_urls,'assignedAt',a.assigned_at) end,
        'remainingInPrivateBatch',(select count(*) from public.mfp_checking_assignments x where x.checker_id=uid and x.batch_id=a.batch_id and x.status in ('ASSIGNED','OPEN','REOPEN','RECHECK'))) into v
      from (select * from public.mfp_checking_assignments where checker_id=uid and status in ('ASSIGNED','OPEN','REOPEN','RECHECK') order by assigned_at limit 1) a left join public.mfp_documents d on d.collection_name='profiles' and d.document_id=a.profile_id;
      return coalesce(v,jsonb_build_object('item',null,'remainingInPrivateBatch',0));
    elsif action='checker-submit' then
      if not admin_ok and v_team <> 'checking' then raise exception 'Checking team access required'; end if;
      if p_payload->>'outcome' in ('BLOCKED','INVALID') and length(trim(coalesce(p_payload->>'notes','')))=0 then raise exception 'Notes are required for Blocked or Invalid'; end if;
      if p_payload->>'outcome'='VERIFIED' and jsonb_array_length(coalesce(p_payload->'postUrls','[]'::jsonb)) not in (0,3) then raise exception 'Verified requires either zero or exactly three post URLs'; end if;
      update public.mfp_checking_assignments set status=upper(p_payload->>'outcome'),outcome_notes=nullif(trim(p_payload->>'notes'),''),post_urls=coalesce(p_payload->'postUrls','[]'::jsonb),opened_at=case when p_payload->>'outcome'='OPEN' then now() else opened_at end,completed_at=case when p_payload->>'outcome' in ('VERIFIED','INVALID','BLOCKED') then now() else completed_at end,updated_at=now()
        where id=(p_payload->>'assignmentId')::uuid and checker_id=uid;
      if not found then raise exception 'Assignment not found for this checker'; end if;
      update public.mfp_documents d set data=d.data||jsonb_build_object(
        'currentWorkflowStatus',case when p_payload->>'outcome'='VERIFIED' then 'VERIFIED' when p_payload->>'outcome' in ('INVALID','BLOCKED') then 'FAILED_BLOCKED' else 'CHECKING_ASSIGNED' end,
        'checkingOutcome',p_payload->>'outcome','checkingNotes',coalesce(p_payload->>'notes',''),'postUrls',coalesce(p_payload->'postUrls','[]'::jsonb),'checkedByUid',uid::text,'checkedAt',now(),'updatedAt',now()
      ),updated_at=now() where d.collection_name='profiles' and d.document_id=(select a.profile_id from public.mfp_checking_assignments a where a.id=(p_payload->>'assignmentId')::uuid);
      return jsonb_build_object('success',true,'terminal',(p_payload->>'outcome' in ('VERIFIED','INVALID','BLOCKED')),'completedAt',case when p_payload->>'outcome' in ('VERIFIED','INVALID','BLOCKED') then now() else null end);
    elsif action='admin-checking-results' then
      if not admin_ok then raise exception 'Administrator access required'; end if;
      select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',a.id,'assignmentId',a.id,'profileId',coalesce(d.data->>'mfpProfileId',a.profile_id),'profile_id',coalesce(d.data->>'mfpProfileId',a.profile_id),'sourceProfileId',a.profile_id,'checkerId',a.checker_id,'checker_id',a.checker_id,'status',a.status,'notes',a.outcome_notes,'outcome_notes',a.outcome_notes,'postUrls',a.post_urls,'post_urls',a.post_urls,'assignedAt',a.assigned_at,'completedAt',a.completed_at,'updated_at',coalesce(a.updated_at,a.completed_at,a.assigned_at),'platform',coalesce(d.data->>'platform','Other'),'url',d.data->>'canonicalUrl')),'[]'::jsonb)) into v from public.mfp_checking_assignments a left join public.mfp_documents d on d.collection_name='profiles' and d.document_id=a.profile_id;
      return v;
    end if;
    raise exception 'Unsupported link workflow action: %',action;
  end if;

  if p_service in ('mfp-gender-team-admin','gender-team-admin') then
    if action='get' then
      gender := coalesce(p_payload->>'genderGroup','male');
      if gender not in ('male','female') then raise exception 'Invalid gender group'; end if;
      if not admin_ok and not exists(select 1 from public.mfp_gender_team_admin_assignments a where a.gender_group=gender and a.admin_user_id=uid) then raise exception 'Gender-team lead access required'; end if;
      select jsonb_build_object(
        'success',true,
        'genderGroup',gender,
        'assignment',(select to_jsonb(a) from public.mfp_gender_team_admin_assignments a where a.gender_group=gender),
        'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.mfp_gender_team_admin_assignments a),'[]'::jsonb),
        'members',coalesce((select jsonb_agg(jsonb_build_object(
          'userId',up.user_id,'email',up.email,'name',up.display_name,'team',up.team_key,'accountStatus',up.account_status,
          'activity',(select count(*) from public.mfp_documents d where d.owner_uid=up.user_id and d.collection_name in ('profiles','posts','checkingRecords','workflowEvents')),
          'completed',(select count(*) from public.mfp_documents d where d.owner_uid=up.user_id and d.collection_name='checkingRecords' and upper(coalesce(d.data->>'outcome','')) in ('VERIFIED','COMPLETE','COMPLETED')),
          'failed',(select count(*) from public.mfp_documents d where d.owner_uid=up.user_id and d.collection_name='checkingRecords' and upper(coalesce(d.data->>'outcome','')) in ('INVALID','BLOCKED','FAILED_BLOCKED'))
        )) from public.mfp_user_profiles up where up.gender_group=gender and up.account_status='ACTIVE'),'[]'::jsonb),
        'totalMembers',(select count(*) from public.mfp_user_profiles where gender_group=gender and account_status='ACTIVE'),
        'totalWork',(select count(*) from public.mfp_documents d join public.mfp_user_profiles up on up.user_id=d.owner_uid where up.gender_group=gender and d.collection_name in ('profiles','posts','checkingRecords','workflowEvents')),
        'completed',(select count(*) from public.mfp_documents d join public.mfp_user_profiles up on up.user_id=d.owner_uid where up.gender_group=gender and d.collection_name='checkingRecords' and upper(coalesce(d.data->>'outcome','')) in ('VERIFIED','COMPLETE','COMPLETED')),
        'failed',(select count(*) from public.mfp_documents d join public.mfp_user_profiles up on up.user_id=d.owner_uid where up.gender_group=gender and d.collection_name='checkingRecords' and upper(coalesce(d.data->>'outcome','')) in ('INVALID','BLOCKED','FAILED_BLOCKED')),
        'workByTeam',coalesce((select jsonb_object_agg(team_key,n) from (select d.team_key,count(*) n from public.mfp_documents d join public.mfp_user_profiles up on up.user_id=d.owner_uid where up.gender_group=gender and d.collection_name in ('profiles','posts','checkingRecords','workflowEvents') and d.team_key is not null group by d.team_key) wt),'{}'::jsonb),
        'linkRecords',coalesce((select jsonb_agg(jsonb_build_object('publicId',coalesce(d.data->>'mfpProfileId',d.data->>'mfpPostId',d.document_id),'recordType',case when d.collection_name='posts' then 'POST' else 'PROFILE' end,'url',coalesce(d.data->>'canonicalUrl',d.data->>'originalUrl',d.data->>'url'),'status',coalesce(d.data->>'currentWorkflowStatus',d.data->>'outcome','RECORDED'))) from public.mfp_documents d join public.mfp_user_profiles up on up.user_id=d.owner_uid where up.gender_group=gender and d.collection_name in ('profiles','posts')),'[]'::jsonb)
      ) into v;
      return v;
    elsif action='assign' then
      if not admin_ok then raise exception 'Administrator access required'; end if;
      gender := p_payload->>'genderGroup'; target_uid := nullif(p_payload->>'adminUserId','')::uuid;
      if gender not in ('male','female') then raise exception 'Invalid gender group'; end if;
      if target_uid is null then delete from public.mfp_gender_team_admin_assignments where gender_group=gender; return jsonb_build_object('success',true,'removed',true); end if;
      if not exists(select 1 from public.mfp_user_profiles where user_id=target_uid and role in ('ADMIN','TEAM_ADMIN') and account_status='ACTIVE' and gender_group=gender) then raise exception 'Choose an active same-gender Team Admin'; end if;
      insert into public.mfp_gender_team_admin_assignments(gender_group,admin_user_id,assigned_by,updated_at) values(gender,target_uid,uid,now()) on conflict(gender_group) do update set admin_user_id=excluded.admin_user_id,assigned_by=uid,updated_at=now();
      return jsonb_build_object('success',true,'removed',false,'adminUserId',target_uid);
    end if;
    raise exception 'Unsupported gender-team action: %',action;
  end if;

  if p_service in ('mfp-admin-export-settings','admin-export-settings') then
    if not admin_ok then raise exception 'Administrator access required'; end if;
    if action='read' then select setting_value into v from mfp_private.mfp_export_settings where setting_key='website_zip_export' limit 1; return jsonb_build_object('configured',coalesce(length(v->>'zip_password'),0)>0);
    elsif action='write' then insert into mfp_private.mfp_export_settings(setting_key,setting_value,updated_by,updated_at) values('website_zip_export',jsonb_build_object('zip_password',coalesce(p_payload->>'zip_password','')),uid,now()) on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_by=uid,updated_at=now(); return jsonb_build_object('success',true); end if;
    raise exception 'Unsupported export settings action: %',action;
  end if;

  if p_service in ('mfp-organization-reports','organization-reports') then
    if action<>'generate' then raise exception 'Unsupported organization report action: %',action; end if;
    if not admin_ok and not team_ok then raise exception 'Authorized team access required'; end if;
    if not admin_ok and (coalesce(p_payload->>'period','')='organization') then raise exception 'Administrator access required for organization-wide reports'; end if;
    job_id := 'MFR-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISS')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    select jsonb_build_object('reportId',job_id,'title',coalesce(nullif(p_payload->>'title',''),'MF MPanel Activity Report'),'period',p_payload->>'period','startDate',p_payload->>'startDate','endDate',p_payload->>'endDate','createdAt',now(),'createdBy',uid,'scope',case when admin_ok then 'ORGANIZATION' else upper(v_team)||'_TEAM' end,'team',case when admin_ok then null else v_team end,
      'sharedTeams',case when admin_ok then coalesce(p_payload->'shareTeams','[]'::jsonb) else jsonb_build_array(v_team) end,'sharedGenderGroups',case when admin_ok then coalesce(p_payload->'shareGenderGroups','[]'::jsonb) else '[]'::jsonb end,
      'totals',jsonb_build_object('profiles',(select count(*) from public.mfp_documents d where d.collection_name='profiles' and (admin_ok or d.team_key=v_team) and d.created_at::date between coalesce(nullif(p_payload->>'startDate','')::date,current_date) and coalesce(nullif(p_payload->>'endDate','')::date,current_date)),'posts',(select count(*) from public.mfp_documents d where d.collection_name='posts' and (admin_ok or d.team_key=v_team) and d.created_at::date between coalesce(nullif(p_payload->>'startDate','')::date,current_date) and coalesce(nullif(p_payload->>'endDate','')::date,current_date))),
      'members',coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'email',email,'name',display_name,'team',team_key,'accountStatus',account_status)) from public.mfp_user_profiles where admin_ok or team_key=v_team),'[]'::jsonb),
      'linkRecords',coalesce((select jsonb_agg(jsonb_build_object('publicId',public_id,'recordType',record_type,'profileId',profile_public_id,'url',url,'status',status,'createdAt',created_at)) from (
        select coalesce(d.data->>'mfpProfileId',d.document_id) public_id,'PROFILE'::text record_type,coalesce(d.data->>'mfpProfileId',d.document_id) profile_public_id,coalesce(d.data->>'canonicalUrl',d.data->>'originalUrl',d.data->>'url') url,coalesce(d.data->>'currentWorkflowStatus','SEARCHED') status,d.created_at
        from public.mfp_documents d where d.collection_name='profiles' and (admin_ok or d.team_key=v_team) and d.created_at::date between coalesce(nullif(p_payload->>'startDate','')::date,current_date) and coalesce(nullif(p_payload->>'endDate','')::date,current_date)
        union all
        select coalesce(d.data->>'mfpPostId',d.document_id) public_id,'POST'::text record_type,coalesce(d.data->>'mfpProfileId',d.data->>'profileId','') profile_public_id,coalesce(d.data->>'canonicalUrl',d.data->>'originalUrl',d.data->>'url') url,coalesce(d.data->>'currentWorkflowStatus',d.data->>'outcome','RECORDED') status,d.created_at
        from public.mfp_documents d where d.collection_name='posts' and (admin_ok or d.team_key=v_team) and d.created_at::date between coalesce(nullif(p_payload->>'startDate','')::date,current_date) and coalesce(nullif(p_payload->>'endDate','')::date,current_date)
      ) records),'[]'::jsonb)) into report;
    insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key) values('organizationReports',job_id,report,uid,case when admin_ok then null else v_team end);
    return jsonb_build_object('success',true,'report',report);
  end if;

  if p_service in ('mfp-team-analytics','team-analytics') then
    if action='assignTeamAdmin' then
      if not admin_ok then raise exception 'Administrator access required'; end if;
      v_team := p_payload->>'team'; target_uid := nullif(p_payload->>'userId','')::uuid;
      if v_team is null or v_team not in ('searching','checking','reports','evidence') then raise exception 'Invalid team'; end if;
      select * into rec from public.mfp_team_admin_assignments where team_key=v_team for update;
      if target_uid is null then
        delete from public.mfp_team_admin_assignments where team_key=v_team;
        if rec.admin_user_id is not null and not exists(select 1 from public.mfp_team_admin_assignments where admin_user_id=rec.admin_user_id) then
          update public.mfp_user_profiles set role=case when coalesce(rec.previous_role,'ADMIN')='TEAM_ADMIN' then 'ADMIN' else coalesce(rec.previous_role,'ADMIN') end,team_key=null,team_confirmed=true,allowed_modules=array['searching','checking','reports','evidence','admin']::text[],updated_at=now() where user_id=rec.admin_user_id;
          update public.mfp_documents set data=data||jsonb_build_object('role','ADMIN','team',null,'teamConfirmed',true,'allowedModules',to_jsonb(array['searching','checking','reports','evidence','admin']::text[]),'updatedAt',now()),team_key=null,updated_at=now() where collection_name='users' and document_id=rec.admin_user_id::text;
        end if;
        return jsonb_build_object('success',true,'removed',true);
      end if;
      if target_uid=uid then raise exception 'The senior administrator cannot assign themselves as a team lead'; end if;
      select * into profile_doc from public.mfp_user_profiles where user_id=target_uid;
      if not found or profile_doc.account_status<>'ACTIVE' or profile_doc.role not in ('ADMIN','TEAM_ADMIN') then raise exception 'Choose an active account with ADMIN or TEAM_ADMIN role'; end if;
      if exists(select 1 from public.mfp_team_admin_assignments where admin_user_id=target_uid and team_key<>v_team) then raise exception 'This account already manages another team'; end if;
      insert into public.mfp_team_admin_assignments(team_key,admin_user_id,assigned_by,previous_role,updated_at) values(v_team,target_uid,uid,case when profile_doc.role='TEAM_ADMIN' then 'TEAM_ADMIN' else 'ADMIN' end,now()) on conflict(team_key) do update set admin_user_id=excluded.admin_user_id,assigned_by=uid,previous_role=excluded.previous_role,updated_at=now();
      if rec.admin_user_id is not null and rec.admin_user_id<>target_uid and not exists(select 1 from public.mfp_team_admin_assignments where admin_user_id=rec.admin_user_id) then
        update public.mfp_user_profiles set role=case when coalesce(rec.previous_role,'ADMIN')='TEAM_ADMIN' then 'ADMIN' else coalesce(rec.previous_role,'ADMIN') end,team_key=null,team_confirmed=true,allowed_modules=array['searching','checking','reports','evidence','admin']::text[],updated_at=now() where user_id=rec.admin_user_id;
        update public.mfp_documents set data=data||jsonb_build_object('role','ADMIN','team',null,'teamConfirmed',true,'allowedModules',to_jsonb(array['searching','checking','reports','evidence','admin']::text[]),'updatedAt',now()),team_key=null,updated_at=now() where collection_name='users' and document_id=rec.admin_user_id::text;
      end if;
      update public.mfp_user_profiles set role='TEAM_ADMIN',team_key=v_team,team_confirmed=true,allowed_modules=array[v_team]::text[],updated_at=now() where user_id=target_uid;
      update public.mfp_documents set data=data||jsonb_build_object('role','TEAM_ADMIN','team',v_team,'teamConfirmed',true,'allowedModules',to_jsonb(array[v_team]::text[]),'updatedAt',now()),team_key=v_team,updated_at=now() where collection_name='users' and document_id=target_uid::text;
      return jsonb_build_object('success',true,'removed',false,'team',v_team,'userId',target_uid);
    elsif action='reviewLowScore' then
      if not admin_ok and p.role<>'TEAM_ADMIN' then raise exception 'Administrator or Team Admin access required'; end if;
      select * into rec from public.mfp_team_score_warnings where id=(p_payload->>'warningId')::uuid;
      if not found then raise exception 'Warning not found'; end if;
      if not admin_ok and rec.team_key<>v_team then raise exception 'You cannot review another team warning'; end if;
      if p_payload->>'decision' not in ('keep','remove') then raise exception 'Invalid warning decision'; end if;
      update public.mfp_user_profiles set account_status=case when p_payload->>'decision'='remove' then 'DISABLED' else 'ACTIVE' end,team_key=case when p_payload->>'decision'='remove' then null else team_key end,team_confirmed=case when p_payload->>'decision'='remove' then false else team_confirmed end,allowed_modules=case when p_payload->>'decision'='remove' then '{}'::text[] else allowed_modules end,updated_at=now() where user_id=rec.user_id;
      update public.mfp_documents set data=data||jsonb_build_object('accountStatus',case when p_payload->>'decision'='remove' then 'DISABLED' else 'ACTIVE' end,'team',case when p_payload->>'decision'='remove' then null else data->'team' end,'teamConfirmed',case when p_payload->>'decision'='remove' then false else coalesce((data->>'teamConfirmed')::boolean,false) end,'allowedModules',case when p_payload->>'decision'='remove' then '[]'::jsonb else coalesce(data->'allowedModules','[]'::jsonb) end,'updatedAt',now()),team_key=case when p_payload->>'decision'='remove' then null else team_key end,updated_at=now() where collection_name='users' and document_id=rec.user_id::text;
      if p_payload->>'decision'='remove' then update public.mfp_evidence_app_registrations set status='REVOKED',activation_status='INACTIVE',team_authorized=false,revoked_at=now() where user_id=rec.user_id and application_id='MF_EVIDENCE'; end if;
      update public.mfp_team_score_warnings set status=case when p_payload->>'decision'='keep' then 'KEPT_ACTIVE' else 'DISABLED' end,reviewed_by=uid,reviewed_at=now() where id=rec.id;
      insert into public.mfp_web_notifications(user_id,title,message,notification_type) values(rec.user_id,case when p_payload->>'decision'='remove' then 'Account access disabled' else 'Account retained after review' end,case when p_payload->>'decision'='remove' then 'A team administrator disabled your account after a low-score review.' else 'A team administrator reviewed your low score and kept your account active.' end,case when p_payload->>'decision'='remove' then 'warning' else 'info' end);
      return jsonb_build_object('success',true);
    elsif action in ('getAnalytics','getMyScore') then
      if not admin_ok and action='getAnalytics' and p.role <> 'TEAM_ADMIN' then raise exception 'Administrator or authorized Team Admin access required'; end if;
      select jsonb_build_object('isSeniorAdmin',admin_ok,'managedTeams',case when admin_ok then '["searching","checking","reports","evidence"]'::jsonb else jsonb_build_array(v_team) end,
        'teams',coalesce((select jsonb_agg(jsonb_build_object('team',team_name,'adminName',(select display_name from public.mfp_user_profiles where user_id=(select admin_user_id from public.mfp_team_admin_assignments where team_key=team_name)),'adminScore',null,'score',null,'members',(select count(*) from public.mfp_user_profiles where team_name=any(allowed_modules) and account_status='ACTIVE'),'activity',(select count(*) from public.mfp_documents where team_key=team_name),'daily','[]'::jsonb)) from unnest(case when admin_ok then array['searching','checking','reports','evidence']::text[] else array[v_team]::text[] end) as team_rows(team_name)),'[]'::jsonb),
        'members',coalesce((select jsonb_agg(jsonb_build_object(
          'userId',up.user_id,'name',up.display_name,'email',up.email,'team',coalesce(up.team_key,v_team),'status',up.account_status,
          'assigned',(select count(*) from public.mfp_link_assignments la where la.assigned_to=up.user_id),
          'completed',(select count(*) from public.mfp_checking_assignments ca where ca.checker_id=up.user_id and ca.status='VERIFIED'),
          'failed',(select count(*) from public.mfp_checking_assignments ca where ca.checker_id=up.user_id and ca.status in ('BLOCKED','INVALID')),
          'activity',(select count(*) from public.mfp_documents d where d.owner_uid=up.user_id and d.collection_name in ('profiles','posts','checkingRecords','workflowEvents'))+(select count(*) from public.mfp_evidence_activity_events e where e.user_id=up.user_id),
          'score',case when ((select count(*) from public.mfp_checking_assignments ca where ca.checker_id=up.user_id and ca.status='VERIFIED')+(select count(*) from public.mfp_checking_assignments ca where ca.checker_id=up.user_id and ca.status in ('BLOCKED','INVALID')))=0 then null else round(100.0*(select count(*) from public.mfp_checking_assignments ca where ca.checker_id=up.user_id and ca.status='VERIFIED')/greatest(1,(select count(*) from public.mfp_checking_assignments ca where ca.checker_id=up.user_id and ca.status='VERIFIED')+(select count(*) from public.mfp_checking_assignments ca where ca.checker_id=up.user_id and ca.status in ('BLOCKED','INVALID'))),1) end,
          'daily','[]'::jsonb,'lowScorePending',exists(select 1 from public.mfp_team_score_warnings w where w.user_id=up.user_id and w.status='PENDING_REVIEW')
        )) from public.mfp_user_profiles up where (action='getAnalytics' and admin_ok) or (action='getAnalytics' and p.role='TEAM_ADMIN' and up.team_key=v_team) or up.user_id=uid),'[]'::jsonb),
        'trendWarnings',coalesce((select jsonb_agg(jsonb_build_object('team',team_key,'createdAt',created_at,'scores',recent_scores)) from public.mfp_team_trend_alerts where action='getAnalytics' and (admin_ok or team_key=v_team)),'[]'::jsonb),
        'warnings',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'userId',w.user_id,'name',coalesce(up.display_name,up.email),'team',w.team_key,'score',w.score,'createdAt',w.created_at,'status',w.status)) from public.mfp_team_score_warnings w join public.mfp_user_profiles up on up.user_id=w.user_id where w.status='PENDING_REVIEW' and ((action='getAnalytics' and (admin_ok or w.team_key=v_team)) or w.user_id=uid)),'[]'::jsonb),
        'admins',coalesce((select jsonb_agg(jsonb_build_object('userId',user_id,'name',display_name,'email',email)) from public.mfp_user_profiles where role in ('ADMIN','TEAM_ADMIN') and account_status='ACTIVE' and (admin_ok or user_id=(select admin_user_id from public.mfp_team_admin_assignments where team_key=v_team))),'[]'::jsonb),
        'userId',uid,'name',p.display_name,'team',p.team_key,'score',null,'scoreStatus','NO_OUTCOMES','accountStatus',p.account_status,'activity',0,'completed',0,'failed',0,'daily','[]'::jsonb,'days',coalesce((p_payload->>'days')::integer,7)) into v;
      return v;
    end if;
    raise exception 'Unsupported team analytics action: %',action;
  end if;

  if p_service in ('mfp-evidence-performance','evidence-performance') then
    if not admin_ok and v_team <> 'evidence' then raise exception 'Evidence team access required'; end if;
    if action='syncWorkActivity' then raise exception 'Activity sync is managed by the Android application; website sync is disabled'; end if;
    target_uid := coalesce(nullif(p_payload->>'userId','')::uuid,uid);
    if action='getAdminPerformance' and not admin_ok then raise exception 'Administrator access required'; end if;
    if target_uid<>uid and not admin_ok then raise exception 'Cannot read another user performance'; end if;
    select jsonb_build_object('userId',target_uid,'email',(select email from public.mfp_user_profiles where user_id=target_uid),'displayName',(select display_name from public.mfp_user_profiles where user_id=target_uid),'period',coalesce(p_payload->>'period','monthly'),'rangeStart',now()-interval '30 days',
      'assigned',(select count(*) from public.mfp_evidence_work_items where assigned_to=target_uid),'completed',(select count(*) from public.mfp_evidence_work_items where assigned_to=target_uid and status='COMPLETED'),'failed',(select count(*) from public.mfp_evidence_activity_events where user_id=target_uid and event_type='FAILED'),'pending',(select count(*) from public.mfp_evidence_work_items where assigned_to=target_uid and status in ('ASSIGNED','PENDING')),
      'activeAssigned',(select count(*) from public.mfp_evidence_work_items where assigned_to=target_uid and status in ('ASSIGNED','PENDING','COMPLETED')),'score',case when (select count(*) from public.mfp_evidence_work_items where assigned_to=target_uid and status='COMPLETED')+(select count(*) from public.mfp_evidence_activity_events where user_id=target_uid and event_type='FAILED')=0 then null else round(100.0*(select count(*) from public.mfp_evidence_work_items where assigned_to=target_uid and status='COMPLETED')/greatest(1,(select count(*) from public.mfp_evidence_work_items where assigned_to=target_uid and status='COMPLETED')+(select count(*) from public.mfp_evidence_activity_events where user_id=target_uid and event_type='FAILED')),2) end,
      'scoreStatus','NO_OUTCOMES','platformCounts','{}'::jsonb,'series','[]'::jsonb,'registrationStatus',coalesce((select status from public.mfp_evidence_app_registrations where user_id=target_uid and application_id='MF_EVIDENCE'),'NOT_LINKED'),'activationStatus',coalesce((select activation_status from public.mfp_evidence_app_registrations where user_id=target_uid and application_id='MF_EVIDENCE'),'INACTIVE'),'lastSeenAt',(select last_seen_at from public.mfp_evidence_app_registrations where user_id=target_uid and application_id='MF_EVIDENCE')) into v;
    if action='getPerformance' then return v; end if;
    if action='getAdminPerformance' then
      select jsonb_build_object(
        'period',coalesce(p_payload->>'period','monthly'),
        'users',coalesce((select jsonb_agg(jsonb_build_object(
          'userId',up.user_id,'email',up.email,'displayName',up.display_name,'team',up.team_key,'accountStatus',up.account_status,
          'period',coalesce(p_payload->>'period','monthly'),'rangeStart',now()-interval '30 days',
          'assigned',(select count(*) from public.mfp_evidence_work_items wi where wi.assigned_to=up.user_id),
          'completed',(select count(*) from public.mfp_evidence_work_items wi where wi.assigned_to=up.user_id and wi.status='COMPLETED'),
          'failed',(select count(*) from public.mfp_evidence_activity_events ev where ev.user_id=up.user_id and ev.event_type='FAILED'),
          'pending',(select count(*) from public.mfp_evidence_work_items wi where wi.assigned_to=up.user_id and wi.status in ('ASSIGNED','PENDING')),
          'activeAssigned',(select count(*) from public.mfp_evidence_work_items wi where wi.assigned_to=up.user_id and wi.status in ('ASSIGNED','PENDING','COMPLETED')),
          'score',case when ((select count(*) from public.mfp_evidence_work_items wi where wi.assigned_to=up.user_id and wi.status='COMPLETED')+(select count(*) from public.mfp_evidence_activity_events ev where ev.user_id=up.user_id and ev.event_type='FAILED'))=0 then null else round(100.0*(select count(*) from public.mfp_evidence_work_items wi where wi.assigned_to=up.user_id and wi.status='COMPLETED')/greatest(1,(select count(*) from public.mfp_evidence_work_items wi where wi.assigned_to=up.user_id and wi.status='COMPLETED')+(select count(*) from public.mfp_evidence_activity_events ev where ev.user_id=up.user_id and ev.event_type='FAILED')),2) end,
          'scoreStatus','RECORDED_OUTCOMES','platformCounts','{}'::jsonb,'series','[]'::jsonb,
          'registrationStatus',coalesce((select r.status from public.mfp_evidence_app_registrations r where r.user_id=up.user_id and r.application_id='MF_EVIDENCE'),'NOT_LINKED'),
          'activationStatus',coalesce((select r.activation_status from public.mfp_evidence_app_registrations r where r.user_id=up.user_id and r.application_id='MF_EVIDENCE'),'INACTIVE'),
          'lastSeenAt',(select r.last_seen_at from public.mfp_evidence_app_registrations r where r.user_id=up.user_id and r.application_id='MF_EVIDENCE')
        )) from public.mfp_user_profiles up where up.team_key='evidence' and up.account_status='ACTIVE'),'[]'::jsonb),
        'totals',jsonb_build_object('users',(select count(*) from public.mfp_user_profiles where team_key='evidence' and account_status='ACTIVE'),
          'assigned',(select count(*) from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to where up.team_key='evidence'),
          'completed',(select count(*) from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to where up.team_key='evidence' and wi.status='COMPLETED'),
          'pending',(select count(*) from public.mfp_evidence_work_items wi join public.mfp_user_profiles up on up.user_id=wi.assigned_to where up.team_key='evidence' and wi.status in ('ASSIGNED','PENDING')))
      ) into v; return v;
    end if;
    raise exception 'Unsupported evidence performance action: %',action;
  end if;

  if p_service in ('mfp-workflow-control','workflow-control') then
    if action='ingestLinks' then
      if not admin_ok and v_team <> 'searching' then raise exception 'Searching team access required'; end if;
      urls := coalesce(p_payload->'items','[]'::jsonb); cnt:=0; v := jsonb_build_object('prof',0,'post',0,'dup',0,'inv',0);
      for rec in select value as item from jsonb_array_elements(urls) loop
        if nullif(trim(rec.item->>'canonicalUrl'),'') is null or coalesce(rec.item->>'error','') <> '' then
          v := jsonb_set(v,'{inv}',to_jsonb((v->>'inv')::int+1)); continue;
        end if;
        if exists(select 1 from public.mfp_documents where collection_name in ('profiles','posts') and lower(coalesce(data->>'canonicalUrl','')) = lower(rec.item->>'canonicalUrl')) then
          v := jsonb_set(v,'{dup}',to_jsonb((v->>'dup')::int+1)); continue;
        end if;
        code := case
          when (rec.item->>'canonicalUrl') ~* '(instagram\.com/(p|reel|tv)/|facebook\.com/.*/(posts|videos|watch)|youtube\.com/(watch|shorts)|youtu\.be/|tiktok\.com/.*/video/|(x|twitter)\.com/.*/status/)' then 'POST'
          when (rec.item->>'canonicalUrl') ~* '/(p|reel|reels|tv|posts?|videos?|photos?|status|shorts|watch|live|clips?|stories|story)(/|$)' then 'POST'
          when upper(coalesce(rec.item->>'urlType','')) = 'POST' then 'POST'
          else 'PROFILE' end;
        if code = 'POST' then
          insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key)
          values('posts','PST-'||upper(substr(md5(rec.item->>'canonicalUrl'),1,12)),
            jsonb_build_object('postId','PST-'||upper(substr(md5(rec.item->>'canonicalUrl'),1,12)),'profileId','','canonicalUrl',rec.item->>'canonicalUrl','originalUrl',rec.item->>'rawUrl','platform',coalesce(rec.item->>'platform','Other'),'region','','notes',coalesce(rec.item->>'notes',''),'linkType','POST','currentWorkflowStatus','SEARCHED','createdBy',uid::text,'isTestData',coalesce((p_payload->>'isTestData')::boolean,false),'createdAt',now(),'updatedAt',now()),
            uid,'searching') on conflict(collection_name,document_id) do nothing;
          v := jsonb_set(v,'{post}',to_jsonb((v->>'post')::int+1));
        else
          insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key)
          values('profiles',gen_random_uuid()::text,
            jsonb_build_object('canonicalUrl',rec.item->>'canonicalUrl','rawUrl',rec.item->>'rawUrl','platform',coalesce(rec.item->>'platform','Other'),'notes',coalesce(rec.item->>'notes',''),'linkType','PROFILE','currentWorkflowStatus','SEARCHED','createdBy',uid::text,'isTestData',coalesce((p_payload->>'isTestData')::boolean,false),'createdAt',now(),'updatedAt',now()),
            uid,'searching') on conflict(collection_name,document_id) do nothing;
          v := jsonb_set(v,'{prof}',to_jsonb((v->>'prof')::int+1));
        end if;
        cnt:=cnt+1;
      end loop;
      return jsonb_build_object('success',true,'created',cnt,'queued',cnt,'backlogged',0,'duplicates',(v->>'dup')::int,'invalid',(v->>'inv')::int,'profileLinks',(v->>'prof')::int,'postedLinks',(v->>'post')::int,'submittedCount',jsonb_array_length(urls),'message',(v->>'prof')::int||' profile links and '||(v->>'post')::int||' post links tracked and sent to Checking. '||(v->>'dup')::int||' duplicates and '||(v->>'inv')::int||' invalid links sent to Admin Review.');
    elsif action='resetPreview' then
      if not admin_ok then raise exception 'Administrator access required'; end if;
      select jsonb_build_object('success',true,'testingRecords',(select count(*) from public.mfp_documents where coalesce(lower(data->>'isTestData'),'false')='true'),'workflowRecords',(select count(*) from public.mfp_documents where collection_name in ('profiles','posts','checkingRecords','workflowEvents')),'byCollection',coalesce((select jsonb_object_agg(collection_name,n) from (select collection_name,count(*) n from public.mfp_documents where coalesce(lower(data->>'isTestData'),'false')='true' group by collection_name) x),'{}'::jsonb),'resetScope','Explicit test records only') into v; return v;
    elsif action in ('resetTestingData','resetSystem') then
      if not admin_ok then raise exception 'Administrator access required'; end if;
      if action='resetTestingData' and p_payload->>'confirmation'<>'DELETE TEST DATA' then raise exception 'Confirmation text does not match'; end if;
      if action='resetSystem' and p_payload->>'confirmation'<>'RESET ALL MF MPANEL DATA' then raise exception 'Confirmation text does not match'; end if;
      delete from public.mfp_documents where (action='resetSystem' and collection_name in ('profiles','posts','checkingRecords','workflowEvents','reportJobs','reportPackages')) or (action='resetTestingData' and coalesce(lower(data->>'isTestData'),'false')='true'); get diagnostics cnt=row_count; return jsonb_build_object('success',true,'deleted',cnt);
    elsif action='checkingHandoff' then
      if not admin_ok and v_team <> 'checking' then raise exception 'Checking team access required'; end if;
      update public.mfp_documents set data=data||jsonb_build_object('currentWorkflowStatus',case when p_payload->>'outcome'='VERIFIED' then 'VERIFIED' else 'FAILED_BLOCKED' end,'checkingRecordId',p_payload->>'checkingRecordId','checkingNotes',coalesce(p_payload->>'notes',''),'updatedAt',now()),updated_at=now() where collection_name='profiles' and document_id=p_payload->>'profileId';
      return jsonb_build_object('success',true,'id',p_payload->>'checkingRecordId','status',p_payload->>'outcome');
    elsif action='claimEvidenceAssignment' then
      if not admin_ok and v_team <> 'evidence' then raise exception 'Evidence team access required'; end if;
      update public.mfp_evidence_work_items set assigned_to=uid,last_assigned_to=uid,status='ASSIGNED',assigned_at=now(),updated_at=now() where id=(p_payload->>'assignmentId')::uuid and status='AVAILABLE';
      if not found then raise exception 'Assignment is no longer available'; end if; return jsonb_build_object('success',true,'assignmentId',p_payload->>'assignmentId','status','ASSIGNED','assignedTo',uid);
    end if;
    raise exception 'Unsupported workflow action: %',action;
  end if;
  raise exception 'Unknown website service: %',p_service;
end $$;
revoke all on function public.mfp_web_api(text,jsonb) from public,anon;
grant execute on function public.mfp_web_api(text,jsonb) to authenticated;
notify pgrst,'reload schema';
-- ===================== END OF FILE =====================
