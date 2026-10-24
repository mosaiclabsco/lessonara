begin;
alter table public.plans add column code text not null default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
alter table public.plans add constraint plans_code_unique unique(code);
alter table public.plans add constraint plans_code_format check(code ~ '^[A-F0-9]{10}$');
alter table public.plans add constraint plans_name_valid check(char_length(trim(name)) between 1 and 120 and name !~ '[[:cntrl:]]');
create function public.protect_plan_code() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='INSERT' then
  -- Ignore client-supplied codes; the database owns this identifier.
  new.code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
 elsif new.code is distinct from old.code then
  raise exception 'O código do plano não pode ser alterado.' using errcode='22023';
 end if;
 return new;
end;$$;
revoke all on function public.protect_plan_code() from public,anon,authenticated;
create trigger protect_plan_code before insert or update on public.plans for each row execute function public.protect_plan_code();
commit;
