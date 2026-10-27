begin;
alter table public.teachers add column onboarding_dismissed_at timestamptz;

-- Closing this presentation-only guide never grants access or changes a plan.
-- Completion is checked against the authenticated teacher and current plan.
create function public.dismiss_onboarding() returns void
language plpgsql security definer set search_path='' as $$
declare t public.teachers;
begin
  if auth.uid() is null or not private.teacher_session_valid() then raise insufficient_privilege; end if;
  select * into t from public.teachers where id=auth.uid() for update;
  if not found then raise insufficient_privilege; end if;
  if t.profile_completed_at is null or length(btrim(t.name))=0 or t.lesson_minutes is null
    or t.lesson_minutes not between 15 and 180 or t.lesson_minutes % 15<>0
    or not exists(select 1 from public.plans where teacher_id=t.id and is_active)
    or not (array['holidays','receivables','support'] <@ t.reviewed_settings)
    or (t.platform_plan in ('plus','pro') and not ('integrations'=any(t.reviewed_settings))) then
    raise exception 'Conclua todas as etapas antes de fechar o guia.' using errcode='22023';
  end if;
  update public.teachers set onboarding_dismissed_at=coalesce(onboarding_dismissed_at,now()) where id=t.id;
end;
$$;
revoke all on function public.dismiss_onboarding() from public,anon;
grant execute on function public.dismiss_onboarding() to authenticated;
notify pgrst,'reload schema';
commit;
