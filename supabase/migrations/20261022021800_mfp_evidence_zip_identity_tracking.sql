-- Store evidence references and identity metadata only. Screenshot bytes are never inserted into these tables.
create unique index if not exists mfp_link_screenshot_ids_uid_uq
  on public.mfp_link_screenshot_ids (screenshot_uid);

create or replace function public.mfp_evidence_zip_metadata(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
  profile public.mfp_user_profiles%rowtype;
  rec jsonb;
  shot jsonb;
  assn public.mfp_link_assignments%rowtype;
  matched integer := 0;
  saved integer := 0;
  unmatched integer := 0;
  shot_count integer := 0;
  job_id text := coalesce(nullif(p_payload->>'reportJobId',''), 'ZIP-' || extract(epoch from now())::bigint::text);
  result_rows jsonb := '[]'::jsonb;
  assigned_name text;
  assigned_email text;
  normalized_url text;
  screenshot_uid text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into profile from public.mfp_user_profiles where user_id=uid;
  if not found or profile.account_status <> 'ACTIVE' then raise exception 'Active MF MPanel account required'; end if;

  if p_action = 'tracker' then
    if profile.role <> 'ADMIN' then raise exception 'Administrator access required'; end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by x.recorded_at desc), '[]'::jsonb)
      into result_rows
    from (
      select s.id, s.screenshot_uid, s.assignment_id, s.link_id, s.source_profile_id,
             s.mfp_profile_id, s.post_ids, s.file_name, s.sha256, s.captured_at,
             s.report_job_id, s.verification_status, s.verification_notes,
             s.assigned_to, s.assigned_to_name, s.assigned_to_email,
             s.recorded_by, s.recorded_at, a.canonical_url, a.platform, a.status as assignment_status
      from public.mfp_link_screenshot_ids s
      left join public.mfp_link_assignments a on a.id=s.assignment_id
      order by s.recorded_at desc limit 1000
    ) x;
    return jsonb_build_object('success', true, 'records', result_rows, 'count', jsonb_array_length(result_rows), 'imagesStored', false);
  elsif p_action <> 'ingest' then
    raise exception 'Unsupported evidence metadata action';
  end if;

  if profile.role <> 'ADMIN' then raise exception 'Administrator access required for ZIP evidence reconciliation'; end if;
  if jsonb_typeof(coalesce(p_payload->'records','[]'::jsonb)) <> 'array' then raise exception 'ZIP metadata records must be an array'; end if;

  for rec in select value from jsonb_array_elements(coalesce(p_payload->'records','[]'::jsonb)) loop
    normalized_url := public.mfp_normalize_link_url(coalesce(rec->>'url',''));
    if normalized_url = '' then unmatched := unmatched + 1; continue; end if;
    select * into assn from public.mfp_link_assignments a
      where a.canonical_url=normalized_url
      for update;
    if not found then unmatched := unmatched + 1; continue; end if;

    select coalesce(up.display_name, up.email, assn.assigned_to::text), up.email
      into assigned_name, assigned_email
      from public.mfp_user_profiles up where up.user_id=assn.assigned_to;
    matched := matched + 1;

    insert into public.mfp_link_upload_receipts(assignment_id, uploaded_by, report_job_id, matched_url)
      values(assn.id, uid, job_id, assn.canonical_url)
      on conflict(assignment_id, report_job_id) do nothing;
    update public.mfp_link_assignments set status='RECEIVED', received_at=coalesce(received_at,now()), report_job_id=coalesce(report_job_id,job_id)
      where id=assn.id and status='PENDING';

    for shot in select value from jsonb_array_elements(coalesce(rec->'screenshots','[]'::jsonb)) loop
      screenshot_uid := left(coalesce(nullif(shot->>'screenshotId',''), nullif(shot->>'screenshot_id',''), nullif(shot->>'id','')), 200);
      if screenshot_uid is null or screenshot_uid = '' then continue; end if;
      insert into public.mfp_link_screenshot_ids(
        screenshot_uid, assignment_id, link_id, source_profile_id, mfp_profile_id,
        post_ids, file_name, sha256, captured_at, report_job_id, verification_status,
        verification_notes, assigned_to, assigned_to_name, assigned_to_email, recorded_by
      ) values (
        screenshot_uid, assn.id, coalesce(nullif(rec->>'linkId',''), assn.id::text),
        coalesce(nullif(rec->>'sourceProfileId',''), assn.source_profile_id),
        coalesce(nullif(rec->>'mfpProfileId',''), nullif(rec->>'profileId','')),
        array(select jsonb_array_elements_text(coalesce(rec->'postIds','[]'::jsonb))),
        nullif(shot->>'fileName',''), nullif(shot->>'sha256Checksum',''),
        case when nullif(shot->>'capturedAt','') is not null then to_timestamp((shot->>'capturedAt')::double precision / 1000.0) else null end,
        job_id, case when rec->>'verificationStatus'='VERIFIED' then 'VERIFIED' else 'NEEDS_REVIEW' end,
        nullif(rec->>'verificationNotes',''), assn.assigned_to, assigned_name, assigned_email, uid
      ) on conflict(screenshot_uid) do nothing;
      shot_count := shot_count + 1;
    end loop;
    saved := saved + 1;
  end loop;

  return jsonb_build_object('success',true,'reportJobId',job_id,'matchedLinks',matched,
    'savedLinks',saved,'unmatchedLinks',unmatched,'screenshotIdsProcessed',shot_count,
    'imagesStored',false,'message','Only screenshot IDs and metadata were stored; image files were not uploaded to the database.');
end;
$$;

revoke all on function public.mfp_evidence_zip_metadata(text,jsonb) from public, anon;
grant execute on function public.mfp_evidence_zip_metadata(text,jsonb) to authenticated;
