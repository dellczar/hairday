-- Phase 7, part 2: notifications (SPEC §11). Push through Expo, email through Resend; no SMS
-- (owner decision, Open question 6).
--
-- Bookings fill an outbox (`notifications`) from a trigger, so nothing is missed whichever path
-- changed the booking (app, server function, owner, cron). Each row says who, which booking, what
-- kind and when to send. The words are written at send time by the send-notifications server
-- function, from the booking as it is then. Nobody but the server can read or write the outbox.
--
--   customer: booking_confirmed, booking_moved, reminder_24h, reminder_2h, booking_cancelled, review_request
--   owner:    owner_new_booking, owner_moved, owner_cancelled, owner_daily (8 AM salon time)

create type notification_kind as enum (
  'booking_confirmed', 'booking_moved', 'reminder_24h', 'reminder_2h', 'booking_cancelled', 'review_request',
  'owner_new_booking', 'owner_moved', 'owner_cancelled', 'owner_daily'
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  business_id uuid references businesses (id) on delete cascade,
  booking_id uuid references bookings (id) on delete cascade,
  kind notification_kind not null,
  send_after timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts int not null default 0,
  push_sent boolean not null default false,
  email_sent boolean not null default false,
  error text,
  claimed_at timestamptz,
  -- The same message is never queued twice (e.g. a webhook and the app both confirming a booking).
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index notifications_due_idx on notifications (send_after) where status = 'pending';
create index notifications_booking_idx on notifications (booking_id);

alter table notifications enable row level security;
revoke all on notifications from anon, authenticated;

-- A phone's push token belongs to whoever signed in on it last.
create function push_token_moves_to_new_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from push_tokens where expo_token = new.expo_token and profile_id <> new.profile_id;
  return new;
end $$;
create trigger push_token_moves_to_new_owner before insert or update on push_tokens
  for each row execute function push_token_moves_to_new_owner();

-- ─────────────────────────────────────────────────────────── queueing

create function queue_notification(p_profile uuid, p_business uuid, p_booking uuid, p_kind notification_kind, p_at timestamptz, p_key text)
returns void language sql volatile security definer set search_path = public as $$
  insert into notifications (profile_id, business_id, booking_id, kind, send_after, dedupe_key)
  select p_profile, p_business, p_booking, p_kind, p_at, p_key
  where p_profile is not null
  on conflict (dedupe_key) do nothing;
$$;

-- Reminders and the review request for a confirmed booking at its current time. Ones that would go
-- out within 10 minutes of now are left out (booked 3 hours ahead → no "24 hours to go" reminder).
create function queue_visit_timeline(b bookings) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  k text := extract(epoch from b.starts_at)::bigint::text;
begin
  if b.customer_id is null then return; end if;
  if b.starts_at - interval '24 hours' > now() + interval '10 minutes' then
    perform queue_notification(b.customer_id, b.business_id, b.id, 'reminder_24h', b.starts_at - interval '24 hours', 'reminder_24h:' || b.id || ':' || k);
  end if;
  if b.starts_at - interval '2 hours' > now() + interval '10 minutes' then
    perform queue_notification(b.customer_id, b.business_id, b.id, 'reminder_2h', b.starts_at - interval '2 hours', 'reminder_2h:' || b.id || ':' || k);
  end if;
  perform queue_notification(b.customer_id, b.business_id, b.id, 'review_request', b.ends_at + interval '2 hours', 'review_request:' || b.id || ':' || k);
end $$;

-- Unsent reminders and the review request no longer apply.
create function drop_unsent(p_booking uuid) returns void
language sql volatile security definer set search_path = public as $$
  update notifications set status = 'skipped', error = 'booking changed'
  where booking_id = p_booking and status = 'pending' and kind in ('reminder_24h', 'reminder_2h', 'review_request');
$$;

create function queue_booking_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  was text := case when tg_op = 'INSERT' then null else old.status::text end;
  k text := extract(epoch from new.starts_at)::bigint::text;
begin
  -- Walk-ins and phone bookings are made by the salon itself: nothing to tell anyone.
  if new.source <> 'online' then return new; end if;
  select b.owner_id into owner from businesses b where b.id = new.business_id;

  if new.status = 'confirmed' and was is distinct from 'confirmed' then
    perform queue_notification(new.customer_id, new.business_id, new.id, 'booking_confirmed', now(), 'booking_confirmed:' || new.id);
    perform queue_notification(owner, new.business_id, new.id, 'owner_new_booking', now(), 'owner_new_booking:' || new.id);
    perform queue_visit_timeline(new);

  elsif new.status = 'confirmed' and was = 'confirmed' and (new.starts_at, new.professional_id) is distinct from (old.starts_at, old.professional_id) then
    -- Reminders for the old time are dropped and new ones queued (their keys include the time).
    perform drop_unsent(new.id);
    perform queue_notification(new.customer_id, new.business_id, new.id, 'booking_moved', now(), 'booking_moved:' || new.id || ':' || k);
    perform queue_notification(owner, new.business_id, new.id, 'owner_moved', now(), 'owner_moved:' || new.id || ':' || k);
    perform queue_visit_timeline(new);

  elsif new.status = 'cancelled' and was = 'confirmed' then
    perform drop_unsent(new.id);
    perform queue_notification(new.customer_id, new.business_id, new.id, 'booking_cancelled', now(), 'booking_cancelled:' || new.id);
    -- The owner hears about it unless they cancelled it themselves.
    if new.cancelled_by is distinct from owner then
      perform queue_notification(owner, new.business_id, new.id, 'owner_cancelled', now(), 'owner_cancelled:' || new.id);
    end if;

  elsif new.status = 'no_show' and was is distinct from 'no_show' then
    perform drop_unsent(new.id);
  end if;
  return new;
end $$;

create trigger queue_booking_notifications after insert or update of status, starts_at, professional_id on bookings
  for each row execute function queue_booking_notifications();

-- Owner's 8 AM summary, for salons with appointments that day. Run every 15 minutes; the window
-- runs until noon so a late run still sends it, and the key allows one per salon per day.
create function queue_daily_summaries() returns int
language sql volatile security definer set search_path = public as $$
  with due as (
    select b.id, b.owner_id, (now() at time zone b.time_zone)::date as day
    from businesses b
    where b.is_published
      and (now() at time zone b.time_zone)::time between time '08:00' and time '12:00'
      and exists (
        select 1 from bookings k
        where k.business_id = b.id and k.status = 'confirmed'
          and (k.starts_at at time zone b.time_zone)::date = (now() at time zone b.time_zone)::date)
  ), added as (
    insert into notifications (profile_id, business_id, kind, dedupe_key)
    select owner_id, id, 'owner_daily', 'owner_daily:' || id || ':' || day from due
    on conflict (dedupe_key) do nothing
    returning 1
  )
  select count(*)::int from added;
$$;

-- ─────────────────────────────────────────────────────────── sending (server only)

-- Hands the sender up to `n` due messages and marks them as being sent. Messages stuck "sending"
-- for 10 minutes (a crashed run) are retried; after 5 tries they're given up on.
create function claim_notifications(n int) returns setof notifications
language sql volatile security definer set search_path = public as $$
  update notifications set status = 'sending', attempts = attempts + 1, claimed_at = now()
  where id in (
    select id from notifications
    where ((status = 'pending' and send_after <= now()) or (status = 'sending' and claimed_at < now() - interval '10 minutes'))
      and attempts < 5
    order by send_after
    limit n
    for update skip locked)
  returning *;
$$;

revoke all on function queue_notification(uuid, uuid, uuid, notification_kind, timestamptz, text) from public, anon, authenticated;
revoke all on function queue_visit_timeline(bookings) from public, anon, authenticated;
revoke all on function drop_unsent(uuid) from public, anon, authenticated;
revoke all on function queue_daily_summaries() from public, anon, authenticated;
revoke all on function claim_notifications(int) from public, anon, authenticated;
grant execute on function claim_notifications(int) to service_role;

-- Every minute: send what's due (only calls the server when something is). Every 15 minutes: queue
-- owners' morning summaries. Needs pg_cron + pg_net + the Vault secrets from the payments migration;
-- skipped on the local test database.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule('daily-summaries', '*/15 * * * *', 'select public.queue_daily_summaries()');
    perform cron.schedule('send-notifications', '* * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url') || '/send-notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
        body := '{}'::jsonb)
      where exists (select 1 from vault.decrypted_secrets where name = 'cron_secret')
        and exists (select 1 from public.notifications where status = 'pending' and send_after <= now())
    $job$);
  end if;
end $$;
