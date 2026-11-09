begin;
alter table public.email_outbox drop constraint email_outbox_template_check;
alter table public.email_outbox add constraint email_outbox_template_check
 check(template in ('welcome','otp','reminder','campaign','lesson_notice','payment_reported'));

-- Queue and report commit together; one notification per payment request.
create function private.queue_payment_reported_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status='ready' and new.status='pending' and private.platform_feature_enabled(new.teacher_id,'emails') then
  insert into public.email_outbox(event_key,teacher_id,student_id,recipient,template,payload,expires_at)
  select 'payment_reported/'||new.id,new.teacher_id,new.student_id,lower(btrim(t.email)),
   'payment_reported',jsonb_build_object('request_id',new.id),now()+interval '24 hours'
  from public.teachers t join public.students s on s.id=new.student_id and s.teacher_id=t.id and s.active
  where t.id=new.teacher_id and not t.access_suspended
  on conflict(event_key) do nothing;
 end if;
 return new;
end;$$;
revoke all on function private.queue_payment_reported_email() from public,anon,authenticated,service_role;
create trigger payment_reported_email after update of status on public.renewal_requests
 for each row execute function private.queue_payment_reported_email();
notify pgrst,'reload schema';
commit;
