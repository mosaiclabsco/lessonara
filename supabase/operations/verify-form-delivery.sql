-- Run after 0021/0022, or in the same transaction as a dry-run of those migrations.
-- All fixture writes roll back. They never become visible to workers.
begin;
do $test$
declare
 provider text:=gen_random_uuid()::text; job_id uuid:=gen_random_uuid();
 waiting_id uuid:=gen_random_uuid(); blocked_id uuid:=gen_random_uuid();
 test_event_id text:='validation/'||gen_random_uuid()::text;
 test_recipient text:='delivery-'||gen_random_uuid()::text||'@resend.dev';
 actual text; n integer; test_plan uuid;
begin
 if has_function_privilege('authenticated','public.record_email_delivery_event(text,text,text,timestamptz)','execute') then raise exception 'authenticated can mutate provider delivery';end if;
 if has_table_privilege('authenticated','public.email_delivery_events','select') then raise exception 'authenticated can read private event metadata';end if;
 perform public.record_email_delivery_event(test_event_id,provider,'email.delivered',now());
 perform public.record_email_delivery_event(test_event_id,provider,'email.delivered',now());
 select count(*) into n from public.email_delivery_events e where e.provider_id=provider;
 if n<>1 then raise exception 'event deduplication failed';end if;
 insert into public.email_outbox(id,event_key,recipient,template,payload,status,provider_id)
 values(job_id,'validation/'||job_id,test_recipient,'welcome','{}','sent',provider);
 select delivery_status into actual from public.email_outbox where id=job_id;
 if actual is distinct from 'delivered' then raise exception 'event before provider mapping was lost';end if;
 perform public.record_email_delivery_event(test_event_id||'/delay',provider,'email.delivery_delayed',now()-interval '1 minute');
 select delivery_status into actual from public.email_outbox where id=job_id;
 if actual is distinct from 'delivered' then raise exception 'older delayed event replaced delivery';end if;
 insert into public.email_outbox(id,event_key,recipient,template,payload) values(waiting_id,'validation/'||waiting_id,test_recipient,'welcome','{}');
 perform public.record_email_delivery_event(test_event_id||'/bounce',provider,'email.bounced',now());
 if not public.email_recipient_blocked(test_recipient) then raise exception 'bounce did not suppress recipient';end if;
 select status into actual from public.email_outbox where id=waiting_id;
 if actual is distinct from 'cancelled' then raise exception 'pending email was not cancelled';end if;
 perform public.record_email_delivery_event(test_event_id||'/late-delivery',provider,'email.delivered',now()+interval '1 minute');
 select delivery_status into actual from public.email_outbox where id=job_id;
 if actual is distinct from 'bounced' then raise exception 'late delivery cleared terminal rejection';end if;
 insert into public.email_outbox(id,event_key,recipient,template,payload) values(blocked_id,'validation/'||blocked_id,test_recipient,'otp','{}');
 select status into actual from public.email_outbox where id=blocked_id;
 if actual is distinct from 'failed' then raise exception 'suppressed recipient accepted new OTP';end if;
 perform public.record_email_delivery_event(test_event_id||'/complaint',provider,'email.complained',now());
 select reason into actual from public.email_suppressions where email_suppressions.recipient=test_recipient;
 if actual is distinct from 'complained' then raise exception 'complaint did not persist suppression';end if;
 select p.id into test_plan from public.plans p join public.teachers t on t.id=p.teacher_id where t.email ilike '%dast%' limit 1;
 if test_plan is not null then
  begin
   update public.plans set name='' where id=test_plan;
   raise exception 'empty plan name accepted';
  exception when check_violation then null;end;
  begin
   update public.plans set price=99000.01 where id=test_plan;
   raise exception 'plan price above ceiling accepted';
  exception when check_violation then null;end;
 end if;
end;
$test$;
rollback;
select 'delivery invariants passed; all fixture writes rolled back' as result;
