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

\echo '— owner setup (Phase 2)'
begin;
select tests.as_user('00000000-0000-4000-a000-000000000001');
set local role authenticated;
-- Everything an owner manages, for their own salon …
do $$
declare
  lisa uuid := '10000000-0000-4000-a000-000000000001';
  svc uuid; pro uuid;
begin
  insert into services (business_id, name, price_cents, duration_min) values (lisa, 'Gloss', 4500, 45) returning id into svc;
  insert into professionals (business_id, first_name, role) values (lisa, 'Nia', 'colorist') returning id into pro;
  insert into professional_services (professional_id, service_id) values (pro, svc);
  insert into availability (professional_id, weekday, starts_at, ends_at) values (pro, 2, '10:00', '18:00');
  insert into breaks (professional_id, weekday, starts_at, ends_at) values (pro, null, '13:00', '13:30');
  insert into time_off (professional_id, starts_at, ends_at) values (pro, now() + interval '7 days', now() + interval '8 days');
  insert into professional_photos (professional_id, url) values (pro, 'https://example.com/p.jpg');
  insert into business_photos (business_id, url) values (lisa, 'https://example.com/b.jpg');
  delete from business_hours where business_id = lisa and weekday = 2;
  insert into business_hours (business_id, weekday, opens_at, closes_at) values (lisa, 2, '09:00', '17:00');
  update businesses set amenities = array['Wi-Fi'], description = 'Cuts and color' where id = lisa;
  delete from professionals where id = pro;
  raise notice 'ok - owner can add and change services, team, hours, breaks, time off and photos for their salon';
end $$;
-- … and none of it for someone else's.
do $$ begin
  insert into services (business_id, name, price_cents, duration_min) values ('10000000-0000-4000-a000-000000000099', 'Sneaky', 100, 15);
  raise exception 'FAIL: added a service to another owner''s salon';
exception when insufficient_privilege then raise notice 'ok - owner cannot add services to another salon';
end $$;
do $$ begin
  insert into availability (professional_id, weekday, starts_at, ends_at) values ('20000000-0000-4000-a000-000000000099', 1, '09:00', '10:00');
  raise exception 'FAIL: set hours for another salon''s professional';
exception when insufficient_privilege then raise notice 'ok - owner cannot set another salon''s staff hours';
end $$;
do $$ begin
  insert into business_photos (business_id, url) values ('10000000-0000-4000-a000-000000000099', 'https://example.com/x.jpg');
  raise exception 'FAIL: added a photo to another salon';
exception when insufficient_privilege then raise notice 'ok - owner cannot add photos to another salon';
end $$;
delete from professionals where business_id = '10000000-0000-4000-a000-000000000099';
select tests.expect((select count(*) from professionals where id = '20000000-0000-4000-a000-000000000099') = 0, 'owner cannot even see another salon''s unpublished staff');
reset role;
select tests.expect((select count(*) from professionals where id = '20000000-0000-4000-a000-000000000099') = 1, 'owner could not delete another salon''s staff');
rollback;

\echo '— payouts are server-only'
begin;
select tests.as_user('00000000-0000-4000-a000-000000000003');
set local role authenticated;
do $$ begin
  update businesses set payouts_enabled = true where name = 'Hidden Salon';
  raise exception 'FAIL: owner turned on payouts themselves';
exception when insufficient_privilege then raise notice 'ok - owner cannot mark payouts as done (Stripe webhook only)';
end $$;
do $$ begin
  update businesses set stripe_account_id = 'acct_fake' where name = 'Hidden Salon';
  raise exception 'FAIL: owner set a Stripe account id';
exception when insufficient_privilege then raise notice 'ok - owner cannot set the Stripe account';
end $$;
do $$ begin
  insert into businesses (owner_id, name, payouts_enabled, is_published) values (auth.uid(), 'Instant Live', true, true);
  raise exception 'FAIL: created a live salon without Stripe';
exception when insufficient_privilege then raise notice 'ok - a new salon cannot start with payouts on';
end $$;
update businesses set name = 'Hidden Salon NYC' where name = 'Hidden Salon';
select tests.expect(exists (select 1 from businesses where name = 'Hidden Salon NYC'), 'owner can still edit their salon''s details');
reset role;
update businesses set payouts_enabled = true, stripe_account_id = 'acct_test' where name = 'Hidden Salon NYC';
select tests.expect((select payouts_enabled from businesses where name = 'Hidden Salon NYC'), 'the server (service role) can turn payouts on');
rollback;

