begin;
-- An occurrence survives changes to its schedule, plan and payment metadata.
-- Only the student has an FK: source/package/plan IDs are historical references.
create table public.lesson_occurrences (
 id uuid primary key default gen_random_uuid(),
 student_id uuid not null references public.students on delete cascade,
 teacher_id uuid not null,
 source_kind text not null check(source_kind in ('schedule','appointment','makeup')),
 source_id uuid not null,
 lesson_date date not null,
 lesson_time time not null,
 duration_minutes integer not null check(duration_minutes between 15 and 180),
 status text not null check(status in ('agendada','dada','falta','desmarcada','reposicao','feriado')),
 counts boolean not null,
 status_source text not null check(status_source in ('presumed','exception','holiday')),
 plan_snapshot jsonb not null,
 package_ref text,
 package_position integer,
 package_snapshot jsonb,
 event_snapshot jsonb,
 holiday_name text,
 holiday_consumes boolean,
 meet_url text,
 first_joined_at timestamptz,
 captured_at timestamptz not null default now(),
 unique(student_id,source_kind,source_id,lesson_date)
);
create index lesson_occurrences_student_date on public.lesson_occurrences(student_id,lesson_date,lesson_time);
create table public.lesson_occurrence_changes (
 id uuid primary key default gen_random_uuid(),
 occurrence_id uuid not null references public.lesson_occurrences on delete cascade,
 changed_at timestamptz not null default now(),
 actor_id uuid,
 before_value jsonb not null,
 after_value jsonb not null
);
alter table public.lesson_occurrences enable row level security;
alter table public.lesson_occurrence_changes enable row level security;
revoke all on public.lesson_occurrences,public.lesson_occurrence_changes from public,anon,authenticated;
grant select on public.lesson_occurrences,public.lesson_occurrence_changes to authenticated;
grant select on public.lesson_occurrences,public.lesson_occurrence_changes to service_role;
create policy "own lesson history" on public.lesson_occurrences for select to authenticated
 using(teacher_id=(select auth.uid()) and (select private.teacher_session_valid()));
create policy "own lesson history changes" on public.lesson_occurrence_changes for select to authenticated
 using((select private.teacher_session_valid()) and exists(select 1 from public.lesson_occurrences o where o.id=occurrence_id and o.teacher_id=(select auth.uid())));

