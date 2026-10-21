begin;
alter table public.students add column opening_credits integer not null default 0 check(opening_credits between -1000 and 1000);
alter table public.teachers add column import_onboarding text not null default 'pending' check(import_onboarding in ('pending','started','skipped','completed'));
create table public.student_imports (
 id uuid primary key default gen_random_uuid(),teacher_id uuid not null references public.teachers on delete cascade,
 mode text not null check(mode in ('guided','assisted')),status text not null default 'waiting' check(status in ('waiting','review','completed','cancelled')),
 filename text not null check(length(filename) between 1 and 120),file_hash text not null check(file_hash ~ '^[a-f0-9]{64}$'),
 object_path text,preview jsonb check(preview is null or (jsonb_typeof(preview)='array' and jsonb_array_length(preview)<=200 and pg_column_size(preview)<=1048576)),
 revision integer not null default 0,team_note text check(length(team_note)<=2000),result_ids uuid[],
 created_at timestamptz not null default now(),completed_at timestamptz,
 unique(teacher_id,file_hash)
);
create index imports_teacher_status on public.student_imports(teacher_id,status,created_at);
alter table public.student_imports enable row level security;
revoke all on public.student_imports from public,anon,authenticated;
grant select on public.student_imports to authenticated;
grant all on public.student_imports to service_role;
create policy "own imports" on public.student_imports for select to authenticated using(teacher_id=auth.uid() and (select private.teacher_session_valid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('lessonara-imports','lessonara-imports',false,524288,array['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/octet-stream']) on conflict(id) do nothing;
-- No browser Storage policies: only the authorized server and support operator handle originals.
create function private.import_teacher() returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid:=auth.uid();
begin
 if tid is null or not private.teacher_session_valid() or not exists(select 1 from public.teachers where id=tid and platform_plan in ('plus','pro') and profile_completed_at is not null) then raise exception 'A importação está disponível para professores configurados no Plus e Pro.' using errcode='42501';end if;
 return tid;
end;$$;
revoke all on function private.import_teacher() from public,anon,authenticated;
create function public.open_student_import(p_mode text,p_filename text,p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare tid uuid:=private.import_teacher();batch uuid;
begin
 perform pg_advisory_xact_lock(hashtext('lessonara-import:'||tid::text));
 select id into batch from public.student_imports where teacher_id=tid and file_hash=p_hash;
 if found then return batch;end if;
 if (select count(*) from public.student_imports where teacher_id=tid and status in ('waiting','review'))>=2 then raise exception 'Conclua ou cancele uma importação antes de enviar outro arquivo.';end if;
 insert into public.student_imports(teacher_id,mode,filename,file_hash) values(tid,p_mode,p_filename,p_hash) returning id into batch;
 update public.teachers set import_onboarding='started' where id=tid;
 return batch;
end;$$;
create function public.stage_student_import(p_id uuid,p_preview jsonb,p_note text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.student_imports set preview=p_preview,team_note=p_note,status='review',revision=revision+1 where id=p_id and status in ('waiting','review');
 if not found then raise exception 'Pedido encerrado ou não encontrado.';end if;
end;$$;
create function public.cancel_student_import(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare tid uuid:=auth.uid();
begin
 if tid is null or not private.teacher_session_valid() then raise exception 'Sessão expirada.' using errcode='42501';end if;
 update public.student_imports set status='cancelled',preview=null,completed_at=now() where id=p_id and teacher_id=tid and status in ('waiting','review');
end;$$;
create function public.skip_student_import() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.teacher_session_valid() then raise exception 'Sessão expirada.' using errcode='42501';end if;
 update public.teachers set import_onboarding='skipped' where id=auth.uid() and import_onboarding='pending';
end;$$;
create function public.confirm_student_import(p_id uuid,p_revision integer,p_rows text[],p_invite boolean default false) returns uuid[] language plpgsql security definer set search_path='' as $$
declare tid uuid:=private.import_teacher();batch public.student_imports;r jsonb;slot jsonb;st uuid;ids uuid[]:='{}';p public.plans;start_date date;balance integer;price numeric;minutes integer;current_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
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
revoke all on function public.open_student_import(text,text,text),public.stage_student_import(uuid,jsonb,text),public.cancel_student_import(uuid),public.skip_student_import(),public.confirm_student_import(uuid,integer,text[],boolean) from public,anon,authenticated;
grant execute on function public.open_student_import(text,text,text),public.cancel_student_import(uuid),public.skip_student_import(),public.confirm_student_import(uuid,integer,text[],boolean) to authenticated;
grant execute on function public.stage_student_import(uuid,jsonb,text) to service_role;
notify pgrst,'reload schema';
commit;
