-- Absolute session lifetime must also apply to direct Data API, Storage and token refresh.
begin;
create or replace function private.teacher_session_valid() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from auth.sessions s
  where s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid()
   and s.created_at+interval '24 hours'>now()
   and (s.not_after is null or s.not_after>now())
 );
$$;
revoke all on function private.teacher_session_valid() from public,anon;
grant execute on function private.teacher_session_valid() to authenticated;
create or replace function public.teacher_session_valid() returns boolean
language sql stable security invoker set search_path='' as $$ select private.teacher_session_valid(); $$;
revoke all on function public.teacher_session_valid() from public,anon;
grant execute on function public.teacher_session_valid() to authenticated;

create or replace function public.check_teacher_session() returns void
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.role()='authenticated' then
  if not private.teacher_session_valid() then
   raise sqlstate 'PT401' using message='Session expired. Sign in again.';
  end if;
 end if;
end;
$$;
revoke all on function public.check_teacher_session() from public;
grant execute on function public.check_teacher_session() to anon,authenticated,service_role;
-- Refuse to replace an unrelated pre-request control.
do $$ begin
 if exists(select 1 from pg_catalog.pg_roles r,unnest(r.rolconfig) c where r.rolname='authenticator' and c like 'pgrst.db_pre_request=%' and c not in ('pgrst.db_pre_request=','pgrst.db_pre_request=public.check_teacher_session')) then
  raise exception 'An existing pre-request function must be composed before applying this migration.';
 end if;
end; $$;
alter role authenticator set pgrst.db_pre_request='public.check_teacher_session';

-- Restrictive policies preserve ownership rules and cover consumers outside PostgREST.
do $$ declare t record; begin
 for t in select n.nspname,c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where c.relrowsecurity and c.relkind='r' and n.nspname='public'
 loop
  execute format('drop policy if exists "teacher session lifetime" on %I.%I',t.nspname,t.relname);
  execute format('create policy "teacher session lifetime" on %I.%I as restrictive for all to authenticated using ((select private.teacher_session_valid())) with check ((select private.teacher_session_valid()))',t.nspname,t.relname);
 end loop;
end; $$;
drop policy if exists "teacher session lifetime" on storage.objects;
create policy "teacher session lifetime" on storage.objects as restrictive for all to authenticated
 using ((select private.teacher_session_valid())) with check ((select private.teacher_session_valid()));

create or replace function public.teacher_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=event->'claims'; deadline bigint;
begin
 select floor(extract(epoch from least(s.created_at+interval '24 hours',coalesce(s.not_after,'infinity'::timestamptz))))::bigint into deadline
 from auth.sessions s where s.id=(claims->>'session_id')::uuid and s.user_id=(event->>'user_id')::uuid;
 if deadline is null or deadline<=extract(epoch from now()) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Session expired. Sign in again.'));
 end if;
 claims:=jsonb_set(claims,'{session_expires_at}',to_jsonb(deadline));
 claims:=jsonb_set(claims,'{exp}',to_jsonb(least((claims->>'exp')::bigint,deadline)));
 return jsonb_build_object('claims',claims);
end;
$$;
revoke all on function public.teacher_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.teacher_access_token_hook(jsonb) to supabase_auth_admin;
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
