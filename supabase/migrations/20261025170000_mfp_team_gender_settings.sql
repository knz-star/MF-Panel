-- MF MPanel team-by-gender settings foundation.
-- Shared Supabase project; every team/gender combination has independent settings and a scoped lead.
-- This migration intentionally preserves existing rows and does not delete or reassign production records.

create table if not exists public.mfp_team_gender_admin_assignments (
  team_key text not null check (team_key in ('searching','checking','reports','evidence')),
  gender_group text not null check (gender_group in ('male','female')),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_key, gender_group),
  unique (admin_user_id)
);
alter table public.mfp_team_gender_admin_assignments enable row level security;
revoke all on public.mfp_team_gender_admin_assignments from public, anon, authenticated;
grant all on public.mfp_team_gender_admin_assignments to service_role;

create table if not exists public.mfp_team_gender_contact_settings (
  team_key text not null check (team_key in ('searching','checking','reports','evidence')),
  gender_group text not null check (gender_group in ('male','female')),
  whatsapp_number text not null default '',
  support_label text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (team_key, gender_group)
);
alter table public.mfp_team_gender_contact_settings enable row level security;
revoke all on public.mfp_team_gender_contact_settings from public, anon, authenticated;
grant all on public.mfp_team_gender_contact_settings to service_role;

-- Ensure every team/gender pair is represented without overwriting existing settings.
insert into public.mfp_team_gender_contact_settings(team_key, gender_group)
select t.team_key, g.gender_group
from unnest(array['searching','checking','reports','evidence']::text[]) t(team_key)
cross join unnest(array['male','female']::text[]) g(gender_group)
on conflict (team_key, gender_group) do nothing;

-- Gender-scope workflow records going forward. Existing rows are backfilled only where ownership is known.
alter table public.mfp_documents add column if not exists gender_group text check (gender_group is null or gender_group in ('male','female'));
update public.mfp_documents d
set gender_group = up.gender_group
from public.mfp_user_profiles up
where d.gender_group is null and d.owner_uid = up.user_id and up.gender_group in ('male','female');
create index if not exists mfp_documents_team_gender_collection_idx on public.mfp_documents(team_key, gender_group, collection_name, created_at desc);

alter table public.mfp_link_assignments add column if not exists gender_group text check (gender_group is null or gender_group in ('male','female'));
update public.mfp_link_assignments a set gender_group=up.gender_group from public.mfp_user_profiles up where a.gender_group is null and a.assigned_to=up.user_id and up.gender_group in ('male','female');
create index if not exists mfp_link_assignments_gender_status_idx on public.mfp_link_assignments(gender_group,status,assigned_at desc);

alter table public.mfp_checking_assignments add column if not exists gender_group text check (gender_group is null or gender_group in ('male','female'));
update public.mfp_checking_assignments a set gender_group=up.gender_group from public.mfp_user_profiles up where a.gender_group is null and a.checker_id=up.user_id and up.gender_group in ('male','female');
create index if not exists mfp_checking_assignments_gender_status_idx on public.mfp_checking_assignments(gender_group,status,assigned_at desc);

