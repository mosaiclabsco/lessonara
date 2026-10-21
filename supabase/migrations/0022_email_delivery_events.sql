begin;
alter table public.email_outbox add column delivery_status text check(delivery_status in ('delivered','delivery_delayed','bounced','complained','failed','suppressed'));
alter table public.email_outbox add column delivery_updated_at timestamptz;
grant select(delivery_status,delivery_updated_at) on public.email_outbox to authenticated;
create index email_outbox_provider on public.email_outbox(provider_id) where provider_id is not null;
create table public.email_delivery_events (
 event_id text primary key check(char_length(event_id) between 1 and 200),
 provider_id text not null check(char_length(provider_id) between 1 and 128),
 event_type text not null check(event_type in ('email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed')),
 occurred_at timestamptz not null, received_at timestamptz not null default now()
);
create index email_delivery_events_provider on public.email_delivery_events(provider_id);
create table public.email_suppressions (
 recipient text primary key,
 reason text not null check(reason in ('bounced','complained','suppressed')),
 updated_at timestamptz not null default now()
);
alter table public.email_delivery_events enable row level security;
alter table public.email_suppressions enable row level security;
revoke all on public.email_delivery_events,public.email_suppressions from public,anon,authenticated;
grant all on public.email_delivery_events,public.email_suppressions to service_role;

-- Event metadata is retained even if it arrives before the worker stores provider_id.
-- Terminal rejection/complaint cannot be overwritten by a delayed or reordered delivery.
create function public.apply_email_delivery_events(p_provider_id text) returns void
language plpgsql security definer set search_path='' as $$
declare job public.email_outbox; event public.email_delivery_events; outcome text;
begin
 select * into event from public.email_delivery_events where provider_id=p_provider_id
 order by case event_type when 'email.complained' then 6 when 'email.bounced' then 5 when 'email.suppressed' then 4 when 'email.failed' then 3 when 'email.delivered' then 2 else 1 end desc,occurred_at desc,event_id desc limit 1;
 if not found then return; end if;
 outcome:=substr(event.event_type,7);
 for job in select * from public.email_outbox where provider_id=p_provider_id for update loop
  update public.email_outbox set delivery_status=outcome,delivery_updated_at=event.occurred_at where id=job.id;
  if outcome in ('bounced','complained','suppressed') then
   insert into public.email_suppressions(recipient,reason) values(lower(trim(job.recipient)),outcome)
    on conflict(recipient) do update set reason=case when public.email_suppressions.reason='complained' then 'complained' else excluded.reason end,updated_at=now();
   update public.email_outbox set status='cancelled',last_error='recipient_suppressed',payload='{}',delivery=null
    where lower(trim(recipient))=lower(trim(job.recipient)) and status in ('pending','sending') and id<>job.id;
  end if;
 end loop;
end;$$;
create function public.record_email_delivery_event(p_id text,p_provider_id text,p_type text,p_occurred_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_id is null or p_provider_id is null or p_type is null or p_occurred_at is null or p_occurred_at>now()+interval '1 day' then raise exception 'Invalid event';end if;
 insert into public.email_delivery_events(event_id,provider_id,event_type,occurred_at)
 values(p_id,p_provider_id,p_type,p_occurred_at) on conflict(event_id) do nothing;
 if exists(select 1 from public.email_delivery_events where event_id=p_id and (provider_id<>p_provider_id or event_type<>p_type or occurred_at<>p_occurred_at)) then raise exception 'Conflicting event';end if;
 perform public.apply_email_delivery_events(p_provider_id);
end;$$;
create function public.attach_email_delivery_events() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.provider_id is not null then perform public.apply_email_delivery_events(new.provider_id);end if;
 return new;
end;$$;
create trigger attach_email_delivery_events after insert or update of provider_id on public.email_outbox
for each row execute function public.attach_email_delivery_events();
create function public.email_recipient_blocked(p_recipient text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.email_suppressions where recipient=lower(trim(p_recipient)));
$$;
create function public.guard_suppressed_email() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if public.email_recipient_blocked(new.recipient) then
  new.status:='failed';new.last_error:='recipient_suppressed';new.payload:='{}';new.delivery:=null;
 end if;
 return new;
end;$$;
create trigger guard_suppressed_email before insert on public.email_outbox
for each row execute function public.guard_suppressed_email();
revoke all on function public.apply_email_delivery_events(text),public.record_email_delivery_event(text,text,text,timestamptz),public.attach_email_delivery_events(),public.email_recipient_blocked(text),public.guard_suppressed_email() from public,anon,authenticated;
grant execute on function public.record_email_delivery_event(text,text,text,timestamptz),public.email_recipient_blocked(text) to service_role;
commit;
