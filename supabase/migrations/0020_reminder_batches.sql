begin;
create table if not exists private.reminder_runs(
 day date primary key,cursor uuid,complete boolean not null default false,
 lease_id uuid,locked_until timestamptz,checked integer not null default 0,queued integer not null default 0,updated_at timestamptz not null default now()
);
alter table private.reminder_runs enable row level security;
revoke all on private.reminder_runs from public,anon,authenticated;

create or replace function public.claim_reminder_run() returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.reminder_runs; today date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 insert into private.reminder_runs(day) values(today) on conflict do nothing;
 select * into r from private.reminder_runs where not complete and day<=today order by day limit 1 for update skip locked;
 if r.day is null then return jsonb_build_object('done',true);end if;
 if r.locked_until>now() then return jsonb_build_object('busy',true);end if;
 update private.reminder_runs set lease_id=gen_random_uuid(),locked_until=now()+interval '2 minutes',updated_at=now() where day=r.day returning * into r;
 return jsonb_build_object('day',r.day,'cursor',r.cursor,'leaseId',r.lease_id);
end;
$$;

create or replace function public.finish_reminder_batch(p_day date,p_lease uuid,p_cursor uuid,p_complete boolean,p_items jsonb,p_checked integer) returns integer
language plpgsql security definer set search_path='' as $$
declare r private.reminder_runs;n integer;
begin
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>100 or p_checked not between 0 and 100 then raise exception 'Invalid batch';end if;
 select * into r from private.reminder_runs where day=p_day for update;
 if r.day is null or r.complete or r.lease_id is distinct from p_lease or r.locked_until<=now() then raise exception 'Reminder lease lost';end if;
 insert into public.email_outbox(event_key,teacher_id,student_id,recipient,template,payload)
 select 'reminder/'||s.id||'/'||i.credits,s.teacher_id,s.id,s.email,'reminder',jsonb_build_object('message',i.message)
 from jsonb_to_recordset(p_items) as i(student_id uuid,teacher_id uuid,email text,credits integer,message text)
 join public.students s on s.id=i.student_id and s.teacher_id=i.teacher_id and s.active and lower(trim(s.email))=lower(trim(i.email))
 join public.teachers t on t.id=s.teacher_id and t.platform_plan='pro'
 where i.credits>0 and char_length(i.message) between 1 and 1000 and not exists(select 1 from public.reminders x where x.student_id=s.id and x.credits=i.credits)
 on conflict(event_key) do nothing;
 get diagnostics n=row_count;
 insert into public.reminders(student_id,credits)
 select i.student_id,i.credits from jsonb_to_recordset(p_items) as i(student_id uuid,credits integer)
 where exists(select 1 from public.email_outbox e where e.event_key='reminder/'||i.student_id||'/'||i.credits)
 on conflict(student_id,credits) do nothing;
 update private.reminder_runs set cursor=coalesce(p_cursor,cursor),complete=p_complete,checked=checked+p_checked,queued=queued+n,lease_id=null,locked_until=null,updated_at=now() where day=p_day;
 return n;
end;
$$;
revoke all on function public.claim_reminder_run(),public.finish_reminder_batch(date,uuid,uuid,boolean,jsonb,integer) from public,anon,authenticated;
grant execute on function public.claim_reminder_run(),public.finish_reminder_batch(date,uuid,uuid,boolean,jsonb,integer) to service_role;
notify pgrst,'reload schema';
commit;