-- Scope-checked RPC for contacts and team/gender lead assignment.
create or replace function public.mfp_team_gender_settings_api(p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.mfp_user_profiles%rowtype;
  v_team text := coalesce(p_payload->>'teamKey','');
  v_gender text := coalesce(p_payload->>'genderGroup','');
  v_target uuid;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_profile from public.mfp_user_profiles where user_id=v_uid;
  if not found or v_profile.account_status <> 'ACTIVE' then raise exception 'Active MF MPanel account required'; end if;
  if p_action not in ('listContacts','saveContact','listAssignments','assignLead','removeLead') then raise exception 'Unsupported action'; end if;
  if p_action in ('saveContact','assignLead','removeLead') and (v_team not in ('searching','checking','reports','evidence') or v_gender not in ('male','female')) then raise exception 'Valid team and gender group are required'; end if;

  if p_action='listContacts' then
    if v_profile.role='ADMIN' then
      select coalesce(jsonb_agg(jsonb_build_object('team_key',c.team_key,'gender_group',c.gender_group,'whatsapp_number',c.whatsapp_number,'support_label',c.support_label,'updated_at',c.updated_at) order by c.team_key,c.gender_group),'[]'::jsonb)
      into v_result from public.mfp_team_gender_contact_settings c;
      return v_result;
    end if;
    if v_profile.team_key not in ('searching','checking','reports','evidence') or v_profile.gender_group not in ('male','female') then raise exception 'Team and gender assignment required'; end if;
    -- Regular members can read only their own team's own gender contact; team admins edit only through the scoped write check below.
    select coalesce(jsonb_agg(jsonb_build_object('team_key',c.team_key,'gender_group',c.gender_group,'whatsapp_number',c.whatsapp_number,'support_label',c.support_label,'updated_at',c.updated_at)),'[]'::jsonb)
    into v_result from public.mfp_team_gender_contact_settings c where c.team_key=v_profile.team_key and c.gender_group=v_profile.gender_group;
    return v_result;
  elsif p_action='saveContact' then
    if v_profile.role<>'ADMIN' and not exists(select 1 from public.mfp_team_gender_admin_assignments a where a.team_key=v_team and a.gender_group=v_gender and a.admin_user_id=v_uid) then raise exception 'Authorized team/gender admin required'; end if;
    if v_profile.role<>'ADMIN' and (v_profile.team_key<>v_team or v_profile.gender_group<>v_gender) then raise exception 'Cannot edit another team/gender contact'; end if;
    insert into public.mfp_team_gender_contact_settings(team_key,gender_group,whatsapp_number,support_label,updated_by,updated_at)
    values(v_team,v_gender,trim(coalesce(p_payload->>'whatsappNumber','')),left(trim(coalesce(p_payload->>'supportLabel','')),80),v_uid,now())
    on conflict(team_key,gender_group) do update set whatsapp_number=excluded.whatsapp_number,support_label=excluded.support_label,updated_by=v_uid,updated_at=now();
    return jsonb_build_object('success',true,'team_key',v_team,'gender_group',v_gender);
  elsif p_action='listAssignments' then
    if v_profile.role<>'ADMIN' then raise exception 'Senior administrator access required'; end if;
    select jsonb_build_object(
      'assignments',coalesce((select jsonb_agg(jsonb_build_object('team_key',a.team_key,'gender_group',a.gender_group,'admin_user_id',a.admin_user_id,'email',up.email,'display_name',up.display_name) order by a.team_key,a.gender_group) from public.mfp_team_gender_admin_assignments a join public.mfp_user_profiles up on up.user_id=a.admin_user_id),'[]'::jsonb),
      'eligibleAdmins',coalesce((select jsonb_agg(jsonb_build_object('user_id',up.user_id,'email',up.email,'display_name',up.display_name,'gender_group',up.gender_group) order by up.display_name) from public.mfp_user_profiles up where up.account_status='ACTIVE' and up.role in ('ADMIN','TEAM_ADMIN') and up.user_id<>v_uid),'[]'::jsonb)
    ) into v_result;
    return v_result;
  elsif p_action='assignLead' then
    if v_profile.role<>'ADMIN' then raise exception 'Senior administrator access required'; end if;
    v_target := nullif(p_payload->>'adminUserId','')::uuid;
    if v_target is null then raise exception 'Select a team administrator'; end if;
    if v_target=v_uid then raise exception 'The senior administrator cannot assign themselves as a team lead'; end if;
    if not exists(select 1 from public.mfp_user_profiles up where up.user_id=v_target and up.account_status='ACTIVE' and up.role in ('ADMIN','TEAM_ADMIN') and up.gender_group=v_gender) then raise exception 'Choose an active admin from the matching gender group'; end if;
    delete from public.mfp_team_gender_admin_assignments where admin_user_id=v_target;
    delete from public.mfp_team_admin_assignments where admin_user_id=v_target;
    delete from public.mfp_gender_team_admin_assignments where admin_user_id=v_target;
    insert into public.mfp_team_gender_admin_assignments(team_key,gender_group,admin_user_id,assigned_by,updated_at) values(v_team,v_gender,v_target,v_uid,now())
    on conflict(team_key,gender_group) do update set admin_user_id=excluded.admin_user_id,assigned_by=v_uid,updated_at=now();
    update public.mfp_user_profiles set role='TEAM_ADMIN',team_key=v_team,gender_group=v_gender,team_confirmed=true,allowed_modules=array[v_team]::text[],updated_at=now() where user_id=v_target;
    return jsonb_build_object('success',true,'team_key',v_team,'gender_group',v_gender,'admin_user_id',v_target);
  elsif p_action='removeLead' then
    if v_profile.role<>'ADMIN' then raise exception 'Senior administrator access required'; end if;
    delete from public.mfp_team_gender_admin_assignments where team_key=v_team and gender_group=v_gender;
    return jsonb_build_object('success',true,'team_key',v_team,'gender_group',v_gender);
  end if;
  raise exception 'Unsupported action';
end;
$$;
revoke all on function public.mfp_team_gender_settings_api(text,jsonb) from public, anon;
grant execute on function public.mfp_team_gender_settings_api(text,jsonb) to authenticated;
notify pgrst, 'reload schema';

-- Patch intake and workflow dispatcher in-place instead of replacing the complete API dispatcher.
-- The migration aborts if the expected known source fragments drift, rather than silently applying a partial patch.
do $patch$
declare
  v_def text;
  v_before text;
begin
  v_def := pg_get_functiondef('public.mfp_ingest_links(jsonb,boolean)'::regprocedure);
  v_before := v_def;
  v_def := replace(v_def,
    'where d.collection_name in (''profiles'',''posts'')',
    'where d.collection_name in (''profiles'',''posts'') and d.gender_group = p.gender_group');
  v_def := replace(v_def,
    'insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key)',
    'insert into public.mfp_documents(collection_name,document_id,data,owner_uid,team_key,gender_group)');
  v_def := replace(v_def, 'uid,''searching'')', 'uid,''searching'',p.gender_group)');
  v_def := replace(v_def,
    '    if link_type=''POST'' then',
    '    if upper(coalesce(rec.item->>''urlType'',''''))=''UNKNOWN'' and link_type<>''POST'' then invalid:=invalid+1; continue; end if;'||E'\n'||'    if link_type=''POST'' then');
  if v_def = v_before or position('d.gender_group = p.gender_group' in v_def)=0 or position('team_key,gender_group' in v_def)=0 then
    raise exception 'Could not safely patch mfp_ingest_links; review migration against current function definition';
  end if;
  execute v_def;

  v_def := pg_get_functiondef('public.mfp_web_api(text,jsonb)'::regprocedure);
  v_before := v_def;
  -- Candidate selection and all direct document scopes in the shared dispatcher are gender-filtered for non-senior-admins.
  v_def := replace(v_def,
    'where d.collection_name=''profiles'' and (',
    'where d.collection_name=''profiles'' and (admin_ok or d.gender_group=p.gender_group) and (');
  v_def := replace(v_def,
    'where d.collection_name=''profiles'' and nullif',
    'where d.collection_name=''profiles'' and (admin_ok or d.gender_group=p.gender_group) and nullif');
  v_def := replace(v_def,
    'where d.collection_name=''posts'' and ',
    'where d.collection_name=''posts'' and (admin_ok or d.gender_group=p.gender_group) and ');
  v_def := replace(v_def,
    'where d.team_key=v_team',
    'where d.team_key=v_team and (admin_ok or d.gender_group=p.gender_group)');
  v_def := replace(v_def,
    'from public.mfp_link_assignments where status=''PENDING''',
    'from public.mfp_link_assignments where status=''PENDING'' and (admin_ok or gender_group=p.gender_group)');
  v_def := replace(v_def,
    'insert into public.mfp_link_assignments(source_profile_id,canonical_url,platform,assigned_to,source_data)',
    'insert into public.mfp_link_assignments(source_profile_id,canonical_url,platform,assigned_to,gender_group,source_data)');
  v_def := replace(v_def,
    'select document_id,url,platform,uid,data from candidates',
    'select document_id,url,platform,uid,p.gender_group,data from candidates');
  v_def := replace(v_def,
    'insert into public.mfp_checking_assignments(profile_id,checker_id,batch_id) select document_id,uid,batch_uuid from candidates',
    'insert into public.mfp_checking_assignments(profile_id,checker_id,batch_id,gender_group) select document_id,uid,batch_uuid,p.gender_group from candidates');
  if v_def = v_before or position('admin_ok or d.gender_group=p.gender_group' in v_def)=0 then
    raise exception 'Could not safely patch mfp_web_api gender scopes; review migration against current function definition';
  end if;
  execute v_def;
end;
$patch$;

notify pgrst, 'reload schema';