\echo '— photo storage'
begin;
select tests.as_user('00000000-0000-4000-a000-000000000001');
set local role authenticated;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('photos', '10000000-0000-4000-a000-000000000001/photos/a.jpg');
  raise notice 'ok - owner can upload photos to their salon''s folder';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('photos', '10000000-0000-4000-a000-000000000099/photos/a.jpg');
  raise exception 'FAIL: uploaded into another salon''s folder';
exception when insufficient_privilege then raise notice 'ok - owner cannot upload into another salon''s folder';
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('photos', 'not-a-business/a.jpg');
  raise exception 'FAIL: uploaded outside a business folder';
exception when insufficient_privilege then raise notice 'ok - uploads must go in a business folder';
end $$;
rollback;
begin;
set local role anon;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('photos', '10000000-0000-4000-a000-000000000001/photos/b.jpg');
  raise exception 'FAIL: anonymous upload';
exception when insufficient_privilege then raise notice 'ok - visitors who are not signed in cannot upload';
end $$;
rollback;

\echo '— discovery: reviews and favorites (Phase 3)'
begin;
-- A review at the unpublished salon, and a favorite that belongs to another customer.
insert into bookings (id, business_id, professional_id, customer_id, starts_at, ends_at, status) values
  ('30000000-0000-4000-a000-000000000099', '10000000-0000-4000-a000-000000000099', '20000000-0000-4000-a000-000000000099',
   '00000000-0000-4000-a000-000000000010', now() - interval '20 days', now() - interval '20 days' + interval '1 hour', 'completed');
insert into reviews (booking_id, business_id, customer_id, rating, body) values
  ('30000000-0000-4000-a000-000000000099', '10000000-0000-4000-a000-000000000099', '00000000-0000-4000-a000-000000000010', 1, 'Hidden review');
insert into favorites (customer_id, business_id) values ('00000000-0000-4000-a000-000000000010', '10000000-0000-4000-a000-000000000001');
set local role anon;
select tests.expect((select count(*) from public_reviews) = 8, 'anon reads the 8 seed reviews of published salons');
select tests.expect(not exists (select 1 from public_reviews where body = 'Hidden review'), 'reviews of an unpublished salon stay hidden');
select tests.expect(exists (select 1 from public_reviews where reviewer_name = 'Dana T.'), 'reviewers show as first name + last initial');
select tests.expect(not exists (select 1 from public_reviews where reviewer_name like '%Torres%'), 'a reviewer''s full last name is never shown');
select tests.expect(not exists (
  select 1 from information_schema.columns where table_name = 'public_reviews' and column_name in ('customer_id', 'booking_id')
), 'public reviews expose no customer or booking ids');
select tests.expect((select count(*) from profiles) = 0, 'the reviews view does not open up profiles');
select tests.expect((select count(*) from favorites) = 0, 'anon cannot read favorites');
do $$ begin
  insert into favorites (customer_id, business_id) values ('00000000-0000-4000-a000-000000000010', '10000000-0000-4000-a000-000000000002');
  raise exception 'FAIL: anon saved a favorite';
exception when insufficient_privilege then raise notice 'ok - anon cannot save favorites';
end $$;
do $$ begin
  update public_reviews set rating = 5;
  raise exception 'FAIL: anon changed a review through the view';
exception when insufficient_privilege or object_not_in_prerequisite_state or feature_not_supported then
  raise notice 'ok - the reviews view is read-only';
end $$;
reset role;
select tests.as_user('00000000-0000-4000-a000-000000000002');
set local role authenticated;
select tests.expect((select count(*) from favorites) = 0, 'a customer cannot see someone else''s favorites');
delete from favorites;
reset role;
select tests.expect((select count(*) from favorites) = 1, 'a customer cannot delete someone else''s favorites');
select tests.as_user('00000000-0000-4000-a000-000000000010');
set local role authenticated;
select tests.expect((select count(*) from favorites) = 1, 'a customer sees their own favorites');
insert into favorites (customer_id, professional_id) select auth.uid(), id from professionals where first_name = 'Marcus';
select tests.expect((select count(*) from favorites) = 2, 'a customer can save a professional');
delete from favorites where business_id is not null;
select tests.expect((select count(*) from favorites) = 1, 'a customer can remove their own favorite');
rollback;

