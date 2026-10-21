-- Reject explicit nulls in direct Data API calls as well as validated Server Actions.
begin;
create or replace function public.resolve_student_renewal(p_request uuid,p_paid_on date,p_reject boolean default false,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare q public.renewal_requests;pid uuid;tid uuid:=auth.uid();
begin
 if p_reject is null then raise exception 'Escolha confirmar ou devolver para revisão.';end if;
 if tid is null or not private.teacher_session_valid() then raise exception 'Sessão expirada.' using errcode='42501';end if;
 perform 1 from public.students where id=(select student_id from public.renewal_requests where id=p_request and teacher_id=tid) and teacher_id=tid for update;
 select * into q from public.renewal_requests where id=p_request and teacher_id=tid for update;
 if not found then raise exception 'Solicitação não encontrada.' using errcode='42501';end if;
 if q.status='confirmed' and not p_reject then return q.package_id;end if;
 if q.status='rejected' and p_reject then return null;end if;
 if q.status<>'pending' then raise exception 'Esta solicitação já foi resolvida ou ainda não foi informada.';end if;
 if length(p_note)>400 then raise exception 'Use até 400 caracteres na observação.';end if;
 if not p_reject then
  if p_paid_on is null or p_paid_on>(now() at time zone 'America/Sao_Paulo')::date or p_paid_on<date '2000-01-01' then raise exception 'Confira a data do pagamento.';end if;
  perform 1 from public.students where id=q.student_id and teacher_id=tid for update;
  insert into public.packages(student_id,paid_on,lessons,amount,notes) values(q.student_id,p_paid_on,q.lessons,q.amount,'Renovação Pix confirmada manualmente. '||coalesce(p_note,'')) returning id into pid;
 end if;
 update public.renewal_requests set status=case when p_reject then 'rejected' else 'confirmed' end,resolved_at=now(),package_id=pid,resolution_note=nullif(trim(p_note),'') where id=q.id;
 return pid;
end;$$;
create or replace function public.report_student_renewal(p_student uuid,p_request uuid,p_cancel boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare q public.renewal_requests;
begin
 if p_cancel is null then raise exception 'Escolha uma ação válida.';end if;
 perform 1 from public.students where id=p_student and active for update;
 if not found then raise exception 'Aluno não disponível.';end if;
 select * into q from public.renewal_requests where id=p_request and student_id=p_student for update;
 if not found or q.status not in ('ready','pending') then raise exception 'Esta solicitação não está disponível.';end if;
 if p_cancel then
  if q.status<>'ready' then raise exception 'O professor precisa revisar o pagamento informado.';end if;
  update public.renewal_requests set status='cancelled',resolved_at=now() where id=q.id;
 elsif q.status='ready' then
  update public.renewal_requests set status='pending',reported_at=now() where id=q.id;
 end if;
end;$$;
create or replace function public.confirm_student_import(p_id uuid,p_revision integer,p_rows text[],p_invite boolean default false) returns uuid[] language plpgsql security definer set search_path='' as $$
declare tid uuid:=private.import_teacher();batch public.student_imports;r jsonb;slot jsonb;st uuid;ids uuid[]:='{}';p public.plans;start_date date;balance integer;price numeric;minutes integer;current_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if p_revision is null or p_invite is null then raise exception 'Revise a versão dos dados e a opção de convite.';end if;
 perform pg_advisory_xact_lock(hashtext('lessonara-import:'||tid::text));
 select * into batch from public.student_imports where id=p_id and teacher_id=tid for update;
 if not found then raise exception 'Importação não encontrada.' using errcode='42501';end if;
 if batch.status='completed' then return batch.result_ids;end if;
 if batch.status<>'review' or batch.revision<>p_revision then raise exception 'A prévia mudou. Atualize e revise novamente.';end if;
 if coalesce(cardinality(p_rows),0) not between 1 and 200 or cardinality(p_rows)<>(select count(distinct x) from unnest(p_rows)x) or (select count(*) from jsonb_array_elements(batch.preview) x where x->>'row_id'=any(p_rows) and x->>'error' is null)<>cardinality(p_rows) then raise exception 'Selecione de 1 a 200 linhas válidas da prévia.';end if;
 select lesson_minutes into minutes from public.teachers where id=tid;
 -- Calendar triggers use the same per-teacher lock; all local writes and queued jobs roll back together.
 perform pg_advisory_xact_lock(hashtext('lessonara-calendar:'||tid::text));
 for r in select x from jsonb_array_elements(batch.preview)x where x->>'row_id'=any(p_rows) loop
  if jsonb_typeof(r->'name')<>'string' or length(trim(r->>'name')) not between 1 and 120 or r->>'name' ~ '[[:cntrl:]]' or jsonb_typeof(r->'email')<>'string' or length(r->>'email')>254 or r->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(coalesce(r->>'notes',''))>4000 then raise exception 'Confira os dados da linha %.',r->>'row_id';end if;
  if exists(select 1 from public.students where teacher_id=tid and (lower(trim(name))=lower(trim(r->>'name')) or lower(email)=lower(r->>'email'))) then raise exception 'Linha %: aluno já existente. Revise as duplicatas.',r->>'row_id';end if;
  select * into p from public.plans where id=(r->>'plan_id')::uuid and teacher_id=tid and is_active for share;
  if not found then raise exception 'Linha %: plano não disponível nesta conta.',r->>'row_id';end if;
  start_date:=(r->>'starts_on')::date;balance:=(r->>'opening_credits')::integer;price:=(r->>'price_override')::numeric;
  if start_date is null or start_date<current_day or balance is null or balance not between -1000 and 1000 or (price is not null and (price<0 or price>99000 or price<>round(price,2))) then raise exception 'Linha %: confira início, saldo e valor.',r->>'row_id';end if;
  if r->>'phone' is not null and (r->>'phone' !~ '^\+[1-9][0-9]{7,14}$' or r->>'phone_country' !~ '^[A-Z]{2}$') then raise exception 'Linha %: telefone inválido.',r->>'row_id';end if;
  if jsonb_typeof(r->'schedules')<>'array' or jsonb_array_length(r->'schedules')>31 then raise exception 'Confira os horários.';end if;
  insert into public.students(teacher_id,slug,name,email,phone,phone_country,plan_id,price_override,opening_credits,notes)
  values(tid,replace(gen_random_uuid()::text,'-',''),trim(r->>'name'),lower(r->>'email'),r->>'phone',coalesce(r->>'phone_country','BR'),p.id,price,balance,r->>'notes') returning id into st;
  ids:=array_append(ids,st);
  for slot in select x from jsonb_array_elements(r->'schedules')x loop
   if slot->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Linha %: horário inválido.',r->>'row_id';end if;
   if slot->>'date' is not null then
    if (slot->>'date')::date<start_date then raise exception 'Data anterior ao saldo inicial.';end if;
    insert into public.appointments(teacher_id,student_id,date,time,duration_minutes) values(tid,st,(slot->>'date')::date,(slot->>'time')::time,minutes);
   else
    insert into public.schedules(student_id,weekday,monthly_day,time,starts_on,duration_minutes) values(st,(slot->>'weekday')::smallint,(slot->>'monthly_day')::smallint,(slot->>'time')::time,start_date,minutes);
   end if;
  end loop;
 end loop;
 if not p_invite then
  delete from public.email_outbox where student_id=any(ids) and template='welcome' and status='pending';
 end if;
 update public.student_imports set status='completed',result_ids=ids,preview=null,completed_at=now() where id=batch.id;
 update public.teachers set import_onboarding='completed' where id=tid;
 return ids;
end;$$;
notify pgrst,'reload schema';
commit;
