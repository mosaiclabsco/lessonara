begin;
create or replace function private.reallocate_lesson_packages(sid uuid) returns void
language plpgsql security definer set search_path='' as $$
declare old_rows jsonb;
begin
 perform 1 from public.students where id=sid for update;
 select coalesce(jsonb_agg(to_jsonb(o)),'[]') into old_rows from public.lesson_occurrences o where student_id=sid;
 update public.lesson_occurrences set package_ref=null,package_position=null,package_snapshot=null where student_id=sid;
 perform private.allocate_lesson_packages(sid);
 insert into public.lesson_occurrence_changes(occurrence_id,actor_id,before_value,after_value)
 select o.id,auth.uid(),b.value,to_jsonb(o) from public.lesson_occurrences o cross join jsonb_array_elements(old_rows) b
 where o.student_id=sid and o.id=(b.value->>'id')::uuid and
 (o.package_ref,o.package_position,o.package_snapshot) is distinct from
 (b.value->>'package_ref',(b.value->>'package_position')::integer,nullif(b.value->'package_snapshot','null'::jsonb));
end;$$;
create or replace function private.reconstruct_lesson_history(sid uuid,starts date) returns integer
language plpgsql security definer set search_path='' as $$
declare st public.students; inserted integer; local_now timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 select * into st from public.students where id=sid for update;
 if not found then raise exception 'Aluno não encontrado.';end if;
 if starts is null or starts>local_now::date or starts<local_now::date-730 then raise exception 'Informe a data inicial nos últimos dois anos.';end if;
 if not exists(select 1 from public.schedules where student_id=sid and (ends_on is null or ends_on>=local_now::date)) then raise exception 'Cadastre um horário fixo antes de reconstruir as aulas ou use o lançamento manual.';end if;
 perform private.capture_lesson_history(sid);
 with origins as (
  select s.*,d::date lesson_date from public.schedules s cross join lateral generate_series(starts,least(s.starts_on-1,local_now::date),interval '1 day') d
  where s.student_id=sid and (s.ends_on is null or s.ends_on>=local_now::date)
   and public.schedule_on_day(d::date,starts,null,s.weekday,s.monthly_day)
 ), described as (
 select o.*,h.name holiday,hs.policy holiday_policy,e.kind event_kind,to_jsonb(e) ev
 from origins o left join public.holiday_settings hs on hs.teacher_id=st.teacher_id and hs.enabled and o.lesson_date>=hs.effective_from
 left join public.holidays h on h.teacher_id=hs.teacher_id and h.date=o.lesson_date
 left join lateral(select e.* from public.lesson_events e where e.student_id=sid and e.kind<>'reposicao' and e.date=o.lesson_date and (e.time is null or e.time=o.time) order by e.created_at desc,e.id desc limit 1) e on true
 where o.lesson_date+o.time<=local_now and not exists(select 1 from public.lesson_occurrences x where x.student_id=sid and x.lesson_date=o.lesson_date and x.lesson_time=o.time)
 )
 insert into public.lesson_occurrences(student_id,teacher_id,source_kind,source_id,lesson_date,lesson_time,duration_minutes,status,counts,status_source,plan_snapshot,event_snapshot,holiday_name,holiday_consumes,meet_url,provenance)
 select sid,st.teacher_id,'schedule',d.id,d.lesson_date,d.time,d.duration_minutes,
 coalesce(d.event_kind,case when d.holiday is not null then 'feriado' else 'dada' end),
 coalesce(d.event_kind<>'desmarcada',d.holiday is null or d.holiday_policy='consume'),
 case when d.event_kind is not null then 'exception' when d.holiday is not null then 'holiday' else 'presumed' end,
 jsonb_build_object('id',p.id,'name',p.name,'lessons',p.lessons,'price',coalesce(st.price_override,p.price)),
 d.ev,d.holiday,case when d.holiday is not null then d.holiday_policy='consume' end,d.meet_url,'retroactive'
 from described d left join public.plans p on p.id=st.plan_id on conflict do nothing;
 get diagnostics inserted=row_count;
 perform private.reallocate_lesson_packages(sid);
 return inserted;
end;$$;

commit;
notify pgrst,'reload schema';