\echo '— booking: busy times and holds (Phase 4)'
begin;
-- A wall-clock time in New York, `days` after the start of this week (Monday). 15 = Tuesday two weeks out.
create or replace function tests.ny(days int, hhmm text) returns timestamptz language sql stable as $$
  select ((date_trunc('week', now() at time zone 'America/New_York')::date + days) + hhmm::time) at time zone 'America/New_York';
$$;
grant execute on function tests.ny(int, text) to anon, authenticated;
create temp table ids as select
  (select id from professionals where first_name = 'April') as april,
  (select id from professionals where first_name = 'Jun') as jun,
  (select id from services where name = 'Blowout') as blowout,            -- Lisa's, 45 min, $60
  (select id from services where name = 'Gloss treatment') as gloss,      -- Lisa's, 30 min
  (select id from services where name = 'Skin fade') as fade;             -- another salon's
grant select on ids to anon, authenticated;
create temp table held (id uuid);
grant all on held to anon, authenticated;

select set_config('request.jwt.claims', '', true); -- signed out
set local role anon;
do $$ begin
  perform create_hold('10000000-0000-4000-a000-000000000001', (select april from ids), array[(select blowout from ids)], tests.ny(15, '11:00'));
  raise exception 'FAIL: anon held a time';
exception when insufficient_privilege then raise notice 'ok - visitors who are not signed in cannot hold a time';
end $$;
do $$ begin
  perform release_expired_holds();
  raise exception 'FAIL: anon ran the hold clean-up';
exception when insufficient_privilege then raise notice 'ok - only the server can run the hold clean-up';
end $$;
reset role;

select tests.as_user('00000000-0000-4000-a000-000000000002');
set local role authenticated;
insert into held select create_hold('10000000-0000-4000-a000-000000000001', (select april from ids), array[(select blowout from ids)], tests.ny(15, '11:00'));
select tests.expect((select count(*) from held where id is not null) = 1, 'a customer can hold a free time');
select tests.expect((select status from bookings where id = (select id from held)) = 'pending_payment', 'a hold starts as pending payment');
select tests.expect((select ends_at - starts_at from bookings where id = (select id from held)) = interval '45 minutes', 'the hold lasts as long as the service (from the database)');
select tests.expect((select total_cents from bookings where id = (select id from held)) = 6000, 'the price comes from the database, not the phone');
select tests.expect((select count(*) from booking_services where booking_id = (select id from held)) = 1, 'the held services are copied onto the booking');

-- Rejected times. Each must fail with a plain message.
do $$
declare
  cases text[][] := array[
    array['off the 15-minute grid', '15', '11:10', 'blowout', 'april'],
    array['past closing time', '15', '18:30', 'blowout', 'april'],
    array['overlapping the lunch break', '15', '12:45', 'blowout', 'april'],
    array['on a day the salon is closed (Monday)', '14', '11:00', 'blowout', 'april'],
    array['for another salon''s service', '15', '15:00', 'fade', 'april']
  ];
  c text[];
  svc uuid;
begin
  foreach c slice 1 in array cases loop
    svc := case c[4] when 'fade' then (select fade from ids) else (select blowout from ids) end;
    begin
      perform create_hold('10000000-0000-4000-a000-000000000001', (select april from ids), array[svc], tests.ny(c[2]::int, c[3]));
      raise exception 'FAIL: held a time %', c[1];
    exception when check_violation then raise notice 'ok - cannot hold a time %', c[1];
    end;
  end loop;
end $$;
do $$ begin
  perform create_hold('10000000-0000-4000-a000-000000000001', (select april from ids), array[(select blowout from ids)], date_trunc('hour', now()) + interval '30 minutes');
  raise exception 'FAIL: held a time less than an hour away';
exception when check_violation then raise notice 'ok - cannot hold a time less than an hour away';
end $$;
do $$ begin
  perform create_hold('10000000-0000-4000-a000-000000000099', '20000000-0000-4000-a000-000000000099', array[(select blowout from ids)], tests.ny(15, '11:00'));
  raise exception 'FAIL: held a time at an unpublished salon';
exception when check_violation then raise notice 'ok - cannot hold a time at a salon that is not live';
end $$;
reset role;

