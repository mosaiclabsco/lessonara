begin;
alter table public.lesson_occurrences add column provenance text not null default 'schedule' check(provenance in ('schedule','retroactive','manual'));
create table private.payment_removals (
 package_id uuid primary key, student_id uuid not null, teacher_id uuid not null,
 actor_id uuid not null, removed_at timestamptz not null default now(),
 transaction_id bigint not null, before_value jsonb not null
);
alter table private.payment_removals enable row level security;
revoke all on private.payment_removals from public,anon,authenticated;

-- Reallocation follows lesson chronology, including newly reconstructed past lessons.
create function private.reallocate_lesson_packages(sid uuid) returns void
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
 (b.value->>'package_ref',(b.value->>'package_position')::integer,b.value->'package_snapshot');
end;$$;
create or replace function private.preserve_lesson_history() returns trigger
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
   if (tg_op='DELETE' and not exists(select 1 from private.payment_removals where package_id=old.id and transaction_id=txid_current())) or (tg_op<>'DELETE' and (new.lessons,new.amount,new.paid_on) is distinct from (old.lessons,old.amount,old.paid_on)) then raise exception 'Este pagamento já está vinculado ao histórico de aulas e não pode ser removido ou reescrito.';end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;

create function public.remove_paid_package(p_student_id uuid,p_package_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare st public.students; pack public.packages;
begin
 select * into st from public.students where id=p_student_id and teacher_id=auth.uid() for update;
 if not found or not private.teacher_session_valid() then raise insufficient_privilege;end if;
 select * into pack from public.packages where id=p_package_id and student_id=st.id for update;
 if not found then raise exception 'Pagamento não encontrado. Atualize a página.';end if;
 perform private.capture_lesson_history(st.id);
 insert into private.payment_removals(package_id,student_id,teacher_id,actor_id,transaction_id,before_value)
 values(pack.id,st.id,st.teacher_id,auth.uid(),txid_current(),to_jsonb(pack));
 delete from public.packages where id=pack.id and student_id=st.id;
 perform private.reallocate_lesson_packages(st.id);
end;$$;

create function private.reconstruct_lesson_history(sid uuid,starts date) returns integer
language plpgsql security definer set search_path='' as $$
declare st public.students; inserted integer; local_now timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 select * into st from public.students where id=sid for update;
 if not found then raise exception 'Aluno não encontrado.';end if;
 if starts is null or starts>local_now::date or starts<local_now::date-730 then raise exception 'Informe a data inicial nos últimos dois anos.';end if;
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

create function public.reconstruct_lesson_history(p_student_id uuid,p_starts_on date) returns integer
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.teacher_session_valid() or not exists(select 1 from public.students where id=p_student_id and teacher_id=auth.uid()) then raise insufficient_privilege;end if;
 return private.reconstruct_lesson_history(p_student_id,p_starts_on);
end;$$;

create function public.register_paid_package(p_student_id uuid,p_paid_on date,p_lessons integer,p_amount numeric,p_notes text,p_reconstruct boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare st public.students;
begin
 select * into st from public.students where id=p_student_id and teacher_id=auth.uid() for update;
 if not found or not private.teacher_session_valid() then raise insufficient_privilege;end if;
 if p_paid_on is null or p_lessons is null or p_lessons not between 1 and 1000 or p_amount is null or p_amount<0 or p_amount>99000 or length(coalesce(p_notes,''))>4000 then raise exception 'Confira os dados do pagamento.';end if;
 if p_reconstruct and not exists(select 1 from public.schedules where student_id=st.id and (ends_on is null or ends_on>=current_date)) then raise exception 'Cadastre um horário fixo antes de reconstruir as aulas ou use o lançamento manual no histórico.';end if;
 insert into public.packages(student_id,paid_on,lessons,amount,notes) values(st.id,p_paid_on,p_lessons,p_amount,p_notes);
 if p_reconstruct then perform private.reconstruct_lesson_history(st.id,p_paid_on);end if;
end;$$;
revoke all on function public.register_paid_package(uuid,date,integer,numeric,text,boolean) from public,anon;
grant execute on function public.register_paid_package(uuid,date,integer,numeric,text,boolean) to authenticated;

create function public.add_imported_lesson(p_student_id uuid,p_date date,p_time time) returns void
language plpgsql security definer set search_path='' as $$
declare st public.students; local_now timestamp:=now() at time zone 'America/Sao_Paulo';
begin
 select * into st from public.students where id=p_student_id and teacher_id=auth.uid() for update;
 if not found or not private.teacher_session_valid() then raise insufficient_privilege;end if;
 if p_date is null or p_time is null or p_date+p_time>local_now or p_date<local_now::date-730 or extract(minute from p_time) not in(0,30) or extract(second from p_time)<>0 then raise exception 'Informe data e horário passados, nos últimos dois anos.';end if;
 perform private.capture_lesson_history(st.id);
 if exists(select 1 from public.lesson_occurrences where student_id=st.id and lesson_date=p_date and lesson_time=p_time) then raise exception 'Já existe uma aula nesse horário. Corrija a aula existente.';end if;
 insert into public.lesson_occurrences(student_id,teacher_id,source_kind,source_id,lesson_date,lesson_time,duration_minutes,status,counts,status_source,plan_snapshot,provenance)
 select st.id,st.teacher_id,'appointment',gen_random_uuid(),p_date,p_time,t.lesson_minutes,'dada',true,'presumed',jsonb_build_object('id',p.id,'name',p.name,'lessons',p.lessons,'price',coalesce(st.price_override,p.price)),'manual'
 from public.teachers t left join public.plans p on p.id=st.plan_id where t.id=st.teacher_id;
 perform private.reallocate_lesson_packages(st.id);
end;$$;

create function public.correct_imported_lesson(p_student_id uuid,p_occurrence_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
declare before_row public.lesson_occurrences; after_row public.lesson_occurrences;
begin
 perform 1 from public.students where id=p_student_id and teacher_id=auth.uid() for update;
 if not found or not private.teacher_session_valid() then raise insufficient_privilege;end if;
 if p_status not in ('dada','falta','desmarcada') or p_status is null then raise exception 'Escolha um estado válido.';end if;
 select * into before_row from public.lesson_occurrences where id=p_occurrence_id and student_id=p_student_id and provenance in ('retroactive','manual') for update;
 if not found then raise exception 'Aula importada não encontrada.';end if;
 update public.lesson_occurrences set status=p_status,counts=p_status<>'desmarcada',status_source='exception' where id=before_row.id returning * into after_row;
 insert into public.lesson_occurrence_changes(occurrence_id,actor_id,before_value,after_value) values(before_row.id,auth.uid(),to_jsonb(before_row),to_jsonb(after_row));
 perform private.reallocate_lesson_packages(p_student_id);
end;$$;

create function private.reallocate_after_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin perform private.reallocate_lesson_packages(new.student_id); return null;end;$$;
create trigger payment_history_allocation after insert on public.packages for each row execute function private.reallocate_after_payment();
revoke all on function private.reallocate_lesson_packages(uuid),private.reconstruct_lesson_history(uuid,date),private.reallocate_after_payment() from public,anon,authenticated;
revoke all on function public.remove_paid_package(uuid,uuid),public.reconstruct_lesson_history(uuid,date),public.add_imported_lesson(uuid,date,time),public.correct_imported_lesson(uuid,uuid,text) from public,anon;
grant execute on function public.remove_paid_package(uuid,uuid),public.reconstruct_lesson_history(uuid,date),public.add_imported_lesson(uuid,date,time),public.correct_imported_lesson(uuid,uuid,text) to authenticated;
commit;
