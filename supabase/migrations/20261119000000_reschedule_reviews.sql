-- Phase 7, part 1: reschedule and reviews (SPEC §10 My bookings, Leave a review).
--
-- 1. bookable_end() holds every "can this time be booked?" rule that create_hold() used to check
--    inline, so create_hold() and the new reschedule_booking() can't drift apart.
-- 2. reschedule_booking(): a customer moves their own confirmed booking to another free time
--    (same services and prices, any professional who does them all). Allowed until the free-cancel
--    window closes (24 hours before), so rescheduling can't be used to dodge the late-cancel charge.
-- 3. Review photos: customers may upload into photos/reviews/<their user id>/….

-- ─────────────────────────────────────────────────────────── shared slot rules

-- Raises a friendly error unless p_professional can take p_service_ids at p_starts_at at p_business.
-- Returns when the visit would end. Does not look at other bookings: the no_double_booking
-- constraint decides that, at insert/update time.
create function bookable_end(p_business uuid, p_professional uuid, p_service_ids uuid[], p_starts_at timestamptz)
returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  tz text;
  wanted int := coalesce(array_length(p_service_ids, 1), 0);
  found int;
  minutes int;
  ends timestamptz;
  local_start timestamp;
  local_end timestamp;
  dow int;
begin
  select b.time_zone into tz from businesses b where b.id = p_business and b.is_published;
  if tz is null then
    raise exception 'This salon isn''t taking bookings right now.' using errcode = 'check_violation';
  end if;

  -- The services, from the database (never trust prices or lengths sent by the phone).
  select count(*), sum(s.duration_min) into found, minutes
  from services s
  where s.id = any (p_service_ids) and s.business_id = p_business and s.is_visible;
  if wanted = 0 or found <> wanted or (select count(distinct x) from unnest(p_service_ids) x) <> wanted then
    raise exception 'One of those services isn''t available any more.' using errcode = 'check_violation';
  end if;

  -- The professional works here, takes bookings and does every chosen service.
  if not exists (select 1 from professionals p where p.id = p_professional and p.business_id = p_business and p.is_active)
     or (select count(*) from professional_services ps where ps.professional_id = p_professional and ps.service_id = any (p_service_ids)) <> wanted then
    raise exception 'That professional doesn''t offer all of those services.' using errcode = 'check_violation';
  end if;

  ends := p_starts_at + make_interval(mins => minutes);
  local_start := p_starts_at at time zone tz;
  local_end := ends at time zone tz;
  dow := extract(dow from local_start)::int;

  -- 15-minute grid, at least an hour away, inside one day on the salon's clock.
  if extract(second from local_start) <> 0 or extract(minute from local_start)::int % 15 <> 0
     or p_starts_at < now() + interval '1 hour'
     or local_end::date <> local_start::date then
    raise exception 'That time can''t be booked. Pick another.' using errcode = 'check_violation';
  end if;

  -- Inside the salon's hours and the professional's hours, and not in a break or time off.
  if not exists (
       select 1 from business_hours h
       where h.business_id = p_business and h.weekday = dow and h.opens_at <= local_start::time and local_end::time <= h.closes_at)
     or not exists (
       select 1 from availability a
       where a.professional_id = p_professional and a.weekday = dow and a.starts_at <= local_start::time and local_end::time <= a.ends_at)
     or exists (
       select 1 from breaks br
       where br.professional_id = p_professional and (br.weekday is null or br.weekday = dow)
         and br.starts_at < local_end::time and br.ends_at > local_start::time)
     or exists (
       select 1 from time_off t
       where t.professional_id = p_professional and t.starts_at < ends and t.ends_at > p_starts_at) then
    raise exception 'That time isn''t available. Pick another.' using errcode = 'check_violation';
  end if;

  return ends;
end $$;

-- ─────────────────────────────────────────────────────────── hold a time (same rules, now shared)

create or replace function create_hold(p_business uuid, p_professional uuid, p_service_ids uuid[], p_starts_at timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  price int;
  ends timestamptz;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Sign in to book.' using errcode = 'insufficient_privilege';
  end if;

  ends := bookable_end(p_business, p_professional, p_service_ids, p_starts_at);
  select sum(s.price_cents) into price from services s where s.id = any (p_service_ids);

  -- One hold per customer, and holds that ran out don't block anyone.
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = uid
  where customer_id = uid and status = 'pending_payment';
  perform release_expired_holds();

  begin
    insert into bookings (business_id, professional_id, customer_id, starts_at, ends_at, status, source, subtotal_cents, total_cents)
    values (p_business, p_professional, uid, p_starts_at, ends, 'pending_payment', 'online', price, price)
    returning id into new_id;
  exception when exclusion_violation then
    raise exception 'Someone just booked that time. Pick another.' using errcode = 'unique_violation';
  end;

  insert into booking_services (booking_id, service_id, professional_id, price_cents, duration_min)
  select new_id, s.id, p_professional, s.price_cents, s.duration_min
  from services s where s.id = any (p_service_ids);

  return new_id;
end $$;

-- ─────────────────────────────────────────────────────────── reschedule

create function reschedule_booking(p_booking uuid, p_professional uuid, p_starts_at timestamptz)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b bookings%rowtype;
  ids uuid[];
  ends timestamptz;
  free_hours int;
begin
  select * into b from bookings where id = p_booking and customer_id = uid for update;
  if b.id is null then
    raise exception 'Booking not found.' using errcode = 'no_data_found';
  end if;
  if b.status <> 'confirmed' or b.payment_status <> 'card_saved' then
    raise exception 'This booking can''t be changed any more.' using errcode = 'check_violation';
  end if;

  select coalesce(cancellation_hours, 24) into free_hours from businesses where id = b.business_id;
  if now() > b.starts_at - make_interval(hours => free_hours) then
    raise exception 'It''s less than % hours away, so it can''t be moved. You can still cancel it.', free_hours
      using errcode = 'check_violation';
  end if;

  select array_agg(service_id) into ids from booking_services where booking_id = b.id;
  ends := bookable_end(b.business_id, p_professional, ids, p_starts_at);

  begin
    update bookings set professional_id = p_professional, starts_at = p_starts_at, ends_at = ends where id = b.id;
  exception when exclusion_violation then
    raise exception 'Someone just booked that time. Pick another.' using errcode = 'unique_violation';
  end;
  update booking_services set professional_id = p_professional where booking_id = b.id;
end $$;

revoke all on function bookable_end(uuid, uuid, uuid[], timestamptz) from public, anon, authenticated;
revoke all on function reschedule_booking(uuid, uuid, timestamptz) from public, anon;
grant execute on function reschedule_booking(uuid, uuid, timestamptz) to authenticated;

-- ─────────────────────────────────────────────────────────── review photos

-- True for photos/reviews/<signed-in user id>/…
create function public.owns_review_photo_path(path text) returns boolean
language sql stable as $$
  select split_part(path, '/', 1) = 'reviews' and split_part(path, '/', 2) = auth.uid()::text;
$$;

create policy "photos: customer review upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.owns_review_photo_path(name));
create policy "photos: customer review delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.owns_review_photo_path(name));

-- A review can only be about the salon and professional of that booking (the insert policy already
-- checks the booking is the customer's own, completed, and at that salon).
create function review_matches_booking() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select b.business_id, b.professional_id into new.business_id, new.professional_id from bookings b where b.id = new.booking_id;
  new.customer_id := coalesce(auth.uid(), new.customer_id); -- seed data and server jobs have no user
  if tg_op = 'UPDATE' then
    new.booking_id := old.booking_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

create trigger review_matches_booking before insert or update on reviews
  for each row execute function review_matches_booking();
