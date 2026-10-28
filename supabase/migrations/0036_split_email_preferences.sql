begin;
-- Preserve the previous combined choice in both independent controls.
alter table public.students add column lesson_email_opt_out boolean not null default false;
alter table public.students add column renewal_email_opt_out boolean not null default false;
update public.students set lesson_email_opt_out=operational_email_opt_out,renewal_email_opt_out=operational_email_opt_out where operational_email_opt_out;
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
 join public.students s on s.id=i.student_id and s.teacher_id=i.teacher_id and s.active and not s.renewal_email_opt_out and lower(trim(s.email))=lower(trim(i.email))
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

create or replace function public.queue_lesson_notices(p_cursor uuid,p_items jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>500 then raise exception 'Invalid notice batch';end if;
 insert into public.email_outbox(event_key,teacher_id,student_id,recipient,template,payload,expires_at)
 select 'lesson/'||s.id||'/'||i.source_kind||'/'||i.source_id||'/'||i.date||'/'||i.time,s.teacher_id,s.id,s.email,'lesson_notice',jsonb_build_object('date',i.date,'time',i.time,'source_kind',i.source_kind,'source_id',i.source_id),(i.date::date+i.time::time) at time zone 'America/Sao_Paulo'
 from jsonb_to_recordset(p_items) i(student_id uuid,teacher_id uuid,date text,time text,source_kind text,source_id uuid)
 join public.students s on s.id=i.student_id and s.teacher_id=i.teacher_id and s.active and not s.lesson_email_opt_out and s.email is not null
 where private.platform_feature_enabled(s.teacher_id,'lessonReminders') and i.source_kind in ('schedule','appointment','makeup') and ((i.date::date+i.time::time) at time zone 'America/Sao_Paulo')>now() and ((i.date::date+i.time::time) at time zone 'America/Sao_Paulo')<=now()+interval '1 hour'
 on conflict(event_key) do nothing;
 get diagnostics n=row_count;
 update private.lesson_notice_state set cursor=p_cursor where id;return n;
end;$$;

notify pgrst,'reload schema';
commit;
