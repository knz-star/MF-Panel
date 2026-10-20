-- MF MPanel Step 1: signup gender metadata and stable profile/post identifiers.
-- Additive migration: does not touch legacy MF Links tables or Android source.
create schema if not exists mfp_private;
revoke all on schema mfp_private from public, anon;
grant usage on schema mfp_private to authenticated;

alter table public.mfp_user_profiles add column if not exists gender text;
alter table public.mfp_user_profiles add column if not exists gender_group text;
alter table public.mfp_user_profiles drop constraint if exists mfp_user_profiles_gender_check;
alter table public.mfp_user_profiles add constraint mfp_user_profiles_gender_check check (gender is null or gender in ('male','female'));
alter table public.mfp_user_profiles drop constraint if exists mfp_user_profiles_gender_group_check;
alter table public.mfp_user_profiles add constraint mfp_user_profiles_gender_group_check check (gender_group is null or gender_group in ('male','female'));

-- Stable identity registry: internal document IDs remain unchanged for compatibility.
create sequence if not exists mfp_private.mfp_profile_public_id_seq start 1;
create table if not exists mfp_private.profile_identity_registry (
  profile_document_id text primary key,
  public_profile_id text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists mfp_private.post_identity_registry (
  post_document_id text primary key,
  profile_ref text not null,
  post_number bigint not null,
  public_post_id text not null,
  created_at timestamptz not null default now(),
  unique(profile_ref, post_number),
  unique(post_document_id, public_post_id)
);
create index if not exists mfp_post_identity_profile_idx on mfp_private.post_identity_registry(profile_ref, post_number);
revoke all on all tables in schema mfp_private from public, anon, authenticated;
revoke all on all sequences in schema mfp_private from public, anon, authenticated;

create or replace function mfp_private.assign_public_link_ids()
returns trigger language plpgsql security definer set search_path=public,mfp_private,pg_temp as $$
declare
  v_profile_id text;
  v_profile_ref text;
  v_internal_profile_ref text;
  v_post_no bigint;
  v_public_post_id text;
begin
  if new.collection_name = 'profiles' and coalesce(new.data->>'canonicalUrl', new.data->>'originalUrl', new.data->>'url') is not null then
    select public_profile_id into v_profile_id from mfp_private.profile_identity_registry where profile_document_id = new.document_id;
    if v_profile_id is null then
      v_profile_id := 'MFP' || lpad(nextval('mfp_private.mfp_profile_public_id_seq')::text, 16, '0');
      insert into mfp_private.profile_identity_registry(profile_document_id, public_profile_id)
      values (new.document_id, v_profile_id)
      on conflict(profile_document_id) do update set profile_document_id = excluded.profile_document_id
      returning public_profile_id into v_profile_id;
    end if;
    new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{mfpProfileId}', to_jsonb(v_profile_id), true);
  elsif new.collection_name = 'posts' and coalesce(new.data->>'canonicalUrl', new.data->>'originalUrl', new.data->>'url') is not null then
    v_profile_ref := coalesce(nullif(new.data->>'profileId',''), nullif(new.data->>'mfpProfileId',''), 'UNLINKED:' || new.document_id);
    select profile_document_id, public_profile_id into v_internal_profile_ref, v_profile_id
      from mfp_private.profile_identity_registry
      where profile_document_id = v_profile_ref or public_profile_id = v_profile_ref
      limit 1;
    if v_internal_profile_ref is not null then
      v_profile_ref := v_internal_profile_ref;
      new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{mfpProfileId}', to_jsonb(v_profile_id), true);
    end if;
    select public_post_id into v_public_post_id from mfp_private.post_identity_registry where post_document_id = new.document_id;
    if v_public_post_id is null then
      -- Serialize numbering per profile to avoid two concurrent inserts receiving the same MFP1/MFP2 label.
      perform pg_advisory_xact_lock(hashtext(v_profile_ref));
      select post_number into v_post_no from mfp_private.post_identity_registry where post_document_id = new.document_id;
      if v_post_no is null then
        select coalesce(max(post_number), 0) + 1 into v_post_no from mfp_private.post_identity_registry where profile_ref = v_profile_ref;
        v_public_post_id := 'MFP' || v_post_no::text;
        insert into mfp_private.post_identity_registry(post_document_id, profile_ref, post_number, public_post_id)
        values (new.document_id, v_profile_ref, v_post_no, v_public_post_id)
        on conflict(post_document_id) do update set post_document_id = excluded.post_document_id
        returning public_post_id into v_public_post_id;
      end if;
    end if;
    new.data := jsonb_set(coalesce(new.data, '{}'::jsonb), '{mfpPostId}', to_jsonb(v_public_post_id), true);
  end if;
  return new;
end; $$;
revoke all on function mfp_private.assign_public_link_ids() from public, anon, authenticated;
drop trigger if exists mfp_assign_public_link_ids on public.mfp_documents;
create trigger mfp_assign_public_link_ids before insert or update of data on public.mfp_documents
for each row execute function mfp_private.assign_public_link_ids();

-- Keep gender immutable for ordinary users after signup; admins can correct it.
create or replace function mfp_private.protect_profile_gender()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  if auth.uid() is not null and auth.uid() = old.user_id and not mfp_private.is_admin() then
    new.gender := old.gender;
  end if;
  new.gender_group := new.gender;
  return new;
end; $$;
revoke all on function mfp_private.protect_profile_gender() from public, anon, authenticated;
drop trigger if exists mfp_protect_profile_gender on public.mfp_user_profiles;
create trigger mfp_protect_profile_gender before update on public.mfp_user_profiles
for each row execute function mfp_private.protect_profile_gender();

-- Replace auth-user trigger function to copy signup gender into the canonical row.
create or replace function public.mfp_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_gender text;
begin
  v_gender := case when new.raw_user_meta_data->>'gender' in ('male','female') then new.raw_user_meta_data->>'gender' else null end;
  insert into public.mfp_user_profiles(user_id,email,display_name,role,account_status,gender,gender_group)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(coalesce(new.email,'user'),'@',1)),'USER','ACTIVE',v_gender,v_gender)
  on conflict(user_id) do nothing;
  return new;
