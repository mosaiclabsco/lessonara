begin;
create table private.support_challenges (
 id uuid primary key, actor text not null, admin_session uuid not null,
 teacher_id uuid not null references public.teachers(id) on delete cascade,
 code_hash text not null check(length(code_hash)=64),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '5 minutes',
 attempts integer not null default 0, used_at timestamptz
);
create index support_challenges_actor_time on private.support_challenges(actor,created_at);
create table private.support_grants (
 id uuid primary key default gen_random_uuid(), challenge_id uuid not null unique references private.support_challenges(id),
 token_hash text not null unique check(length(token_hash)=64),teacher_id uuid not null references public.teachers(id) on delete cascade,
 actor text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '2 minutes', consumed_at timestamptz,
 session_id uuid unique, session_expires_at timestamptz, ended_at timestamptz
);
alter table private.support_challenges enable row level security;
alter table private.support_grants enable row level security;
revoke all on private.support_challenges,private.support_grants from public,anon,authenticated;

create function public.request_support_challenge(p_id uuid,p_actor text,p_admin_session uuid,p_teacher uuid,p_code_hash text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from private.platform_operators where email=p_actor and enabled) then raise insufficient_privilege;end if;
 if p_admin_session is null or p_id is null or p_code_hash is null or p_code_hash!~'^[a-f0-9]{64}$' then raise exception 'Invalid request';end if;
 -- Serialize requests for this operator, including first-use races.
 perform pg_advisory_xact_lock(hashtextextended('support/'||p_actor,0));
 if not exists(select 1 from public.teachers where id=p_teacher and not access_suspended) then raise exception 'Professor indisponível para suporte.';end if;
 if exists(select 1 from private.support_challenges where actor=p_actor and created_at>now()-interval '1 minute') or (select count(*) from private.support_challenges where actor=p_actor and created_at>now()-interval '1 hour')>=10 then raise exception 'Aguarde antes de pedir outro código.';end if;
 update private.support_challenges set used_at=now() where actor=p_actor and used_at is null;
 insert into private.support_challenges(id,actor,admin_session,teacher_id,code_hash) values(p_id,p_actor,p_admin_session,p_teacher,p_code_hash);
end;$$;

create function public.verify_support_challenge(p_id uuid,p_actor text,p_admin_session uuid,p_teacher uuid,p_code_hash text,p_token_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare challenge private.support_challenges;
begin
 if auth.role() is distinct from 'service_role' or not exists(select 1 from private.platform_operators where email=p_actor and enabled) then raise insufficient_privilege;end if;
 select * into challenge from private.support_challenges where id=p_id and actor=p_actor and admin_session=p_admin_session and teacher_id=p_teacher for update;
 if not found or challenge.used_at is not null or challenge.expires_at<=now() or challenge.attempts>=5 then return false;end if;
 update private.support_challenges set attempts=attempts+1 where id=challenge.id;
 if p_code_hash is distinct from challenge.code_hash then return false;end if;
 if p_token_hash is null or p_token_hash!~'^[a-f0-9]{64}$' then return false;end if;
 if not exists(select 1 from public.teachers where id=p_teacher and not access_suspended) then return false;end if;
 update private.support_challenges set used_at=now() where id=challenge.id;
 insert into private.support_grants(challenge_id,token_hash,teacher_id,actor) values(challenge.id,p_token_hash,p_teacher,p_actor);
 return true;
end;$$;

create function public.consume_support_grant(p_token_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare g private.support_grants; email_address text;
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 select * into g from private.support_grants where token_hash=p_token_hash for update;
 if not found or g.consumed_at is not null or g.expires_at<=now() then return null;end if;
 if not exists(select 1 from private.platform_operators where email=g.actor and enabled) then return null;end if;
 select email into email_address from public.teachers where id=g.teacher_id and not access_suspended;
 if not found then return null;end if;
 update private.support_grants set consumed_at=now() where id=g.id;
 return jsonb_build_object('id',g.id,'teacher_id',g.teacher_id,'email',email_address,'actor',g.actor);
end;$$;

create function public.bind_support_session(p_grant_id uuid,p_session_id uuid) returns timestamptz
language plpgsql security definer set search_path='' as $$
declare g private.support_grants; deadline timestamptz:=now()+interval '15 minutes';
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 select * into g from private.support_grants where id=p_grant_id for update;
 if not found or g.consumed_at is null or g.consumed_at<now()-interval '1 minute' or g.session_id is not null then raise insufficient_privilege;end if;
 if not exists(select 1 from auth.sessions where id=p_session_id and user_id=g.teacher_id and created_at>=g.consumed_at-interval '5 seconds') then raise insufficient_privilege;end if;
 update private.support_grants set session_id=p_session_id,session_expires_at=deadline where id=g.id;
 return deadline;
end;$$;

create function public.end_support_session() returns void language plpgsql security definer set search_path='' as $$
begin
 update private.support_grants set ended_at=coalesce(ended_at,now()) where session_id=nullif(auth.jwt()->>'session_id','')::uuid and teacher_id=auth.uid();
end;$$;
revoke all on function public.end_support_session() from public,anon;
grant execute on function public.end_support_session() to authenticated;

create or replace function private.teacher_session_valid() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.sessions s
 where s.id=nullif(auth.jwt()->>'session_id','')::uuid and s.user_id=auth.uid()
 and s.created_at+interval '24 hours'>now() and (s.not_after is null or s.not_after>now())
 and not exists(select 1 from public.teachers t where t.id=s.user_id and t.access_suspended)
 and not exists(select 1 from private.support_grants g where g.session_id=s.id and (g.session_expires_at<=now() or g.ended_at is not null or not exists(select 1 from private.platform_operators op where op.email=g.actor and op.enabled))));
$$;
create or replace function public.teacher_access_token_hook(event jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare claims jsonb:=event->'claims'; deadline bigint; support private.support_grants;
begin
 if exists(select 1 from public.teachers where id=(event->>'user_id')::uuid and access_suspended) then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Account access suspended. Contact support.'));end if;
 select floor(extract(epoch from least(s.created_at+interval '24 hours',coalesce(s.not_after,'infinity'::timestamptz))))::bigint into deadline from auth.sessions s where s.id=(claims->>'session_id')::uuid and s.user_id=(event->>'user_id')::uuid;
 select * into support from private.support_grants where session_id=(claims->>'session_id')::uuid;
 if found then
  if support.ended_at is not null or not exists(select 1 from private.platform_operators where email=support.actor and enabled) then deadline:=0;
  else deadline:=least(deadline,floor(extract(epoch from support.session_expires_at))::bigint);end if;
  claims:=jsonb_set(claims,'{support_actor}',to_jsonb(support.actor));
 end if;
 if deadline is null or deadline<=extract(epoch from now()) then return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Session expired. Sign in again.'));end if;
 claims:=jsonb_set(claims,'{session_expires_at}',to_jsonb(deadline));
 claims:=jsonb_set(claims,'{exp}',to_jsonb(least((claims->>'exp')::bigint,deadline)));
 return jsonb_build_object('claims',claims);
end;$$;
revoke all on function public.request_support_challenge(uuid,text,uuid,uuid,text),public.verify_support_challenge(uuid,text,uuid,uuid,text,text),public.consume_support_grant(text),public.bind_support_session(uuid,uuid) from public,anon,authenticated;
grant execute on function public.request_support_challenge(uuid,text,uuid,uuid,text),public.verify_support_challenge(uuid,text,uuid,uuid,text,text),public.consume_support_grant(text),public.bind_support_session(uuid,uuid) to service_role;
-- Keep consumed grants as audit records: deleting their session mapping could extend old tokens.
commit;
