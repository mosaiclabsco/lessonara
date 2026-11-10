begin;
-- External events remain owned by Google. Only local future occurrences are mirrored.
create table public.google_lesson_links (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teachers on delete cascade,
 student_id uuid not null references public.students on delete cascade, event_id text not null check(length(event_id) between 1 and 1024),
 title text not null, recurring boolean not null, starts_on date not null, active boolean not null default true,
 next_sync_at timestamptz not null default now(), last_synced_at timestamptz, last_error text,
 created_at timestamptz not null default now()
);
create unique index google_lesson_link_unique on public.google_lesson_links(teacher_id,event_id) where active;
create index google_lesson_links_due on public.google_lesson_links(next_sync_at) where active;
alter table public.google_lesson_links enable row level security;
revoke all on public.google_lesson_links from public,anon,authenticated;
grant select on public.google_lesson_links to authenticated;
grant all on public.google_lesson_links to service_role;
create policy "own google lesson links" on public.google_lesson_links for select to authenticated using(teacher_id=auth.uid() and private.teacher_session_valid());
alter table public.appointments add column google_link_id uuid references public.google_lesson_links(id);
alter table public.appointments add column google_instance_id text;
create unique index google_lesson_instance_unique on public.appointments(google_link_id,google_instance_id) where google_link_id is not null;
alter table public.appointments add constraint google_lesson_instance_pair check((google_link_id is null)=(google_instance_id is null));

create function private.guard_google_appointment() returns trigger language plpgsql security definer set search_path='' as $$
declare link public.google_lesson_links; p public.plans; used integer; boundary date; last_day date; d date;
begin
 if tg_op<>'INSERT' and old.google_link_id is not null and auth.role() is distinct from 'service_role' and exists(select 1 from public.students where id=old.student_id) then raise exception 'Gerencie esta aula no Google Calendar ou desvincule pelo Lessonara.';end if;
 if tg_op='DELETE' then return old;end if;
 if new.google_link_id is null then return new;end if;
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 select * into link from public.google_lesson_links where id=new.google_link_id and active and teacher_id=new.teacher_id and student_id=new.student_id;
 if not found or not private.platform_feature_enabled(link.teacher_id,'google') or not exists(select 1 from public.students where id=link.student_id and teacher_id=link.teacher_id and active) then raise insufficient_privilege;end if;
 if new.date<link.starts_on then raise exception 'A aula é anterior ao vínculo.';end if;
 perform pg_advisory_xact_lock(hashtext('lessonara-calendar:'||new.teacher_id::text));
 select pl.* into p from public.plans pl join public.students st on st.plan_id=pl.id and st.teacher_id=pl.teacher_id where st.id=new.student_id for update of st;
 if not found then raise exception 'Escolha o plano do aluno antes de agendar.';end if;
 boundary:=case when p.frequency_period='week' then date_trunc('week',new.date)::date else date_trunc('month',new.date)::date end;
 last_day:=case when p.frequency_period='week' then boundary+6 else (boundary+interval '1 month'-interval '1 day')::date end;
 select count(*) into used from public.appointments a where a.student_id=new.student_id and a.id<>new.id and a.date between boundary and last_day and not exists(select 1 from public.lesson_events e where e.student_id=a.student_id and e.date=a.date and e.kind='desmarcada' and (e.time is null or e.time=a.time));
 for d in select x::date from generate_series(boundary,last_day,interval '1 day') x loop
  used:=used+(select count(*) from public.schedules s where s.student_id=new.student_id and public.schedule_on_day(d,s.starts_on,s.ends_on,s.weekday,s.monthly_day) and not exists(select 1 from public.lesson_events e where e.student_id=s.student_id and e.date=d and e.kind='desmarcada' and (e.time is null or e.time=s.time)));
 end loop;
 if used>=p.frequency_count then raise exception 'O vínculo excede a quantidade de aulas do plano neste período.';end if;
 -- Use the imported duration, including for overlaps with other students.
 if exists(select 1 from public.appointments a where a.teacher_id=new.teacher_id and a.id<>new.id and a.date+a.time<new.date+new.time+make_interval(mins=>new.duration_minutes) and a.date+a.time+make_interval(mins=>a.duration_minutes)>new.date+new.time and not exists(select 1 from public.lesson_events e where e.student_id=a.student_id and e.date=a.date and e.kind='desmarcada' and (e.time is null or e.time=a.time))) then raise exception 'Já existe uma aula nesse horário.';end if;
 if exists(select 1 from public.schedules s join public.students st on st.id=s.student_id cross join generate_series(new.date-1,new.date+1,interval '1 day') x where st.teacher_id=new.teacher_id and public.schedule_on_day(x::date,s.starts_on,s.ends_on,s.weekday,s.monthly_day) and x::date+s.time<new.date+new.time+make_interval(mins=>new.duration_minutes) and x::date+s.time+make_interval(mins=>s.duration_minutes)>new.date+new.time and not exists(select 1 from public.lesson_events e where e.student_id=s.student_id and e.date=x::date and e.kind='desmarcada' and (e.time is null or e.time=s.time))) then raise exception 'Já existe uma aula fixa nesse horário.';end if;
 if exists(select 1 from public.lesson_events e join public.students st on st.id=e.student_id where st.teacher_id=new.teacher_id and e.kind='reposicao' and e.date+e.time<new.date+new.time+make_interval(mins=>new.duration_minutes) and e.date+e.time+make_interval(mins=>e.duration_minutes)>new.date+new.time) then raise exception 'Já existe uma reposição nesse horário.';end if;
 return new;
