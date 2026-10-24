-- Admin operations remain separate from student payments and the teacher's own role.
begin;
alter table public.teachers add column access_suspended boolean not null default false;
alter table public.teachers add column access_revision bigint not null default 0;
create table private.platform_operators (
 email text primary key check(email=lower(email)),
 enabled boolean not null default true
);
create table private.platform_access_audit (
 operation_id uuid primary key,
 teacher_id uuid not null references public.teachers(id),
 actor text not null,
 reason text not null,
 before_state jsonb not null,
 after_state jsonb not null,
 created_at timestamptz not null default now()
);
alter table private.platform_operators enable row level security;
alter table private.platform_access_audit enable row level security;
revoke all on private.platform_operators,private.platform_access_audit from public,anon,authenticated;

create function public.manage_teacher_access(p_teacher uuid,p_actor text,p_plan text,p_suspended boolean,p_revision bigint,p_operation uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_row public.teachers; new_row public.teachers; previous private.platform_access_audit;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege; end if;
 if not exists(select 1 from private.platform_operators where email=p_actor and enabled) then raise insufficient_privilege; end if;
 if p_plan is null or p_plan not in ('essential','plus','pro') or p_suspended is null or p_revision is null or p_revision<0 or p_operation is null or p_reason is null or length(trim(p_reason)) not between 5 and 500 then
  raise exception 'Invalid management request' using errcode='22023';
 end if;
 select * into old_row from public.teachers where id=p_teacher for update;
 if not found then raise exception 'Account not found' using errcode='P0002'; end if;
 select * into previous from private.platform_access_audit where operation_id=p_operation;
 if found then
  if previous.teacher_id<>p_teacher or previous.actor<>p_actor or previous.after_state->>'platform_plan'<>p_plan or (previous.after_state->>'access_suspended')::boolean<>p_suspended or previous.reason<>trim(p_reason) then
   raise exception 'Operation already used' using errcode='22023';
  end if;
  return previous.after_state;
 end if;
 if old_row.access_revision<>p_revision then raise exception 'Account changed. Reload before saving.' using errcode='40001'; end if;
 if p_suspended and lower(old_row.email)=p_actor then raise exception 'Cannot suspend your own account' using errcode='22023'; end if;
 update public.teachers set platform_plan=p_plan,access_suspended=p_suspended,access_revision=access_revision+1 where id=p_teacher returning * into new_row;
 insert into private.platform_access_audit(operation_id,teacher_id,actor,reason,before_state,after_state)
 values(p_operation,p_teacher,p_actor,trim(p_reason),jsonb_build_object('platform_plan',old_row.platform_plan,'access_suspended',old_row.access_suspended,'access_revision',old_row.access_revision),jsonb_build_object('platform_plan',new_row.platform_plan,'access_suspended',new_row.access_suspended,'access_revision',new_row.access_revision));
 return jsonb_build_object('platform_plan',new_row.platform_plan,'access_suspended',new_row.access_suspended,'access_revision',new_row.access_revision);
end;
$$;
revoke all on function public.manage_teacher_access(uuid,text,text,boolean,bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.manage_teacher_access(uuid,text,text,boolean,bigint,uuid,text) to service_role;

-- Existing restrictive policies and the Data API pre-request share this check.
create or replace function private.teacher_session_valid() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s
  where s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid()
   and s.created_at+interval '24 hours'>now() and (s.not_after is null or s.not_after>now())
   and not exists(select 1 from public.teachers t where t.id=s.user_id and t.access_suspended));
$$;
-- Refuse refresh/new access tokens for suspended teachers as well as existing tokens via RLS.
create or replace function public.teacher_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=event->'claims'; deadline bigint;
begin
 if exists(select 1 from public.teachers where id=(event->>'user_id')::uuid and access_suspended) then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Account access suspended. Contact support.'));
 end if;
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
revoke all on function private.teacher_session_valid() from public,anon;
grant execute on function private.teacher_session_valid() to authenticated;
revoke all on function public.teacher_access_token_hook(jsonb) from public,anon,authenticated;
grant execute on function public.teacher_access_token_hook(jsonb) to supabase_auth_admin;
notify pgrst,'reload schema';
commit;
