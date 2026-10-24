begin;
-- Feature rules also live in platform-plans.ts; parity is tested against SQL.
create or replace function private.platform_feature_enabled(p_teacher uuid,p_feature text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select case p_feature when 'emails' then platform_plan in ('plus','pro') when 'google' then platform_plan in ('plus','pro') when 'exports' then platform_plan in ('plus','pro') when 'imports' then platform_plan in ('plus','pro') when 'classroom' then platform_plan='pro' when 'lessonReminders' then platform_plan='pro' else false end from public.teachers where id=p_teacher and not access_suspended),false);
$$;
revoke all on function private.platform_feature_enabled(uuid,text) from public,anon;
grant execute on function private.platform_feature_enabled(uuid,text) to authenticated,service_role;
create or replace function public.platform_storage_limits(p_teacher uuid) returns table(max_file_bytes bigint,storage_bytes bigint) language sql stable security definer set search_path='' as $$
 select case platform_plan when 'pro' then 104857600 when 'plus' then 52428800 else 20971520 end::bigint,case platform_plan when 'pro' then 10737418240 when 'plus' then 5368709120 else 1073741824 end::bigint from public.teachers where id=p_teacher;
$$;
-- Protect the plan even if a malformed request has no sub claim. Trusted SQL and service-role operations retain their existing path.
create or replace function public.protect_platform_plan() returns trigger language plpgsql set search_path='' as $$
begin
 if coalesce(auth.role(),'') in ('anon','authenticated') and ((tg_op='INSERT' and new.platform_plan<>'essential') or (tg_op='UPDATE' and new.platform_plan is distinct from old.platform_plan)) then raise exception 'O plano da empresa só pode ser alterado pela administração.' using errcode='42501';end if;return new;
end;$$;
alter table public.students add column operational_email_opt_out boolean not null default false;
alter table public.email_outbox drop constraint email_outbox_template_check;
alter table public.email_outbox add constraint email_outbox_template_check check(template in ('welcome','otp','reminder','campaign','lesson_notice'));
create policy "email feature required" on public.email_outbox as restrictive for select to authenticated using(private.platform_feature_enabled(auth.uid(),'emails'));
create policy "campaign feature required" on public.email_campaigns as restrictive for select to authenticated using(private.platform_feature_enabled(auth.uid(),'emails'));
create policy "calendar feature required" on public.calendar_jobs as restrictive for select to authenticated using(private.platform_feature_enabled(auth.uid(),'google'));
-- Stop queued work after downgrade; do not delete remote personal events or historical data.
create or replace function public.check_calendar_job_feature() returns trigger language plpgsql security definer set search_path='' as $$begin if new.status in ('pending','sending') and not private.platform_feature_enabled(new.teacher_id,'google') then new.status:='cancelled';new.last_error:=null;end if;return new;end;$$;
create trigger calendar_job_feature before insert or update on public.calendar_jobs for each row execute function public.check_calendar_job_feature();
revoke all on function public.check_calendar_job_feature() from public,anon,authenticated;
alter table private.job_runs drop constraint job_runs_job_key_check;
alter table private.job_runs add constraint job_runs_job_key_check check(job_key in ('renewals','emails','calendar','cleanup','lesson-reminders'));
create or replace function public.start_job_run(p_job text) returns uuid language plpgsql security definer set search_path='' as $$
declare run_id uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if p_job is null or p_job not in ('renewals','emails','calendar','cleanup','lesson-reminders') then raise exception 'Unknown job';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lessonara-job:'||p_job));
 update private.job_runs set status='failed',finished_at=now(),error_code='lease_expired' where job_key=p_job and status='running' and started_at<now()-interval '2 minutes';
 if exists(select 1 from private.job_runs where job_key=p_job and status='running') then return null;end if;
 insert into private.job_runs(job_key) values(p_job) returning id into run_id;
 delete from private.job_runs where started_at<now()-interval '30 days' and status<>'running';
 return run_id;
end;$$;
create or replace function public.finish_renewal_batch(p_run timestamptz,p_lease uuid,p_cursor uuid,p_complete boolean,p_items jsonb,p_checked integer) returns integer language plpgsql security definer set search_path='' as $$
declare r private.renewal_runs;n integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if p_complete is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>100 or p_checked is null or p_checked not between 0 and 100 then raise exception 'Invalid batch';end if;
 select * into r from private.renewal_runs where scheduled_for=p_run for update;
 if r.scheduled_for is null or r.status<>'running' or r.lease_id is distinct from p_lease or r.locked_until<=now() then raise exception 'Renewal lease lost';end if;
 insert into public.email_outbox(event_key,teacher_id,student_id,recipient,template,payload)
 select 'reminder/'||s.id||'/'||i.credits,s.teacher_id,s.id,s.email,'reminder',jsonb_build_object('message',i.message)
 from jsonb_to_recordset(p_items) as i(student_id uuid,teacher_id uuid,email text,credits integer,message text)
 join public.students s on s.id=i.student_id and s.teacher_id=i.teacher_id and s.active and not s.operational_email_opt_out and lower(trim(s.email))=lower(trim(i.email))
 join public.teachers t on t.id=s.teacher_id and private.platform_feature_enabled(t.id,'emails')
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

