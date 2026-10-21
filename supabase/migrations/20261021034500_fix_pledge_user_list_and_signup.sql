-- Preserve pending status for self-created profiles; bootstrap a canonical row at signup.
create or replace function public.mfp_protect_user_profile()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
begin
  if auth.uid() is not null and not mfp_private.is_admin() then
    if tg_op='INSERT' then
      if new.user_id<>auth.uid() then raise exception 'Cannot create another user profile'; end if;
      new.role:='USER'; new.account_status:='PENDING'; new.team_key:=null; new.team_confirmed:=false; new.allowed_modules:='{}'::text[];
    else
      if new.user_id<>old.user_id then raise exception 'User id cannot be changed'; end if;
      new.role:=old.role; new.account_status:=old.account_status;
      if old.team_confirmed then new.team_key:=old.team_key; new.team_confirmed:=old.team_confirmed; new.allowed_modules:=old.allowed_modules;
      else new.team_key:=null; new.team_confirmed:=false; new.allowed_modules:='{}'::text[]; end if;
    end if;
  end if;
  new.updated_at:=now(); return new;
end; $$;

create or replace function public.mfp_handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare v_gender text;
begin
  v_gender:=case when new.raw_user_meta_data->>'gender' in ('male','female') then new.raw_user_meta_data->>'gender' else null end;
  insert into public.mfp_user_profiles(user_id,email,display_name,role,account_status,team_key,team_confirmed,allowed_modules,gender,gender_group,preferences)
  values(new.id,lower(new.email),coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(coalesce(new.email,'user'),'@',1)),'USER','PENDING',null,false,'{}'::text[],v_gender,v_gender,'{}'::jsonb)
  on conflict(user_id) do nothing;
  return new;
end; $$;
drop trigger if exists mfp_auth_user_profile_bootstrap on auth.users;
create trigger mfp_auth_user_profile_bootstrap after insert on auth.users for each row execute function public.mfp_handle_new_auth_user();

insert into public.mfp_user_profiles(user_id,email,display_name,role,account_status,team_key,team_confirmed,allowed_modules,gender,gender_group,preferences)
select u.id,lower(u.email),coalesce(nullif(u.raw_user_meta_data->>'full_name',''),split_part(coalesce(u.email,'user'),'@',1)),'USER','PENDING',null,false,'{}'::text[],
case when u.raw_user_meta_data->>'gender' in ('male','female') then u.raw_user_meta_data->>'gender' else null end,
case when u.raw_user_meta_data->>'gender' in ('male','female') then u.raw_user_meta_data->>'gender' else null end,'{}'::jsonb
from auth.users u where not exists(select 1 from public.mfp_user_profiles p where p.user_id=u.id) on conflict(user_id) do nothing;

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
