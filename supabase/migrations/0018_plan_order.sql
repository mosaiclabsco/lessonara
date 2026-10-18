-- Keep the teacher's chosen plan order consistent in every selector.
alter table public.plans add column if not exists sort_order integer not null default 0;
with positions as (
 select id,row_number() over(partition by teacher_id order by lessons,created_at,id)-1 as position
 from public.plans
) update public.plans p set sort_order=positions.position from positions where p.id=positions.id;
create or replace function public.reorder_teacher_plans(plan_ids uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Autenticação necessária.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,18));
 if plan_ids is null or cardinality(plan_ids)>1000 or array_position(plan_ids,null) is not null
 or cardinality(plan_ids)<>(select count(distinct id) from unnest(plan_ids) id)
 or cardinality(plan_ids)<>(select count(*) from public.plans where teacher_id=owner_id)
 or exists(select 1 from unnest(plan_ids) as requested(plan_id) where not exists(select 1 from public.plans p where p.id=requested.plan_id and p.teacher_id=owner_id))
 then raise exception 'Os planos mudaram. Atualize a página antes de reordenar.'; end if;
 update public.plans p set sort_order=ordered.position-1
 from unnest(plan_ids) with ordinality as ordered(id,position)
 where p.id=ordered.id and p.teacher_id=owner_id;
end;
$$;
revoke all on function public.reorder_teacher_plans(uuid[]) from public,anon;
grant execute on function public.reorder_teacher_plans(uuid[]) to authenticated;
