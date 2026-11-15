-- Phase 4: booking engine (SPEC §8, §9).
--
-- Customers can't read other people's bookings or a professional's time off (both private),
-- but "Pick a time" needs to know when people are busy. busy_times() shares only the busy
-- stretches and whether each is a booking or time off — never who, or the time-off note.
--
-- Customers never insert bookings themselves (RLS has no insert policy for them). create_hold()
-- re-checks every rule from src/lib/availability.ts on the server, then inserts the booking as
-- pending_payment. The no_double_booking constraint is the last line of defence.

-- ─────────────────────────────────────────────────────────── holds that ran out

create function release_expired_holds() returns int
language sql volatile security definer set search_path = public as $$
  with gone as (
    update bookings set status = 'cancelled', cancelled_at = now()
    where status = 'pending_payment' and created_at < now() - interval '10 minutes'
    returning 1
  )
  select count(*)::int from gone;
$$;

-- ─────────────────────────────────────────────────────────── busy stretches for Pick a time

create function busy_times(p_business uuid, p_from timestamptz, p_to timestamptz)
returns table (professional_id uuid, starts_at timestamptz, ends_at timestamptz, kind text)
language sql stable security definer set search_path = public as $$
  select b.professional_id, b.starts_at, b.ends_at, 'booking'::text
  from bookings b
  where b.business_id = p_business
    and is_business_published(p_business)
    and b.starts_at < p_to and b.ends_at > p_from
    and (b.status = 'confirmed' or (b.status = 'pending_payment' and b.created_at >= now() - interval '10 minutes'))
  union all
  select t.professional_id, t.starts_at, t.ends_at, 'time_off'::text
  from time_off t
  join professionals p on p.id = t.professional_id
  where p.business_id = p_business
    and is_business_published(p_business)
    and t.starts_at < p_to and t.ends_at > p_from;
$$;

-- ─────────────────────────────────────────────────────────── hold a time

create function create_hold(p_business uuid, p_professional uuid, p_service_ids uuid[], p_starts_at timestamptz)
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  tz text;
  wanted int := coalesce(array_length(p_service_ids, 1), 0);
  found int;
  minutes int;
  price int;
  ends timestamptz;
  local_start timestamp;
  local_end timestamp;
  dow int;
  new_id uuid;
begin
  if uid is null then
    raise exception 'Sign in to book.' using errcode = 'insufficient_privilege';
  end if;

  select b.time_zone into tz from businesses b where b.id = p_business and b.is_published;
  if tz is null then
    raise exception 'This salon isn''t taking bookings right now.' using errcode = 'check_violation';
  end if;

  -- The services, from the database (never trust prices or lengths sent by the phone).
  select count(*), sum(s.duration_min), sum(s.price_cents) into found, minutes, price
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

-- ─────────────────────────────────────────────────────────── let go of a hold

create function release_hold(p_booking uuid) returns void
language sql volatile security definer set search_path = public as $$
  update bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_booking and customer_id = auth.uid() and status = 'pending_payment';
$$;

-- ─────────────────────────────────────────────────────────── who may call what

revoke all on function release_expired_holds() from public, anon, authenticated;
revoke all on function busy_times(uuid, timestamptz, timestamptz) from public;
grant execute on function busy_times(uuid, timestamptz, timestamptz) to anon, authenticated;
revoke all on function create_hold(uuid, uuid, uuid[], timestamptz) from public, anon;
grant execute on function create_hold(uuid, uuid, uuid[], timestamptz) to authenticated;
revoke all on function release_hold(uuid) from public, anon;
grant execute on function release_hold(uuid) to authenticated;

-- Release unpaid holds every minute (SPEC §9). pg_cron exists on Supabase; skipped where it doesn't
-- (the local test database), where release_expired_holds() is also run by create_hold().
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('release-holds', '* * * * *', 'select public.release_expired_holds()');
  end if;
end $$;