create function private.allocate_lesson_packages(sid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r record; chosen record; opening integer; opening_slot integer; debt integer;
begin
 select opening_credits into opening from public.students where id=sid;
 if not found then return;end if;
 debt:=greatest(0,-opening);
 for r in select * from public.lesson_occurrences where student_id=sid and counts and package_ref is null order by lesson_date,lesson_time,source_kind,source_id
 loop
  select n into opening_slot from generate_series(1,greatest(0,opening)) n
   where not exists(select 1 from public.lesson_occurrences o where o.student_id=sid and o.counts and o.package_ref='opening' and o.package_position=n) order by n limit 1;
  if opening_slot is not null then
   update public.lesson_occurrences set package_ref='opening',package_position=opening_slot where id=r.id;
  else
   select p.id,p.lessons,p.amount,p.paid_on,n.pos into chosen
   from (select p.*,coalesce(sum(p.lessons) over(order by p.paid_on,p.created_at,p.id rows between unbounded preceding and 1 preceding),0) as preceding from public.packages p where p.student_id=sid) p
   cross join lateral generate_series(1,p.lessons) n(pos)
   where p.preceding+n.pos>debt and not exists(
    select 1 from public.lesson_occurrences o where o.student_id=sid and o.counts and o.package_ref=p.id::text and o.package_position=n.pos)
   order by p.paid_on,p.created_at,p.id,n.pos limit 1;
   if found then
    update public.lesson_occurrences set package_ref=chosen.id::text,package_position=chosen.pos,
      package_snapshot=jsonb_build_object('id',chosen.id,'lessons',chosen.lessons,'amount',chosen.amount,'paid_on',chosen.paid_on) where id=r.id;
   end if;
  end if;
 end loop;
end;$$;

create function private.capture_lesson_history(sid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare st public.students; local_now timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 select * into st from public.students where id=sid for update;
 if not found then return;end if;
 update public.lesson_occurrences set status='dada' where student_id=sid and status='agendada' and lesson_date+lesson_time<=local_now;
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
   case when o.kind='makeup' then 'reposicao' when e.id is not null then e.kind when h.id is not null then 'feriado' else 'dada' end state,
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

-- A single RPC resolves authorization before taking locks, and bounds each batch.
create function public.ensure_lesson_history(p_student_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if p_student_ids is null or cardinality(p_student_ids)>200 then raise exception 'Lote inválido.' using errcode='22023';end if;
 if coalesce(auth.role(),'')<>'service_role' and (auth.uid() is null or not private.teacher_session_valid() or exists(select 1 from unnest(p_student_ids) x where not exists(select 1 from public.students s where s.id=x and s.teacher_id=auth.uid()))) then raise insufficient_privilege;end if;
 for sid in select distinct x from unnest(p_student_ids) x order by x loop perform private.capture_lesson_history(sid);end loop;
 return;
end;$$;
revoke all on function public.ensure_lesson_history(uuid[]) from public,anon;
grant execute on function public.ensure_lesson_history(uuid[]) to authenticated,service_role;

-- Protect history even when data changes through the Data API instead of this UI.
create function private.preserve_lesson_history() returns trigger
language plpgsql security definer set search_path='' as $$
declare sid uuid;
begin
 if tg_table_name='students' then
  perform private.capture_lesson_history(old.id);
  if new.opening_credits<>old.opening_credits and exists(select 1 from public.lesson_occurrences where student_id=old.id) then raise exception 'O saldo inicial não pode mudar depois de registrar aulas.';end if;
 elsif tg_table_name='plans' then
  for sid in select id from public.students where plan_id=old.id order by id loop perform private.capture_lesson_history(sid);end loop;
 elsif tg_table_name in ('holidays','holiday_settings') then
  for sid in select id from public.students where teacher_id=coalesce((to_jsonb(old)->>'teacher_id')::uuid,(to_jsonb(new)->>'teacher_id')::uuid) order by id loop perform private.capture_lesson_history(sid);end loop;
 else
  sid:=coalesce((to_jsonb(old)->>'student_id')::uuid,(to_jsonb(new)->>'student_id')::uuid);
  perform private.capture_lesson_history(sid);
  if tg_table_name='packages' and tg_op<>'INSERT' and exists(select 1 from public.students where id=sid) and exists(select 1 from public.lesson_occurrences where student_id=sid and package_ref=old.id::text) then
   if tg_op='DELETE' or (new.lessons,new.amount,new.paid_on) is distinct from (old.lessons,old.amount,old.paid_on) then raise exception 'Este pagamento já está vinculado ao histórico de aulas e não pode ser removido ou reescrito.';end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger a_history_student before update of plan_id,price_override,opening_credits on public.students for each row execute function private.preserve_lesson_history();
create trigger a_history_plan before update or delete on public.plans for each row execute function private.preserve_lesson_history();
create trigger a_history_schedule before update or delete on public.schedules for each row execute function private.preserve_lesson_history();
create trigger a_history_appointment before update or delete on public.appointments for each row execute function private.preserve_lesson_history();
create trigger a_history_event before insert or update or delete on public.lesson_events for each row execute function private.preserve_lesson_history();
create trigger a_history_package before insert or update or delete on public.packages for each row execute function private.preserve_lesson_history();
create trigger a_history_holiday before insert or update or delete on public.holidays for each row execute function private.preserve_lesson_history();
create trigger a_history_holiday_settings before insert or update or delete on public.holiday_settings for each row execute function private.preserve_lesson_history();

-- Status corrections remain explicit and auditable; snapshots of time/plan never move.
create function private.correct_lesson_history() returns trigger
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
   update public.lesson_occurrences set status=coalesce(ev.kind,case when r.holiday_name is not null then 'feriado' else 'dada' end),
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
create trigger history_event_correction after insert or update or delete on public.lesson_events for each row execute function private.correct_lesson_history();

-- Corrections remain possible after the originating schedule has been removed.
create or replace function public.guard_lesson_origin() returns trigger language plpgsql security definer set search_path='' as $$
declare tid uuid;
begin
 select teacher_id into tid from public.students where id=new.student_id;
 if auth.uid() is not null and tid is distinct from auth.uid() then raise exception 'Aluno não encontrado nesta conta.';end if;
 if new.kind='reposicao' then return new;end if;
 if new.time is null or (not exists(select 1 from public.schedules where student_id=new.student_id and public.schedule_on_day(new.date,starts_on,ends_on,weekday,monthly_day) and time=new.time) and not exists(select 1 from public.appointments where student_id=new.student_id and date=new.date and time=new.time) and not exists(select 1 from public.lesson_occurrences where student_id=new.student_id and lesson_date=new.date and lesson_time=new.time and source_kind<>'makeup')) then raise exception 'A aula não consta na agenda ou no histórico deste aluno.';end if;
 return new;
end;$$;
-- Freeze the occurrence on an actual conference callback, even five minutes early.
create function private.capture_joined_lesson() returns trigger
language plpgsql security definer set search_path='' as $$
declare st public.students; p public.plans; origin record;
begin
 if new.joined_at is null then return new;end if;
 perform private.capture_lesson_history(new.student_id);
 select * into st from public.students where id=new.student_id for update;
 if st.teacher_id<>new.teacher_id then raise insufficient_privilege;end if;
 select * into p from public.plans where id=st.plan_id;
 select s.time,s.duration_minutes,s.meet_url into origin from public.schedules s where new.source_kind='schedule' and s.id=new.source_id and s.student_id=new.student_id and public.schedule_on_day(new.lesson_date,s.starts_on,s.ends_on,s.weekday,s.monthly_day)
 union all select a.time,a.duration_minutes,a.meet_url from public.appointments a where new.source_kind='appointment' and a.id=new.source_id and a.student_id=new.student_id and a.date=new.lesson_date
 union all select e.time,e.duration_minutes,e.meet_url from public.lesson_events e where new.source_kind='makeup' and e.id=new.source_id and e.student_id=new.student_id and e.date=new.lesson_date and e.kind='reposicao';
 if found then
  insert into public.lesson_occurrences(student_id,teacher_id,source_kind,source_id,lesson_date,lesson_time,duration_minutes,status,counts,status_source,plan_snapshot,event_snapshot,meet_url,first_joined_at)
  values(st.id,st.teacher_id,new.source_kind,new.source_id,new.lesson_date,origin.time,origin.duration_minutes,case when new.source_kind='makeup' then 'reposicao' else 'agendada' end,true,case when new.source_kind='makeup' then 'exception' else 'presumed' end,jsonb_build_object('id',p.id,'name',p.name,'lessons',p.lessons,'price',coalesce(st.price_override,p.price)),case when new.source_kind='makeup' then (select to_jsonb(e) from public.lesson_events e where e.id=new.source_id) end,origin.meet_url,new.joined_at)
  on conflict(student_id,source_kind,source_id,lesson_date) do update set first_joined_at=coalesce(lesson_occurrences.first_joined_at,excluded.first_joined_at);
 end if;
 update public.lesson_occurrences set first_joined_at=coalesce(first_joined_at,new.joined_at) where student_id=new.student_id and source_kind=new.source_kind and source_id=new.source_id and lesson_date=new.lesson_date;
 perform private.allocate_lesson_packages(new.student_id);
 return new;
end;$$;
create trigger history_conference_join after insert or update of joined_at on public.classroom_participation for each row execute function private.capture_joined_lesson();

revoke all on function private.capture_lesson_history(uuid),private.allocate_lesson_packages(uuid),private.preserve_lesson_history(),private.correct_lesson_history(),private.capture_joined_lesson() from public,anon,authenticated,service_role;
-- Freeze the baseline from the data still available at rollout.
do $$ declare sid uuid; begin
 for sid in select id from public.students order by id loop perform private.capture_lesson_history(sid);end loop;
end;$$;
notify pgrst,'reload schema';
commit;
