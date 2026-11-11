-- Row Level Security tests — one check per policy group (CLAUDE.md: "a test for each policy").
-- Runs after the migration + seed. Every block rolls back, so tests don't affect each other.
-- Run locally with: npm run test:db

\set ON_ERROR_STOP on
\set QUIET on

create schema if not exists tests;
create or replace function tests.expect(ok boolean, what text) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', what; end if;
  raise notice 'ok - %', what;
end $$;
create or replace function tests.as_user(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- Fixture: a second owner with an UNPUBLISHED salon, a client, a booking and time off.
insert into auth.users (id, email) values ('00000000-0000-4000-a000-000000000003', 'owner2@hairday.test');
insert into businesses (id, owner_id, name) values ('10000000-0000-4000-a000-000000000099', '00000000-0000-4000-a000-000000000003', 'Hidden Salon');
insert into professionals (id, business_id, first_name) values ('20000000-0000-4000-a000-000000000099', '10000000-0000-4000-a000-000000000099', 'Hidden');
insert into clients (business_id, name, email) values
  ('10000000-0000-4000-a000-000000000099', 'Private Client', 'private@example.com'),
  ('10000000-0000-4000-a000-000000000001', 'Lisa Regular', 'regular@example.com');
insert into time_off (professional_id, starts_at, ends_at, note)
  select id, now() + interval '3 days', now() + interval '4 days', 'Vacation' from professionals where first_name = 'April';
insert into bookings (id, business_id, professional_id, customer_id, starts_at, ends_at, status)
  select '30000000-0000-4000-a000-000000000001', business_id, id, '00000000-0000-4000-a000-000000000002',
         date_trunc('day', now()) + interval '2 days 11 hours', date_trunc('day', now()) + interval '2 days 12 hours', 'confirmed'
  from professionals where first_name = 'April';
insert into bookings (id, business_id, professional_id, customer_id, starts_at, ends_at, status)
  select '30000000-0000-4000-a000-000000000002', business_id, id, '00000000-0000-4000-a000-000000000003',
         now() - interval '10 days', now() - interval '10 days' + interval '1 hour', 'completed'
  from professionals where first_name = 'Marcus';

\echo '— anonymous visitor'
begin;
set local role anon;
select tests.expect((select count(*) from businesses) = 3, 'anon sees the 3 published salons');
select tests.expect(not exists (select 1 from businesses where name = 'Hidden Salon'), 'anon cannot see an unpublished salon');
select tests.expect((select count(*) from services) > 0, 'anon can read visible services');
select tests.expect((select count(*) from categories) = 10, 'anon can read the 10 categories');
select tests.expect((select count(*) from clients) = 0, 'anon cannot read any clients');
select tests.expect((select count(*) from bookings) = 0, 'anon cannot read bookings');
select tests.expect((select count(*) from profiles) = 0, 'anon cannot read profiles');
select tests.expect((select count(*) from time_off) = 0, 'anon cannot read time off');
rollback;

\echo '— customer'
begin;
select tests.as_user('00000000-0000-4000-a000-000000000002');
set local role authenticated;
select tests.expect((select count(*) from profiles) = 1, 'customer sees only their own profile');
select tests.expect((select count(*) from bookings) = 1, 'customer sees only their own booking');
select tests.expect((select count(*) from clients) = 0, 'customer cannot read any salon''s clients');
select tests.expect((select count(*) from time_off) = 0, 'customer cannot read time off');
select tests.expect(not exists (select 1 from professionals where first_name = 'Hidden'), 'customer cannot see staff of an unpublished salon');
update businesses set name = 'Hacked' where id = '10000000-0000-4000-a000-000000000001';
select tests.expect((select name from businesses where id = '10000000-0000-4000-a000-000000000001') = 'Lisa''s Salon', 'customer cannot edit a salon they do not own');
do $$ begin
  insert into bookings (business_id, professional_id, customer_id, starts_at, ends_at)
    select business_id, id, auth.uid(), now() + interval '5 days', now() + interval '5 days 1 hour' from professionals limit 1;
  raise exception 'FAIL: customer inserted a booking directly';
exception when insufficient_privilege then raise notice 'ok - customer cannot create bookings directly (Edge Function only)';
end $$;
do $$ begin
  insert into favorites (customer_id, business_id) values (auth.uid(), '10000000-0000-4000-a000-000000000001');
  raise notice 'ok - customer can save a favorite';
end $$;
do $$ begin
  insert into favorites (customer_id, business_id) values ('00000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002');
  raise exception 'FAIL: customer saved a favorite for someone else';
exception when insufficient_privilege then raise notice 'ok - customer cannot write another person''s favorites';
end $$;
do $$ begin
  insert into reviews (booking_id, business_id, customer_id, rating)
    values ('30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', auth.uid(), 5);
  raise exception 'FAIL: customer reviewed a booking that is not completed';
exception when insufficient_privilege then raise notice 'ok - customer cannot review an unfinished booking';
end $$;
update profiles set first_name = 'Changed' where id = '00000000-0000-4000-a000-000000000001';
select tests.expect((select count(*) from profiles where first_name = 'Changed') = 0, 'customer cannot edit someone else''s profile');
rollback;

\echo '— salon owner'
begin;
select tests.as_user('00000000-0000-4000-a000-000000000001');
set local role authenticated;
select tests.expect((select count(*) from clients) = 1, 'owner sees their own salon''s client only');
select tests.expect(not exists (select 1 from clients where name = 'Private Client'), 'owner cannot read another business''s clients');
select tests.expect((select count(*) from time_off) = 1, 'owner sees their staff''s time off');
select tests.expect((select count(*) from bookings) >= 2, 'owner sees bookings at their salons');
update services set price_cents = 9000 where name = 'Adult cut';
select tests.expect((select price_cents from services where name = 'Adult cut') = 9000, 'owner can edit their own service');
do $$ begin
  insert into businesses (owner_id, name) values (auth.uid(), 'Second Location');
  raise notice 'ok - owner can create a business';
end $$;
do $$ begin
  insert into businesses (owner_id, name) values ('00000000-0000-4000-a000-000000000003', 'Impersonated');
  raise exception 'FAIL: created a business owned by someone else';
exception when insufficient_privilege then raise notice 'ok - cannot create a business for another person';
end $$;
rollback;

\echo '— second owner (unpublished salon)'
begin;
select tests.as_user('00000000-0000-4000-a000-000000000003');
set local role authenticated;
select tests.expect(exists (select 1 from businesses where name = 'Hidden Salon'), 'owner sees their own unpublished salon');
select tests.expect((select count(*) from clients) = 1, 'second owner sees only their own client');
do $$ begin
  insert into reviews (booking_id, business_id, customer_id, rating, body)
    values ('30000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000003', auth.uid(), 5, 'Great fade');
  raise notice 'ok - customer can review their own completed booking';
end $$;
rollback;

\echo '— rules every role must follow'
begin;
do $$ begin
  insert into bookings (business_id, professional_id, starts_at, ends_at, status)
    select business_id, professional_id, starts_at + interval '30 minutes', ends_at + interval '30 minutes', 'pending_payment'
    from bookings where id = '30000000-0000-4000-a000-000000000001';
  raise exception 'FAIL: double booking was allowed';
exception when exclusion_violation then raise notice 'ok - the same professional cannot be double-booked';
end $$;
do $$ begin
  insert into bookings (business_id, professional_id, starts_at, ends_at, status)
    select business_id, professional_id, starts_at + interval '30 minutes', ends_at + interval '30 minutes', 'cancelled'
    from bookings where id = '30000000-0000-4000-a000-000000000001';
  raise notice 'ok - a cancelled booking does not block the slot';
end $$;
do $$ begin
  update businesses set is_published = true where name = 'Hidden Salon';
  raise exception 'FAIL: published a salon without payouts';
exception when check_violation then raise notice 'ok - a salon cannot be published before payouts are enabled';
end $$;
do $$ begin
  insert into services (business_id, name, price_cents, duration_min) values ('10000000-0000-4000-a000-000000000001', 'Odd length', 1000, 20);
  raise exception 'FAIL: 20-minute service accepted';
exception when check_violation then raise notice 'ok - service durations must be 15-minute steps';
end $$;
select tests.expect((select count(*) from profiles) = (select count(*) from auth.users), 'every account got a profile row');
rollback;

\echo 'All RLS tests passed.'
