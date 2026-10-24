begin;

create schema if not exists private;
create table private.job_runs(
 id uuid primary key default gen_random_uuid(),job_key text not null check(job_key in ('renewals','emails','calendar','cleanup')),
 status text not null default 'running' check(status in ('running','succeeded','failed','skipped')),
 started_at timestamptz not null default now(),finished_at timestamptz,
 metrics jsonb not null default '{}',error_code text
);
create index job_runs_latest on private.job_runs(job_key,started_at desc);
alter table private.job_runs enable row level security;
revoke all on private.job_runs from public,anon,authenticated,service_role;
create function public.start_job_run(p_job text) returns uuid language plpgsql security definer set search_path='' as $$
declare run_id uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if p_job is null or p_job not in ('renewals','emails','calendar','cleanup') then raise exception 'Unknown job';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lessonara-job:'||p_job));
 update private.job_runs set status='failed',finished_at=now(),error_code='lease_expired' where job_key=p_job and status='running' and started_at<now()-interval '2 minutes';
 if exists(select 1 from private.job_runs where job_key=p_job and status='running') then return null;end if;
 insert into private.job_runs(job_key) values(p_job) returning id into run_id;
 delete from private.job_runs where started_at<now()-interval '30 days' and status<>'running';
 return run_id;
end;$$;
create function public.finish_job_run(p_id uuid,p_status text,p_metrics jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if p_status is null or p_status not in ('succeeded','failed','skipped') or jsonb_typeof(p_metrics) is distinct from 'object' or pg_column_size(p_metrics)>4096 or exists(select 1 from jsonb_each(p_metrics) e where jsonb_typeof(e.value) not in ('number','boolean')) then raise exception 'Invalid job result';end if;
 update private.job_runs set status=p_status,finished_at=now(),metrics=p_metrics,error_code=case when p_status='failed' then 'worker_failed' end where id=p_id and status='running';
 if not found then raise exception 'Job lease lost';end if;
end;$$;
revoke all on function public.start_job_run(text),public.finish_job_run(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.start_job_run(text),public.finish_job_run(uuid,text,jsonb) to service_role;

create table private.renewal_runs(
 scheduled_for timestamptz primary key,cursor uuid,status text not null default 'pending' check(status in ('pending','running','completed','failed')),
 lease_id uuid,locked_until timestamptz,checked integer not null default 0,queued integer not null default 0,
 failures integer not null default 0,dispatches integer not null default 0,requested_at timestamptz,updated_at timestamptz not null default now(),completed_at timestamptz
);
alter table private.renewal_runs enable row level security;
revoke all on private.renewal_runs from public,anon,authenticated,service_role;
create function public.claim_renewal_run() returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.renewal_runs;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 update private.renewal_runs set status='failed',updated_at=now() where status in ('pending','running') and scheduled_for<now()-interval '24 hours';
 select * into r from private.renewal_runs where status in ('pending','running') and scheduled_for<=now() order by scheduled_for for update skip locked limit 1;
 if not found then return jsonb_build_object('done',true);end if;
 if r.locked_until>now() then return jsonb_build_object('busy',true);end if;
 update private.renewal_runs set lease_id=gen_random_uuid(),locked_until=now()+interval '2 minutes',status='running',updated_at=now() where scheduled_for=r.scheduled_for returning * into r;
 return jsonb_build_object('scheduledFor',r.scheduled_for,'cursor',r.cursor,'leaseId',r.lease_id);
end;$$;
create function public.fail_renewal_run(p_run timestamptz,p_lease uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 update private.renewal_runs set failures=failures+1,status=case when failures+1>=5 then 'failed' else 'pending' end,locked_until=null,lease_id=null,updated_at=now() where scheduled_for=p_run and lease_id=p_lease and status='running';
end;$$;
create function public.finish_renewal_batch(p_run timestamptz,p_lease uuid,p_cursor uuid,p_complete boolean,p_items jsonb,p_checked integer) returns integer language plpgsql security definer set search_path='' as $$
declare r private.renewal_runs;n integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if p_complete is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>100 or p_checked is null or p_checked not between 0 and 100 then raise exception 'Invalid batch';end if;
 select * into r from private.renewal_runs where scheduled_for=p_run for update;
 if r.scheduled_for is null or r.status<>'running' or r.lease_id is distinct from p_lease or r.locked_until<=now() then raise exception 'Renewal lease lost';end if;
 insert into public.email_outbox(event_key,teacher_id,student_id,recipient,template,payload)
 select 'reminder/'||s.id||'/'||i.credits,s.teacher_id,s.id,s.email,'reminder',jsonb_build_object('message',i.message)
 from jsonb_to_recordset(p_items) as i(student_id uuid,teacher_id uuid,email text,credits integer,message text)
 join public.students s on s.id=i.student_id and s.teacher_id=i.teacher_id and s.active and lower(trim(s.email))=lower(trim(i.email))
 join public.teachers t on t.id=s.teacher_id and t.platform_plan in ('plus','pro')
 where i.credits>0 and char_length(i.message) between 1 and 1000 and not exists(select 1 from public.reminders x where x.student_id=s.id and x.credits=i.credits)
 on conflict(event_key) do nothing;
 get diagnostics n=row_count;
 insert into public.reminders(student_id,credits)
 select i.student_id,i.credits from jsonb_to_recordset(p_items) as i(student_id uuid,credits integer)
 where exists(select 1 from public.email_outbox e where e.event_key='reminder/'||i.student_id||'/'||i.credits)
 on conflict(student_id,credits) do nothing;
 update private.renewal_runs set cursor=p_cursor,status=case when p_complete then 'completed' else 'pending' end,checked=checked+p_checked,queued=queued+n,failures=0,dispatches=0,lease_id=null,locked_until=null,updated_at=now(),completed_at=case when p_complete then now() end where scheduled_for=p_run;
 return n;
end;$$;
revoke all on function public.claim_renewal_run(),public.fail_renewal_run(timestamptz,uuid),public.finish_renewal_batch(timestamptz,uuid,uuid,boolean,jsonb,integer) from public,anon,authenticated;
grant execute on function public.claim_renewal_run(),public.fail_renewal_run(timestamptz,uuid),public.finish_renewal_batch(timestamptz,uuid,uuid,boolean,jsonb,integer) to service_role;
create or replace function public.claim_email_jobs(p_limit integer default 10,p_id uuid default null)
returns setof public.email_outbox language plpgsql security definer set search_path='' as $$
begin
 update public.email_outbox set status='failed',last_error=case when attempts>=5 then 'Limite de cinco tentativas atingido.' else 'Prazo de envio encerrado.' end,payload='{}',delivery=null
 where status in ('pending','sending') and (expires_at<=now() or first_attempt_at<now()-interval '23 hours' or (attempts>=5 and (status='pending' or locked_at<now()-interval '2 minutes')));
 return query with due as (
 select id from public.email_outbox where (p_id is null or id=p_id) and attempts<5 and expires_at>now()
 and ((status='pending' and available_at<=now()) or (status='sending' and locked_at<now()-interval '2 minutes'))
 order by created_at for update skip locked limit least(greatest(p_limit,1),20)
 ) update public.email_outbox q set status='sending',lease_id=gen_random_uuid(),locked_at=now(),
 attempts=q.attempts+1,first_attempt_at=coalesce(q.first_attempt_at,now()) from due where q.id=due.id returning q.*;
end;
$$;

create or replace function public.queue_email_campaign(p_id uuid,p_subject text,p_content text,p_students uuid[]) returns integer language plpgsql security definer set search_path='' as $$
declare tid uuid:=auth.uid();n integer;existing public.email_campaigns;
begin
 if tid is null or not private.teacher_session_valid() or not exists(select 1 from public.teachers where id=tid and platform_plan in ('plus','pro')) then raise exception 'Campanhas estão disponíveis nos planos Plus e Pro.' using errcode='42501';end if;
 if p_subject is null or char_length(trim(p_subject)) not between 1 and 120 or p_subject~E'[\\r\\n]' or p_content is null or char_length(p_content) not between 1 and 100000 or p_students is null or array_position(p_students,null) is not null or cardinality(p_students) not between 1 and 100 then raise exception 'Confira os campos e selecione até 100 alunos.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lessonara-campaigns:'||tid::text));
 select * into existing from public.email_campaigns where id=p_id;
 if found then if existing.teacher_id<>tid or existing.subject<>trim(p_subject) then raise exception 'Campanha inválida.';end if;return existing.recipients;end if;
 if exists(select 1 from unnest(p_students) as chosen(id) where not exists(select 1 from public.students s where s.id=chosen.id and teacher_id=tid and active and email is not null and not promotional_email_opt_out)) then raise exception 'Um aluno mudou ou não está disponível para esta campanha. Revise os destinatários.';end if;
 select count(distinct lower(trim(email))) into n from public.students where id=any(p_students) and teacher_id=tid;
 if n<1 then raise exception 'Selecione pelo menos um aluno.';end if;
 if exists(select 1 from public.email_campaigns where teacher_id=tid and created_at>now()-interval '1 minute') then raise exception 'Aguarde um minuto antes de registrar outra campanha.';end if;
 if (select coalesce(sum(recipients),0) from public.email_campaigns where teacher_id=tid and created_at>now()-interval '24 hours')+n>500 then raise exception 'O limite de 500 destinatários por dia foi atingido.';end if;
 insert into public.email_campaigns values(p_id,tid,trim(p_subject),n,now());
 insert into public.email_outbox(event_key,teacher_id,student_id,recipient,template,payload)
 select 'campaign/'||p_id||'/'||s.id,tid,s.id,lower(trim(s.email)),'campaign',jsonb_build_object('sealed',p_content) from (select distinct on (lower(trim(email))) id,email from public.students where teacher_id=tid and id=any(p_students) order by lower(trim(email)),id) s;
 return n;
end;$$;

revoke all on function public.claim_email_jobs(integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_email_jobs(integer,uuid) to service_role;
revoke all on function public.queue_email_campaign(uuid,text,text,uuid[]) from public,anon;
grant execute on function public.queue_email_campaign(uuid,text,text,uuid[]) to authenticated;
create or replace function public.claim_calendar_jobs(p_teacher uuid default null) returns setof public.calendar_jobs language plpgsql security definer set search_path='' as $$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 update public.calendar_jobs set status='failed',last_error='Limite de cinco tentativas atingido.' where attempts>=5 and (status='pending' or (status='sending' and locked_at<now()-interval '2 minutes'));
 return query with due as(select id from public.calendar_jobs where (p_teacher is null or teacher_id=p_teacher) and attempts<5 and ((status='pending' and available_at<=now()) or (status='sending' and locked_at<now()-interval '2 minutes')) order by created_at for update skip locked limit 10)
 update public.calendar_jobs j set status='sending',attempts=j.attempts+1,lease_id=gen_random_uuid(),locked_at=now() from due where j.id=due.id returning j.*;
end;$$;
revoke all on function public.claim_calendar_jobs(uuid) from public,anon,authenticated;
grant execute on function public.claim_calendar_jobs(uuid) to service_role;

create function public.worker_operations_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare scheduler jsonb:='[]';
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if to_regclass('cron.job') is not null then
  execute $q$select coalesce(jsonb_agg(jsonb_build_object('name',j.jobname,'schedule',j.schedule,'active',j.active,'lastStart',r.start_time,'lastEnd',r.end_time,'schedulerStatus',r.status)),'[]'::jsonb) from cron.job j left join lateral(select start_time,end_time,status from cron.job_run_details where jobid=j.jobid order by start_time desc limit 1) r on true where j.jobname like 'lessonara-%'$q$ into scheduler;
 end if;
 return jsonb_build_object('generatedAt',now(),'cron',scheduler,
 'runs',coalesce((select jsonb_agg(to_jsonb(r)) from(select ranked.id,ranked.job_key,ranked.status,ranked.started_at,ranked.finished_at,ranked.metrics,ranked.error_code from(select j.*,row_number() over(partition by job_key order by started_at desc) as position from private.job_runs j) ranked where position<=15 order by started_at desc) r),'[]'::jsonb),
 'renewals',coalesce((select jsonb_agg(to_jsonb(r)) from(select scheduled_for,status,checked,queued,failures,dispatches,updated_at,completed_at from private.renewal_runs order by scheduled_for desc limit 10) r),'[]'::jsonb),
 'queues',jsonb_build_array(
 (select jsonb_build_object('key','emails','pending',count(*) filter(where status='pending'),'working',count(*) filter(where status='sending'),'failed',count(*) filter(where status='failed'),'exhausted',count(*) filter(where status='failed' and attempts>=5),'oldestPendingAt',min(created_at) filter(where status in ('pending','sending')),'deliveryFailures',count(*) filter(where delivery_status in ('bounced','complained','failed','suppressed'))) from public.email_outbox),
 (select jsonb_build_object('key','calendar','pending',count(*) filter(where status='pending'),'working',count(*) filter(where status='sending'),'failed',count(*) filter(where status='failed'),'exhausted',count(*) filter(where status='failed' and attempts>=5),'oldestPendingAt',min(created_at) filter(where status in ('pending','sending')),'deliveryFailures',0) from public.calendar_jobs)
 ));
end;$$;
revoke all on function public.worker_operations_snapshot() from public,anon,authenticated;
grant execute on function public.worker_operations_snapshot() to service_role;
notify pgrst,'reload schema';
commit;
