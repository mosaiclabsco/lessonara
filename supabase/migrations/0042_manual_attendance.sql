begin;
-- Existing history stays frozen; manual attendance applies from this rollout onward.
alter table public.teachers add column attendance_mode text not null default 'manual' check(attendance_mode in ('manual','automatic'));
alter table public.teachers add column attendance_effective_at timestamptz not null default now();
alter table public.lesson_occurrences drop constraint lesson_occurrences_status_check;
alter table public.lesson_occurrences add constraint lesson_occurrences_status_check check(status in ('agendada','pendente','dada','falta','desmarcada','reposicao','feriado'));
create function private.manual_attendance_required(tid uuid,d date,t time) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select attendance_mode='manual' and d+t>=attendance_effective_at at time zone 'America/Sao_Paulo' from public.teachers where id=tid),false)
$$;
revoke all on function private.manual_attendance_required(uuid,date,time) from public,anon,authenticated,service_role;
create or replace function private.capture_lesson_history(sid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare st public.students; local_now timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 select * into st from public.students where id=sid for update;
 if not found then return;end if;
 update public.lesson_occurrences set status=case when private.manual_attendance_required(st.teacher_id,lesson_date,lesson_time) then 'pendente' else 'dada' end where student_id=sid and status='agendada' and lesson_date+lesson_time<=local_now;
 with origins as (
  select 'schedule'::text kind,s.id source_id,d::date lesson_date,s.time,s.duration_minutes,s.meet_url
  from public.schedules s cross join lateral generate_series(s.starts_on,least(coalesce(s.ends_on,local_now::date),local_now::date),interval '1 day') d
  where s.student_id=sid and public.schedule_on_day(d::date,s.starts_on,s.ends_on,s.weekday,s.monthly_day)
  union all
  select 'appointment',a.id,a.date,a.time,a.duration_minutes,a.meet_url from public.appointments a where a.student_id=sid
  union all
  select 'makeup',e.id,e.date,coalesce(e.time,'00:00'::time),e.duration_minutes,e.meet_url from public.lesson_events e where e.student_id=sid and e.kind='reposicao'
 ), described as (
  select o.*,to_jsonb(e) ev,e.kind event_kind,h.name holiday,
   case when o.kind='makeup' then case when private.manual_attendance_required(st.teacher_id,o.lesson_date,o.time) then 'pendente' else 'reposicao' end when e.id is not null then e.kind when h.id is not null then 'feriado' when private.manual_attendance_required(st.teacher_id,o.lesson_date,o.time) then 'pendente' else 'dada' end state,
   hs.policy holiday_policy
  from origins o
  left join lateral(select e.* from public.lesson_events e where e.student_id=sid and e.kind<>'reposicao' and e.date=o.lesson_date and (e.time is null or e.time=o.time) order by e.created_at desc,e.id desc limit 1) e on o.kind<>'makeup'
  left join public.holiday_settings hs on hs.teacher_id=st.teacher_id and hs.enabled and o.lesson_date>=hs.effective_from
  left join public.holidays h on h.teacher_id=hs.teacher_id and h.date=o.lesson_date and o.kind<>'makeup'
  where o.lesson_date+o.time<=local_now and not exists(select 1 from public.lesson_occurrences saved where saved.student_id=sid and saved.lesson_date=o.lesson_date and saved.lesson_time=o.time and saved.source_kind=o.kind and saved.status<>'desmarcada')
 )
 insert into public.lesson_occurrences(student_id,teacher_id,source_kind,source_id,lesson_date,lesson_time,duration_minutes,status,counts,status_source,plan_snapshot,event_snapshot,holiday_name,holiday_consumes,meet_url)
 select sid,st.teacher_id,d.kind,d.source_id,d.lesson_date,d.time,d.duration_minutes,d.state,
  d.state<>'desmarcada' and (d.state<>'feriado' or d.holiday_policy='consume'),
  case when d.kind='makeup' or d.event_kind is not null then 'exception' when d.holiday is not null then 'holiday' else 'presumed' end,
  jsonb_build_object('id',st.plan_id,'name',p.name,'lessons',p.lessons,'price',coalesce(st.price_override,p.price)),
  case when d.kind='makeup' then (select to_jsonb(e) from public.lesson_events e where e.id=d.source_id) else d.ev end,d.holiday,case when d.holiday is not null then d.holiday_policy='consume' end,d.meet_url
 from described d left join public.plans p on p.id=st.plan_id
 on conflict(student_id,source_kind,source_id,lesson_date) do nothing;
 update public.lesson_occurrences o set first_joined_at=p.joined_at from (
  select source_kind,source_id,lesson_date,min(joined_at) joined_at from public.classroom_participation where student_id=sid and joined_at is not null group by source_kind,source_id,lesson_date
 ) p where o.student_id=sid and o.source_kind=p.source_kind and o.source_id=p.source_id and o.lesson_date=p.lesson_date and o.first_joined_at is null;
 perform private.allocate_lesson_packages(sid);
end;$$;

create or replace function private.correct_lesson_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare sid uuid:=coalesce((to_jsonb(new)->>'student_id')::uuid,(to_jsonb(old)->>'student_id')::uuid); r public.lesson_occurrences; ev public.lesson_events; updated public.lesson_occurrences;
begin
 perform private.capture_lesson_history(sid);
 for r in select o.* from public.lesson_occurrences o where o.student_id=sid and (
  (tg_op<>'INSERT' and o.lesson_date=old.date and (old.time is null or o.lesson_time=old.time)) or
  (tg_op<>'DELETE' and o.lesson_date=new.date and (new.time is null or o.lesson_time=new.time)))
 loop
  if r.source_kind='makeup' then
   -- Deleting a past makeup must be an explicit cancellation, never disappearance.
   if tg_op='DELETE' and old.id=r.source_id then
    update public.lesson_occurrences set status='desmarcada',counts=false,status_source='exception' where id=r.id;
   end if;
  else
   select * into ev from public.lesson_events e where e.student_id=sid and e.kind<>'reposicao' and e.date=r.lesson_date and (e.time is null or e.time=r.lesson_time) order by e.created_at desc,e.id desc limit 1;
   update public.lesson_occurrences set status=coalesce(ev.kind,case when r.holiday_name is not null then 'feriado' when private.manual_attendance_required(r.teacher_id,r.lesson_date,r.lesson_time) then 'pendente' else 'dada' end),
    counts=case when ev.id is not null then ev.kind<>'desmarcada' when r.holiday_name is not null then coalesce(r.holiday_consumes,false) else true end,
    status_source=case when ev.id is not null then 'exception' when r.holiday_name is not null then 'holiday' else 'presumed' end,event_snapshot=case when ev.id is not null then to_jsonb(ev) end
    where id=r.id;
  end if;
  select * into updated from public.lesson_occurrences where id=r.id;
  if (r.status,r.counts,r.event_snapshot) is distinct from (updated.status,updated.counts,updated.event_snapshot) then
   insert into public.lesson_occurrence_changes(occurrence_id,actor_id,before_value,after_value) values(r.id,auth.uid(),to_jsonb(r),to_jsonb(updated));
  end if;
 end loop;
 -- An undone cancellation can restore a slot already used by another occurrence.
 update public.lesson_occurrences o set package_ref=null,package_position=null,package_snapshot=null
 where o.student_id=sid and o.counts and o.package_ref is not null and exists(select 1 from public.lesson_occurrences x where x.student_id=sid and x.counts and x.package_ref=o.package_ref and x.package_position=o.package_position and (x.captured_at,x.id)<(o.captured_at,o.id));
 perform private.allocate_lesson_packages(sid);
 return null;
end;$$;

create function public.set_attendance_mode(p_mode text) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid; current_mode text;
begin
 if auth.uid() is null or not private.teacher_session_valid() then raise insufficient_privilege;end if;
 if p_mode is null or p_mode not in ('manual','automatic') then raise exception 'Escolha uma forma válida de confirmar presença.';end if;
 select attendance_mode into current_mode from public.teachers where id=auth.uid() for update;
 if not found then raise insufficient_privilege;end if;
 if current_mode=p_mode then return;end if;
 for sid in select id from public.students where teacher_id=auth.uid() order by id loop perform private.capture_lesson_history(sid);end loop;
 update public.teachers set attendance_mode=p_mode,attendance_effective_at=now() where id=auth.uid();
end;$$;
create function private.guard_attendance_preference() returns trigger language plpgsql set search_path='' as $$
begin
 if (new.attendance_mode,new.attendance_effective_at) is distinct from (old.attendance_mode,old.attendance_effective_at) and current_user not in ('postgres','supabase_admin') then raise exception 'Use a configuração de presença.';end if;
 return new;
end;$$;
create trigger guard_attendance_preference before update of attendance_mode,attendance_effective_at on public.teachers for each row execute function private.guard_attendance_preference();
create function public.set_lesson_attendance(p_student_id uuid,p_occurrence_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare before_row public.lesson_occurrences; after_row public.lesson_occurrences;
begin
 if auth.uid() is null or not private.teacher_session_valid() or not exists(select 1 from public.students where id=p_student_id and teacher_id=auth.uid()) then raise insufficient_privilege;end if;
 if p_status is null or p_status not in ('dada','falta') then raise exception 'Escolha presença ou falta.';end if;
 perform 1 from public.students where id=p_student_id for update;
 select * into before_row from public.lesson_occurrences where id=p_occurrence_id and student_id=p_student_id and teacher_id=auth.uid() for update;
 if not found or before_row.lesson_date+before_row.lesson_time>now() at time zone 'America/Sao_Paulo' or before_row.status in ('feriado','desmarcada') then raise exception 'Esta aula não permite confirmar presença.';end if;
 update public.lesson_occurrences set status=p_status,counts=true,status_source='exception' where id=before_row.id returning * into after_row;
 if before_row.status=after_row.status and before_row.status_source=after_row.status_source then return;end if;
 insert into public.lesson_occurrence_changes(occurrence_id,actor_id,before_value,after_value) values(before_row.id,auth.uid(),to_jsonb(before_row),to_jsonb(after_row));
 perform private.reallocate_lesson_packages(p_student_id);
end;$$;
revoke all on function public.set_attendance_mode(text),public.set_lesson_attendance(uuid,uuid,text) from public,anon;
grant execute on function public.set_attendance_mode(text),public.set_lesson_attendance(uuid,uuid,text) to authenticated;
revoke all on function private.guard_attendance_preference() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
