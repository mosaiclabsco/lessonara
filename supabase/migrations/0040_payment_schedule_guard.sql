begin;
-- The rule also covers direct Data API inserts and manual Pix confirmation.
create function private.require_payment_schedule() returns trigger
language plpgsql security definer set search_path='' as $$
declare st public.students; mode text;
begin
 select * into st from public.students where id=new.student_id for update;
 if not found then raise exception 'Aluno não encontrado.';end if;
 if auth.role() is distinct from 'service_role' and (st.teacher_id is distinct from auth.uid() or not private.teacher_session_valid()) then raise insufficient_privilege;end if;
 select scheduling_mode into mode from public.plans where id=st.plan_id and teacher_id=st.teacher_id;
 if not found then raise exception 'Escolha um plano para o aluno antes de registrar o pagamento.';end if;
 if coalesce(mode,'recurring')<>'flexible' and not exists(select 1 from public.schedules where student_id=st.id and (ends_on is null or ends_on>=(now() at time zone 'America/Sao_Paulo')::date)) then raise exception 'Cadastre um horário fixo na aba Horários antes de registrar o pagamento deste plano.';end if;
 return new;
end;$$;
revoke all on function private.require_payment_schedule() from public,anon,authenticated;
create trigger aa_payment_schedule_guard before insert on public.packages for each row execute function private.require_payment_schedule();
commit;
notify pgrst,'reload schema';
