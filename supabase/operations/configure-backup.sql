-- Execute as postgres via psql after migration 0033. No password is committed.
-- Supply a randomly generated backup_password with psql's -v variable.
begin;
create role lessonara_backup login bypassrls connection limit 3 password :'backup_password';
alter role lessonara_backup set default_transaction_read_only=on;
alter role lessonara_backup set statement_timeout='15min';
alter role lessonara_backup set lock_timeout='10s';
grant usage on schema public,private,storage to lessonara_backup;
grant select on storage.buckets,storage.objects to lessonara_backup;
grant select on all tables in schema public,private to lessonara_backup;
grant select on all sequences in schema public,private to lessonara_backup;
alter default privileges for role postgres in schema public,private grant select on tables to lessonara_backup;
alter default privileges for role postgres in schema public,private grant select on sequences to lessonara_backup;
do $$begin
 if exists(select 1 from pg_namespace where nspname='supabase_migrations') then
  execute 'grant usage on schema supabase_migrations to lessonara_backup';
  execute 'grant select on all tables in schema supabase_migrations to lessonara_backup';
 end if;
end;$$;
commit;
-- Supabase may ignore custom USAGE grants on auth. Delegate only its export;
-- this does not give the reader membership in a platform administrator role.
begin;
create function private.backup_auth_records() returns jsonb
language plpgsql security definer set search_path='' as $$
declare t record; result jsonb:='[]'; records jsonb; columns jsonb;
begin
 for t in select tablename from pg_catalog.pg_tables where schemaname='auth' order by tablename loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from auth.%I r',t.tablename) into records;
  select jsonb_agg(a.attname order by a.attnum) into columns from pg_catalog.pg_attribute a
  where a.attrelid=format('auth.%I',t.tablename)::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated='';
  result:=result||jsonb_build_array(jsonb_build_object('table',t.tablename,'columns',columns,'rows',records));
 end loop;
 return result;
end;$$;
revoke all on function private.backup_auth_records() from public,anon,authenticated,service_role;
grant execute on function private.backup_auth_records() to lessonara_backup;
commit;
