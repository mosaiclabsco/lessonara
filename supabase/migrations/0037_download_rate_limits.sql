begin;
create function public.check_download_limit(p_keys text[],p_limits integer[],p_seconds integer[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare allowed boolean;retry integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if p_keys is null or cardinality(p_keys) not between 1 and 6 or cardinality(p_keys) is distinct from cardinality(p_limits) or cardinality(p_keys) is distinct from cardinality(p_seconds)
  or exists(select 1 from unnest(p_keys,p_limits,p_seconds) as i(key,lim,secs) where i.key is null or length(i.key) not between 1 and 512 or i.lim is null or i.lim not between 1 and 10000 or i.secs is null or i.secs not between 1 and 86400) then raise exception 'Invalid limits';end if;
 allowed:=public.allow_student_auth(p_keys,p_limits,p_seconds);
 if allowed then return jsonb_build_object('allowed',true,'retry_after',0);end if;
 select greatest(1,coalesce(max(ceil(extract(epoch from (r.window_start+make_interval(secs=>i.secs)-now()))))::integer,1)) into retry
 from unnest(p_keys,p_limits,p_seconds) as i(key,lim,secs) join public.student_auth_limits r on r.key=i.key where r.count>i.lim;
 return jsonb_build_object('allowed',false,'retry_after',retry);
end;$$;
revoke all on function public.check_download_limit(text[],integer[],integer[]) from public,anon,authenticated;
grant execute on function public.check_download_limit(text[],integer[],integer[]) to service_role;
notify pgrst,'reload schema';
commit;
