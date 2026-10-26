begin;

-- Case and surrounding spaces never create a second identity. Duplicates must
-- be reviewed before applying; the migration deliberately does not delete data.
create unique index teachers_email_unique
  on public.teachers (lower(btrim(email)));
create unique index students_teacher_email_unique
  on public.students (teacher_id, lower(btrim(email))) where email is not null;

create function public.normalize_teacher_email() returns trigger
language plpgsql set search_path='' as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;
revoke execute on function public.normalize_teacher_email() from public, anon, authenticated;
create trigger normalize_teacher_email before insert or update of email on public.teachers
  for each row execute function public.normalize_teacher_email();

notify pgrst, 'reload schema';
commit;