-- Someone else, same professional, overlapping time.
select tests.as_user('00000000-0000-4000-a000-000000000010');
set local role authenticated;
do $$ begin
  perform create_hold('10000000-0000-4000-a000-000000000001', (select april from ids), array[(select gloss from ids)], tests.ny(15, '11:30'));
  raise exception 'FAIL: double-booked a held time';
exception when unique_violation then raise notice 'ok - a held time cannot be taken by someone else';
end $$;
select tests.expect(
  (select count(*) from create_hold('10000000-0000-4000-a000-000000000001', (select jun from ids), array[(select gloss from ids)], tests.ny(15, '11:30')) x) = 1,
  'a different professional can take the same time');
reset role;

-- What everyone may see of busy times.
select set_config('request.jwt.claims', '', true); -- signed out
set local role anon;
select tests.expect(exists (
  select 1 from busy_times('10000000-0000-4000-a000-000000000001', tests.ny(15, '00:00'), tests.ny(16, '00:00'))
  where professional_id = (select april from ids) and starts_at = tests.ny(15, '11:00')
), 'anyone can see that a time is busy');
select tests.expect(not exists (
  select 1 from information_schema.routines r join information_schema.parameters p using (specific_name)
  where r.routine_name = 'busy_times' and p.parameter_mode = 'OUT' and p.parameter_name not in ('professional_id', 'starts_at', 'ends_at', 'kind')
), 'busy times show only which professional, when, and booking or time off — no customer or note');
select tests.expect(exists (
  select 1 from busy_times('10000000-0000-4000-a000-000000000001', now(), now() + interval '7 days')
  where professional_id = (select april from ids) and ends_at - starts_at = interval '1 day' and kind = 'time_off'
), 'time off shows as busy (without the note)');
select tests.expect(not exists (
  select 1 from busy_times('10000000-0000-4000-a000-000000000099', now() - interval '30 days', now() + interval '30 days')
), 'busy times of an unpublished salon stay hidden');
select tests.expect((select count(*) from bookings) = 0, 'anon still cannot read bookings');
reset role;

-- A new hold replaces the customer's old one; release_hold lets go.
select tests.as_user('00000000-0000-4000-a000-000000000002');
set local role authenticated;
select tests.expect(create_hold('10000000-0000-4000-a000-000000000001', (select april from ids), array[(select gloss from ids)], tests.ny(15, '16:00')) is not null, 'a customer can hold another time');
select tests.expect((select status from bookings where id = (select id from held)) = 'cancelled', 'holding a new time lets go of the old one');
select tests.expect((select count(*) from bookings where status = 'pending_payment') = 1, 'a customer has at most one hold');
select release_hold((select id from bookings where status = 'pending_payment'));
select tests.expect((select count(*) from bookings where status = 'pending_payment') = 0, 'a customer can let go of their hold');
reset role;

-- Someone else's hold can't be released by you, even knowing its id.
insert into held select id from bookings where customer_id = '00000000-0000-4000-a000-000000000010' and status = 'pending_payment';
select tests.as_user('00000000-0000-4000-a000-000000000002');
set local role authenticated;
do $$ begin perform release_hold(id) from held where id is not null; end $$;
reset role;
select tests.expect((select count(*) from bookings where customer_id = '00000000-0000-4000-a000-000000000010' and status = 'pending_payment') = 1,
  'a customer cannot let go of someone else''s hold');

-- A hold older than 10 minutes stops blocking and is cleaned up.
update bookings set created_at = now() - interval '11 minutes' where customer_id = '00000000-0000-4000-a000-000000000010' and status = 'pending_payment';
select set_config('request.jwt.claims', '', true); -- signed out
set local role anon;
select tests.expect(not exists (
  select 1 from busy_times('10000000-0000-4000-a000-000000000001', tests.ny(15, '00:00'), tests.ny(16, '00:00'))
  where professional_id = (select jun from ids) and starts_at = tests.ny(15, '11:30')
), 'an unpaid hold stops blocking after 10 minutes');
reset role;
select tests.expect(release_expired_holds() = 1, 'the clean-up cancels holds older than 10 minutes');
select tests.as_user('00000000-0000-4000-a000-000000000002');
set local role authenticated;
select tests.expect(
  (select count(*) from create_hold('10000000-0000-4000-a000-000000000001', (select jun from ids), array[(select gloss from ids)], tests.ny(15, '11:30')) x) = 1,
  'a time whose hold ran out can be booked again');
reset role;
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
