begin;
alter table private.job_runs drop constraint job_runs_job_key_check;
alter table private.job_runs add constraint job_runs_job_key_check check(job_key in ('renewals','emails','calendar','cleanup','lesson-reminders','backup'));
create or replace function public.start_job_run(p_job text) returns uuid language plpgsql security definer set search_path='' as $$
declare run_id uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise insufficient_privilege;end if;
 if p_job is null or p_job not in ('renewals','emails','calendar','cleanup','lesson-reminders','backup') then raise exception 'Unknown job';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('lessonara-job:'||p_job));
 update private.job_runs set status='failed',finished_at=now(),error_code='lease_expired' where job_key=p_job and status='running' and started_at<now()-case when p_job='backup' then interval '2 hours' else interval '2 minutes' end;
 if exists(select 1 from private.job_runs where job_key=p_job and status='running') then return null;end if;
 insert into private.job_runs(job_key) values(p_job) returning id into run_id;
 delete from private.job_runs where started_at<now()-interval '30 days' and status<>'running';
 return run_id;
end;$$;
notify pgrst,'reload schema';
commit;
