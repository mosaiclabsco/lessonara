-- Apply only after migrations 0030 and 0031 and the split worker routes are deployed.
-- Keep the existing Vault entry; no plaintext secret belongs in this file.
begin;
create or replace function private.request_renewal_worker(p_start boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare chosen timestamptz;secret text; local_day date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 if p_start then
  insert into private.renewal_runs(scheduled_for)
  select (local_day+make_time(h,0,0)) at time zone 'America/Sao_Paulo' from unnest(array[8,18]) h
  where (local_day+make_time(h,0,0)) at time zone 'America/Sao_Paulo'<=now()
  on conflict do nothing;
 end if;
 update private.renewal_runs set status='failed',updated_at=now()
 where status in ('pending','running') and (locked_until is null or locked_until<=now())
 and (scheduled_for<now()-interval '24 hours' or (dispatches>=12 and requested_at<now()-interval '5 minutes'));
 select scheduled_for into chosen from private.renewal_runs where status in ('pending','running')
 and (locked_until is null or locked_until<=now()) and (requested_at is null or requested_at<=now()-interval '5 minutes')
 order by scheduled_for for update skip locked limit 1;
 if chosen is null then return;end if;
 select decrypted_secret into secret from vault.decrypted_secrets where name='lessonara_cron_secret';
 if secret is null then raise exception 'Worker credential not configured';end if;
 update private.renewal_runs set dispatches=dispatches+1,requested_at=now() where scheduled_for=chosen;
 perform net.http_get(url:='https://lessonara.mosaic-labs.co/api/cron/reminders',headers:=jsonb_build_object('Authorization','Bearer '||secret),timeout_milliseconds:=30000);
end;$$;
revoke all on function private.request_renewal_worker(boolean) from public,anon,authenticated,service_role;
-- Replacing named jobs is idempotent; existing scheduled runs are not replayed.
select cron.schedule('lessonara-reminders','0 11,21 * * *','select private.request_renewal_worker(true);');
select cron.schedule('lessonara-renewal-resume','*/5 * * * *','select private.request_renewal_worker(false);');
select cron.schedule('lessonara-emails','2-59/5 * * * *',$job$
 select net.http_get(url:='https://lessonara.mosaic-labs.co/api/cron/emails',headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='lessonara_cron_secret')),timeout_milliseconds:=30000);
$job$);
select cron.schedule('lessonara-calendar','3-59/5 * * * *',$job$
 select net.http_get(url:='https://lessonara.mosaic-labs.co/api/cron/calendar',headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='lessonara_cron_secret')),timeout_milliseconds:=30000);
$job$);
select cron.schedule('lessonara-cleanup','0 6 * * *',$job$
 select net.http_get(url:='https://lessonara.mosaic-labs.co/api/cron/cleanup',headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='lessonara_cron_secret')),timeout_milliseconds:=30000);
$job$);
select cron.schedule('lessonara-lessons','4-59/5 * * * *',$job$
 select net.http_get(url:='https://lessonara.mosaic-labs.co/api/cron/lessons',headers:=jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='lessonara_cron_secret')),timeout_milliseconds:=30000);
$job$);
commit;