end; $$;
revoke all on function public.mfp_handle_new_auth_user() from public, anon, authenticated;

-- Existing authenticated profiles without a stored gender are backfilled from signup metadata only once.
update public.mfp_user_profiles p
set gender = case when u.raw_user_meta_data->>'gender' in ('male','female') then u.raw_user_meta_data->>'gender' else null end,
    gender_group = case when u.raw_user_meta_data->>'gender' in ('male','female') then u.raw_user_meta_data->>'gender' else null end
from auth.users u
where u.id = p.user_id and p.gender is null;

-- Backfill public IDs on existing link documents. Internal IDs are preserved.
update public.mfp_documents set data = data where collection_name = 'profiles';
update public.mfp_documents set data = data where collection_name = 'posts';

comment on column public.mfp_user_profiles.gender is 'Signup selection; used for team routing and not a standalone authorization grant.';
comment on column public.mfp_user_profiles.gender_group is 'Derived grouping value (male/female); team permissions remain controlled by role and team_key.';

create or replace function public.mfp_ensure_profile()
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare uid uuid:=auth.uid(); u auth.users%rowtype; p public.mfp_user_profiles%rowtype; v_gender text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select * into u from auth.users where id=uid;
  if not found then raise exception 'Authenticated account not found'; end if;
  v_gender := case when u.raw_user_meta_data->>'gender' in ('male','female') then u.raw_user_meta_data->>'gender' else null end;
  insert into public.mfp_user_profiles(user_id,email,display_name,role,account_status,gender,gender_group)
  values(uid,u.email,coalesce(u.raw_user_meta_data->>'full_name',split_part(coalesce(u.email,'user'),'@',1)),'USER','ACTIVE',v_gender,v_gender)
  on conflict(user_id) do nothing;
  select * into p from public.mfp_user_profiles where user_id=uid;
  return jsonb_build_object('user_id',p.user_id,'email',p.email,'display_name',p.display_name,'role',p.role,'account_status',p.account_status,'team_key',p.team_key,'team_confirmed',p.team_confirmed,'allowed_modules',p.allowed_modules,'gender',p.gender,'gender_group',p.gender_group);
end; $$;
revoke all on function public.mfp_ensure_profile() from public, anon;
grant execute on function public.mfp_ensure_profile() to authenticated;
update public.mfp_user_profiles
set gender_group = gender
where gender_group is distinct from gender;
