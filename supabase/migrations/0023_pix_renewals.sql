begin;
create table public.teacher_receivables (
 teacher_id uuid primary key references public.teachers on delete cascade,
 key_type text not null check(key_type in ('cpf','cnpj','email','phone','random')),
 pix_key text not null check(length(pix_key) between 3 and 77 and pix_key !~ '[[:cntrl:]]'),
 receiver_name text not null check(receiver_name ~ '^[A-Z0-9 ]{1,25}$'),
 receiver_city text not null check(receiver_city ~ '^[A-Z0-9 ]{1,15}$'),
 updated_at timestamptz not null default now(),
 check(case key_type when 'cpf' then pix_key ~ '^[0-9]{11}$' when 'cnpj' then pix_key ~ '^[0-9]{14}$' when 'phone' then pix_key ~ '^\+[1-9][0-9]{7,14}$' when 'random' then pix_key ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' else pix_key ~ '^[^ @]+@[^ @]+\.[^ @]+$' end)
);
alter table public.teacher_receivables enable row level security;
revoke all on public.teacher_receivables from anon,authenticated;
grant select,insert,update,delete on public.teacher_receivables to authenticated;
grant all on public.teacher_receivables to service_role;
create policy "own receivables" on public.teacher_receivables to authenticated using(teacher_id=auth.uid() and (select private.teacher_session_valid())) with check(teacher_id=auth.uid() and (select private.teacher_session_valid()));
create table public.renewal_requests (
 id uuid primary key default gen_random_uuid(),student_id uuid not null references public.students on delete cascade,
 teacher_id uuid not null references public.teachers on delete cascade,plan_id uuid references public.plans on delete set null,
 plan_name text not null,amount numeric(12,2) not null check(amount>0 and amount<=99000),lessons integer not null check(lessons between 1 and 1000),
 pix jsonb not null,status text not null default 'ready' check(status in ('ready','pending','confirmed','rejected','cancelled')),
 created_at timestamptz not null default now(),reported_at timestamptz,resolved_at timestamptz,
 package_id uuid unique references public.packages on delete set null,resolution_note text check(length(resolution_note)<=400),
 check((status='pending')=(reported_at is not null and resolved_at is null))
);
create unique index renewal_one_open on public.renewal_requests(student_id) where status in ('ready','pending');
create index renewal_teacher_status on public.renewal_requests(teacher_id,status,created_at);
alter table public.renewal_requests enable row level security;
revoke all on public.renewal_requests from anon,authenticated;
grant select on public.renewal_requests to authenticated;
grant all on public.renewal_requests to service_role;
create policy "own renewals" on public.renewal_requests for select to authenticated using(teacher_id=auth.uid() and (select private.teacher_session_valid()));
-- Only the server may quote/report on behalf of an authenticated student. Browser IDs never determine prices.
create function public.prepare_student_renewal(p_student uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare st public.students;p public.plans;pix public.teacher_receivables;q uuid;amount numeric;
begin
 select * into st from public.students where id=p_student and active for update;
 if not found then raise exception 'Aluno não disponível.';end if;
 select id into q from public.renewal_requests where student_id=st.id and status in ('ready','pending');
 if found then return q;end if;
 select * into p from public.plans where id=st.plan_id and teacher_id=st.teacher_id and is_active;
 if not found then raise exception 'Peça ao professor para conferir seu plano.';end if;
 amount:=coalesce(st.price_override,p.price);
 if amount<=0 then raise exception 'Este plano não tem cobrança Pix. Converse com o professor.';end if;
 select * into pix from public.teacher_receivables where teacher_id=st.teacher_id for share;
 if not found then raise exception 'O professor ainda não configurou o Pix.';end if;
 insert into public.renewal_requests(student_id,teacher_id,plan_id,plan_name,amount,lessons,pix)
 values(st.id,st.teacher_id,p.id,p.name,amount,p.lessons,jsonb_build_object('key_type',pix.key_type,'pix_key',pix.pix_key,'receiver_name',pix.receiver_name,'receiver_city',pix.receiver_city)) returning id into q;
 return q;
end;$$;
create function public.report_student_renewal(p_student uuid,p_request uuid,p_cancel boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare q public.renewal_requests;
begin
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
create function public.resolve_student_renewal(p_request uuid,p_paid_on date,p_reject boolean default false,p_note text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare q public.renewal_requests;pid uuid;tid uuid:=auth.uid();
begin
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
revoke all on function public.prepare_student_renewal(uuid),public.report_student_renewal(uuid,uuid,boolean),public.resolve_student_renewal(uuid,date,boolean,text) from public,anon,authenticated;
grant execute on function public.prepare_student_renewal(uuid),public.report_student_renewal(uuid,uuid,boolean) to service_role;
grant execute on function public.resolve_student_renewal(uuid,date,boolean,text) to authenticated;
notify pgrst,'reload schema';
commit;
