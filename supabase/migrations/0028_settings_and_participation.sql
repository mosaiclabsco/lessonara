begin;
alter table public.teachers add column reviewed_settings text[] not null default '{}'
 check(reviewed_settings <@ array['integrations','holidays','receivables','subscription','support']);
create function public.review_settings(p_tab text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.teacher_session_valid() then raise insufficient_privilege; end if;
 if p_tab is null or p_tab not in ('integrations','holidays','receivables','subscription','support') then raise exception 'Etapa inválida.' using errcode='22023'; end if;
 update public.teachers set reviewed_settings=array_append(reviewed_settings,p_tab) where id=auth.uid() and not p_tab=any(reviewed_settings);
end;$$;
revoke all on function public.review_settings(text) from public,anon;
grant execute on function public.review_settings(text) to authenticated;
create table public.classroom_participation(
 teacher_id uuid not null references public.teachers on delete cascade,
 student_id uuid not null references public.students on delete cascade,
 source_kind text not null check(source_kind in ('schedule','appointment','makeup')),
 source_id uuid not null, lesson_date date not null,
 participant_id text not null check(length(participant_id) between 1 and 120),
 participant_role text not null check(participant_role in ('teacher','student')),
 admitted_at timestamptz not null default now(), joined_at timestamptz,
 primary key(teacher_id,student_id,source_kind,source_id,lesson_date,participant_id,participant_role)
);
alter table public.classroom_participation enable row level security;
revoke all on public.classroom_participation from public,anon,authenticated;
grant select,insert,update on public.classroom_participation to service_role;
comment on table public.classroom_participation is 'Technical admission and conference callback; not proof of teaching or financial attendance.';
commit;