create table private.lesson_notice_state(id boolean primary key default true check(id),cursor uuid);
insert into private.lesson_notice_state(id) values(true);
alter table private.lesson_notice_state enable row level security;
revoke all on private.lesson_notice_state from public,anon,authenticated,service_role;
create function public.lesson_notice_cursor() returns uuid language plpgsql security definer set search_path='' as $$begin if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;return (select cursor from private.lesson_notice_state where id);end;$$;
create function public.queue_lesson_notices(p_cursor uuid,p_items jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>500 then raise exception 'Invalid notice batch';end if;
 insert into public.email_outbox(event_key,teacher_id,student_id,recipient,template,payload,expires_at)
 select 'lesson/'||s.id||'/'||i.source_kind||'/'||i.source_id||'/'||i.date||'/'||i.time,s.teacher_id,s.id,s.email,'lesson_notice',jsonb_build_object('date',i.date,'time',i.time,'source_kind',i.source_kind,'source_id',i.source_id),(i.date::date+i.time::time) at time zone 'America/Sao_Paulo'
 from jsonb_to_recordset(p_items) i(student_id uuid,teacher_id uuid,date text,time text,source_kind text,source_id uuid)
 join public.students s on s.id=i.student_id and s.teacher_id=i.teacher_id and s.active and not s.operational_email_opt_out and s.email is not null
 where private.platform_feature_enabled(s.teacher_id,'lessonReminders') and i.source_kind in ('schedule','appointment','makeup') and ((i.date::date+i.time::time) at time zone 'America/Sao_Paulo')>now() and ((i.date::date+i.time::time) at time zone 'America/Sao_Paulo')<=now()+interval '1 hour'
 on conflict(event_key) do nothing;
 get diagnostics n=row_count;
 update private.lesson_notice_state set cursor=p_cursor where id;return n;
end;$$;
revoke all on function public.lesson_notice_cursor(),public.queue_lesson_notices(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.lesson_notice_cursor(),public.queue_lesson_notices(uuid,jsonb) to service_role;
-- The provider enforces this ceiling even if a signed upload token is used directly.
update storage.buckets set file_size_limit=104857600 where id in ('lessonara-documents','lessonara-activities');
-- Reservation identity is immutable after the quota check; metadata/title and lifecycle actions remain editable.
create function public.protect_upload_reservation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.teacher_id is distinct from old.teacher_id or new.byte_size is distinct from old.byte_size or new.storage_path is distinct from old.storage_path or new.mime_type is distinct from old.mime_type) then raise exception 'Não é permitido alterar a reserva de um arquivo.';end if;
 if tg_op='INSERT' and new.status='uploading' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lessonara-documents:'||new.teacher_id::text));
  if (select count(*) from public.documents where teacher_id=new.teacher_id and status='uploading')+(select count(*) from public.activity_submissions where teacher_id=new.teacher_id and status='uploading')>=3 then raise exception 'Conclua ou remova os envios incompletos antes de continuar.';end if;
 end if;return new;
end;$$;
create trigger protect_document_reservation before insert or update on public.documents for each row execute function public.protect_upload_reservation();
create trigger protect_submission_reservation before insert or update on public.activity_submissions for each row execute function public.protect_upload_reservation();
revoke all on function public.protect_upload_reservation() from public,anon,authenticated;
-- Reserved sizes remain governed by the quota trigger across documents and submissions. Existing larger files survive a downgrade; new uploads obey current limits.
create or replace function public.queue_email_campaign(p_id uuid,p_subject text,p_content text,p_students uuid[]) returns integer language plpgsql security definer set search_path='' as $$
declare tid uuid:=auth.uid();n integer;existing public.email_campaigns;
begin
 if tid is null or not private.teacher_session_valid() or not private.platform_feature_enabled(tid,'emails') then raise exception 'Campanhas estão disponíveis nos planos Plus e Pro.' using errcode='42501';end if;
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

create or replace function public.enqueue_calendar_source(p_teacher uuid,p_kind text,p_id uuid,p_operation text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.platform_feature_enabled(p_teacher,'google') then return;end if;
 if not exists(select 1 from public.google_calendar_connections where teacher_id=p_teacher) then return;end if;
 insert into public.calendar_jobs(teacher_id,source_kind,source_id,operation) values(p_teacher,p_kind,p_id,p_operation) on conflict(teacher_id,source_kind,source_id) do update set operation=excluded.operation,version=calendar_jobs.version+1,status=case when calendar_jobs.status='sending' then 'sending' else 'pending' end,attempts=case when calendar_jobs.status='sending' then calendar_jobs.attempts else 0 end,available_at=now(),lease_id=case when calendar_jobs.status='sending' then calendar_jobs.lease_id else null end,locked_at=case when calendar_jobs.status='sending' then calendar_jobs.locked_at else null end,last_error=null;
end;
$$;

create or replace function private.import_teacher() returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid:=auth.uid();begin
 if tid is null or not private.teacher_session_valid() or not private.platform_feature_enabled(tid,'imports') or not exists(select 1 from public.teachers where id=tid and profile_completed_at is not null) then raise exception 'A importação está disponível para professores configurados no Plus e Pro.' using errcode='42501';end if;return tid;
end;$$;
revoke all on function private.import_teacher() from public,anon,authenticated;
revoke all on function public.enqueue_calendar_source(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.enqueue_calendar_source(uuid,text,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
