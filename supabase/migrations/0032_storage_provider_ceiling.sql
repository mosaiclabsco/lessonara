-- Keep the effective application and SQL limit aligned with Supabase Free.
-- Product entitlement remains 100 MB for Pro; raise the provider ceiling only after an actual provider upgrade.
begin;
create or replace function public.platform_storage_limits(p_teacher uuid) returns table(max_file_bytes bigint,storage_bytes bigint) language sql stable security definer set search_path='' as $$
 select least(case platform_plan when 'pro' then 104857600 when 'plus' then 52428800 else 20971520 end,52428800)::bigint,
 case platform_plan when 'pro' then 10737418240 when 'plus' then 5368709120 else 1073741824 end::bigint
 from public.teachers where id=p_teacher;
$$;
revoke all on function public.platform_storage_limits(uuid) from public,anon,authenticated;
grant execute on function public.platform_storage_limits(uuid) to service_role;
notify pgrst,'reload schema';
commit;
