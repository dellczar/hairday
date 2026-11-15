-- Phase 5: payments (SPEC §9, DECISIONS 2026-11-16).
--
-- The owner chose "charge after the appointment" (Open question 2): when a customer books, their card
-- is saved and checked with a Stripe SetupIntent. Server functions (supabase/functions/) charge it
-- after the visit, or charge the late-cancel / no-show amount. Nothing here talks to Stripe; the
-- database only records what the server functions did.

create type payment_status as enum (
  'none',         -- no card yet (holds, walk-ins)
  'card_saved',   -- card checked and saved; nothing charged yet
  'charging',     -- a server function is charging it right now
  'charged',      -- money taken
  'failed',       -- the charge was declined; the customer needs to update their card
  'not_charged'   -- cancelled in time, or by the salon: nothing will be charged
);

alter table bookings
  add column tip_percent int not null default 0 check (tip_percent between 0 and 100),
  add column payment_status payment_status not null default 'none',
  add column stripe_setup_intent_id text unique,
  add column stripe_payment_method_id text,
  add column card_label text,                       -- "Visa ending 4242", shown to the customer and salon
  add column charge_cents int not null default 0 check (charge_cents >= 0),
  add column charged_at timestamptz,
  add column payment_error text;

create index bookings_to_charge_idx on bookings (ends_at) where payment_status = 'card_saved';

-- Which Stripe Customer belongs to which person. Server functions only: if people could write this,
-- they could point their account at someone else's saved cards.
create table stripe_customers (
  profile_id uuid primary key references profiles (id) on delete cascade,
  customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table stripe_customers enable row level security;
revoke all on stripe_customers from anon, authenticated;

-- Stripe sends each webhook event at least once; remembering ids makes handling it twice harmless.
create table stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table stripe_events enable row level security;
revoke all on stripe_events from anon, authenticated;

-- Money and Stripe columns on bookings are written only by server functions (service role).
-- Owners still add walk-ins and move or cancel appointments (Phase 6) through the columns below.
revoke insert, update on bookings from anon, authenticated;
grant insert (business_id, professional_id, customer_id, client_id, starts_at, ends_at, status, source, subtotal_cents, total_cents)
  on bookings to authenticated;
grant update (client_id, professional_id, starts_at, ends_at, status, cancelled_at, cancelled_by)
  on bookings to authenticated;

-- A booking whose card is saved shouldn't be let go as an unpaid hold.
create or replace function release_expired_holds() returns int
language sql volatile security definer set search_path = public as $$
  with gone as (
    update bookings set status = 'cancelled', cancelled_at = now()
    where status = 'pending_payment' and payment_status = 'none' and created_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*)::int from gone;
$$;
revoke all on function release_expired_holds() from public, anon, authenticated;

-- Charge finished appointments every 15 minutes by calling the charge-due server function.
-- Needs pg_cron + pg_net and two Vault secrets (functions_url, cron_secret), which only the hosted
-- project has; skipped on the local test database.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule('charge-due', '*/15 * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'functions_url') || '/charge-due',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
        body := '{}'::jsonb)
      where exists (select 1 from vault.decrypted_secrets where name = 'cron_secret')
    $job$);
  end if;
end $$;