end;$$;
create trigger aa_google_readonly before insert or update or delete on public.appointments for each row execute function private.guard_google_appointment();
drop trigger appointment_guard on public.appointments;
create trigger appointment_guard before insert or update on public.appointments for each row when(new.google_link_id is null) execute function public.guard_appointment();
drop trigger aa_duration_snapshot on public.appointments;
create trigger aa_duration_snapshot before insert or update on public.appointments for each row when(new.google_link_id is null) execute function public.snapshot_lesson_duration();
drop trigger calendar_appointment_changed on public.appointments;
create function private.google_appointment_queue() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.google_link_id is null then perform public.enqueue_calendar_source(old.teacher_id,'appointment',old.id,'delete');end if;
 elsif new.google_link_id is null then
  if tg_op='INSERT' or (new.date,new.time) is distinct from (old.date,old.time) then perform public.enqueue_calendar_source(new.teacher_id,'appointment',new.id,'upsert');end if;
 end if;
 return null;
end;$$;
create trigger calendar_appointment_changed after insert or update or delete on public.appointments for each row execute function private.google_appointment_queue();

create or replace function public.enqueue_calendar_source(p_teacher uuid,p_kind text,p_id uuid,p_operation text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_kind='appointment' and exists(select 1 from public.appointments where id=p_id and google_link_id is not null) then return;end if;
 if not exists(select 1 from public.google_calendar_connections where teacher_id=p_teacher) then return;end if;
 insert into public.calendar_jobs(teacher_id,source_kind,source_id,operation) values(p_teacher,p_kind,p_id,p_operation) on conflict(teacher_id,source_kind,source_id) do update set operation=excluded.operation,version=calendar_jobs.version+1,status=case when calendar_jobs.status='sending' then 'sending' else 'pending' end,attempts=case when calendar_jobs.status='sending' then calendar_jobs.attempts else 0 end,available_at=now(),lease_id=case when calendar_jobs.status='sending' then calendar_jobs.lease_id else null end,locked_at=case when calendar_jobs.status='sending' then calendar_jobs.locked_at else null end,last_error=null;
end;
$$;

-- A later native schedule must not bypass the frequency occupied by linked lessons.
create function private.guard_linked_schedule_frequency() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.plans; boundary date; last_day date; d date; used integer;
begin
 select pl.* into p from public.plans pl join public.students st on st.plan_id=pl.id and st.teacher_id=pl.teacher_id where st.id=new.student_id;
 perform pg_advisory_xact_lock(hashtext('lessonara-calendar:'||p.teacher_id::text));
 for boundary in select distinct date_trunc(case when p.frequency_period='week' then 'week' else 'month' end,a.date)::date from public.appointments a where a.student_id=new.student_id and a.google_link_id is not null and a.date>=new.starts_on and (new.ends_on is null or a.date<=new.ends_on) loop
  last_day:=case when p.frequency_period='week' then boundary+6 else (boundary+interval '1 month'-interval '1 day')::date end;
  select count(*) into used from public.appointments a where a.student_id=new.student_id and a.date between boundary and last_day and not exists(select 1 from public.lesson_events e where e.student_id=a.student_id and e.date=a.date and e.kind='desmarcada' and (e.time is null or e.time=a.time));
  for d in select x::date from generate_series(boundary,last_day,interval '1 day') x loop
   used:=used+(select count(*) from public.schedules s where s.student_id=new.student_id and public.schedule_on_day(d,s.starts_on,s.ends_on,s.weekday,s.monthly_day) and not exists(select 1 from public.lesson_events e where e.student_id=s.student_id and e.date=d and e.kind='desmarcada' and (e.time is null or e.time=s.time)));
  end loop;
  if used>p.frequency_count then raise exception 'O vínculo excede a quantidade de aulas do plano neste período.';end if;
 end loop;
 return null;
end;$$;
create trigger google_linked_schedule_frequency after insert or update on public.schedules for each row execute function private.guard_linked_schedule_frequency();
revoke all on function private.guard_linked_schedule_frequency() from public,anon,authenticated,service_role;

create function public.apply_google_lesson_link(p_teacher uuid,p_student uuid,p_event text,p_title text,p_recurring boolean,p_starts date,p_until date,p_instances jsonb,p_link uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare link public.google_lesson_links; item jsonb; local_now timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 if auth.role() is distinct from 'service_role' or not private.platform_feature_enabled(p_teacher,'google') or not exists(select 1 from public.google_calendar_connections where teacher_id=p_teacher) then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtext('lessonara-calendar:'||p_teacher::text));
 if not exists(select 1 from public.students where id=p_student and teacher_id=p_teacher and active) then raise insufficient_privilege;end if;
 if p_link is null then
  if p_starts<local_now::date or p_starts>local_now::date+365 then raise exception 'Escolha uma data inicial a partir de hoje.';end if;
  insert into public.google_lesson_links(teacher_id,student_id,event_id,title,recurring,starts_on) values(p_teacher,p_student,p_event,left(p_title,300),p_recurring,p_starts) returning * into link;
 else
  select * into link from public.google_lesson_links where id=p_link and teacher_id=p_teacher and student_id=p_student and event_id=p_event and starts_on=p_starts and active for update;
  if not found then raise insufficient_privilege;end if;
 end if;
 if p_until<greatest(p_starts,local_now::date) or p_until>greatest(p_starts,local_now::date)+181 or p_instances is null or jsonb_typeof(p_instances)<>'array' or jsonb_array_length(p_instances)>500 then raise exception 'Prévia inválida. Atualize a lista de eventos.';end if;
 -- Snapshot past attendance before any future edits. No past occurrences are imported.
 perform private.capture_lesson_history(p_student);
 for item in select value from jsonb_array_elements(p_instances) loop
  if (item->>'date')::date<p_starts or (item->>'date')::date>p_until or (item->>'date')::date+(item->>'time')::time<=local_now or coalesce(length(item->>'id'),0) not between 1 and 1024 then raise exception 'Prévia inválida. Atualize a lista de eventos.';end if;
 end loop;
 -- Keep source IDs stable, even when Google moves an upcoming occurrence.
 create temporary table if not exists google_link_keep(id uuid,instance text) on commit drop;
 truncate google_link_keep;
 insert into google_link_keep select id,google_instance_id from public.appointments where google_link_id=link.id;
 delete from public.appointments a where google_link_id=link.id and date+time>local_now and date<=p_until and not exists(
  select 1 from jsonb_array_elements(p_instances) v where v->>'id'=a.google_instance_id and (v->>'date')::date=a.date and (v->>'time')::time=a.time and (v->>'duration')::integer=a.duration_minutes and (v->>'meet') is not distinct from a.meet_url
 );
 for item in select value from jsonb_array_elements(p_instances) loop
  if exists(select 1 from public.appointments where google_link_id=link.id and google_instance_id=item->>'id') then continue;end if;
  insert into public.appointments(id,teacher_id,student_id,date,time,duration_minutes,meet_url,google_link_id,google_instance_id)
  values(coalesce((select id from google_link_keep where instance=item->>'id'),gen_random_uuid()),p_teacher,p_student,(item->>'date')::date,(item->>'time')::time,(item->>'duration')::integer,item->>'meet',link.id,item->>'id');
 end loop;
 update public.google_lesson_links set title=left(p_title,300),last_synced_at=now(),next_sync_at=now()+interval '5 minutes',last_error=null where id=link.id;
 return link.id;
end;$$;
create function public.unlink_google_lesson(p_teacher uuid,p_student uuid,p_link uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.role() is distinct from 'service_role' then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtext('lessonara-calendar:'||p_teacher::text));
 if not exists(select 1 from public.google_lesson_links where id=p_link and teacher_id=p_teacher and student_id=p_student for update) then raise insufficient_privilege;end if;
 perform private.capture_lesson_history(p_student);
 delete from public.appointments where google_link_id=p_link and date+time>now() at time zone 'America/Sao_Paulo';
 update public.google_lesson_links set active=false where id=p_link;
end;$$;
create function public.claim_google_lesson_links() returns setof public.google_lesson_links language plpgsql security definer set search_path='' as $$
begin
 return query with due as(select l.id from public.google_lesson_links l where l.active and l.next_sync_at<=now() and private.platform_feature_enabled(l.teacher_id,'google') and exists(select 1 from public.google_calendar_connections where teacher_id=l.teacher_id) order by l.next_sync_at for update skip locked limit 3)
 update public.google_lesson_links l set next_sync_at=now()+interval '5 minutes' from due where l.id=due.id returning l.*;
end;$$;
-- Linked future occurrences satisfy the paid-package scheduling prerequisite.
create or replace function private.require_payment_schedule() returns trigger language plpgsql security definer set search_path='' as $$
declare st public.students; mode text;
begin
 select * into st from public.students where id=new.student_id for update;
 if not found then raise exception 'Aluno não encontrado.';end if;
 if auth.role() is distinct from 'service_role' and (st.teacher_id is distinct from auth.uid() or not private.teacher_session_valid()) then raise insufficient_privilege;end if;
 select scheduling_mode into mode from public.plans where id=st.plan_id and teacher_id=st.teacher_id;
 if not found then raise exception 'Escolha um plano para o aluno antes de registrar o pagamento.';end if;
 if coalesce(mode,'recurring')<>'flexible' and not exists(select 1 from public.schedules where student_id=st.id and (ends_on is null or ends_on>=(now() at time zone 'America/Sao_Paulo')::date)) and not exists(select 1 from public.appointments a join public.google_lesson_links l on l.id=a.google_link_id and l.active where a.student_id=st.id and a.date+a.time>now() at time zone 'America/Sao_Paulo') then raise exception 'Cadastre um horário fixo na aba Horários antes de registrar o pagamento deste plano.';end if;
 return new;
end;$$;
revoke all on function private.guard_google_appointment(),private.google_appointment_queue() from public,anon,authenticated,service_role;
revoke all on function public.apply_google_lesson_link(uuid,uuid,text,text,boolean,date,date,jsonb,uuid),public.unlink_google_lesson(uuid,uuid,uuid),public.claim_google_lesson_links() from public,anon,authenticated;
grant execute on function public.apply_google_lesson_link(uuid,uuid,text,text,boolean,date,date,jsonb,uuid),public.unlink_google_lesson(uuid,uuid,uuid),public.claim_google_lesson_links() to service_role;
commit;
notify pgrst,'reload schema';
