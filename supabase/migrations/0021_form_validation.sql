begin;
-- NOT VALID preserves historical rows while enforcing every new write/update.
alter table public.students add constraint student_name_length check (char_length(btrim(name)) between 1 and 120) not valid;
alter table public.students add constraint student_notes_length check (notes is null or char_length(notes) <= 4000) not valid;
alter table public.students add constraint student_price_ceiling check (price_override is null or price_override <= 99000) not valid;
alter table public.plans add constraint plan_name_length check (char_length(btrim(name)) between 1 and 120) not valid;
alter table public.plans add constraint plan_price_ceiling check (price <= 99000) not valid;
alter table public.packages add constraint package_amount_ceiling check (amount <= 99000) not valid;
alter table public.packages add constraint package_notes_length check (notes is null or char_length(notes) <= 4000) not valid;
alter table public.lesson_events add constraint lesson_note_length check (note is null or char_length(note) <= 4000) not valid;
alter table public.teachers add constraint teacher_name_length check (char_length(name) <= 120 and (profile_completed_at is null or char_length(btrim(name)) > 0)) not valid;
commit;
