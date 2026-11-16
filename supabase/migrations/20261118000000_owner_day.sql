-- Phase 6: the owner's day (SPEC §10 Today / Calendar / Clients, §9 walk-ins).
--
-- 1. Customers who book online become clients of that salon automatically, so the owner sees a name
--    on every booking without ever reading another person's profile.
-- 2. Owners add walk-ins and mark visits completed / no-show only through the checked functions below.
--    Direct writes to bookings would let an owner, say, mark a no-show before the appointment and
--    trigger the 50% charge, so they're switched off.

-- ─────────────────────────────────────────────────────────── clients

alter table clients add column created_at timestamptz not null default now();
create unique index clients_business_profile_idx on clients (business_id, profile_id) where profile_id is not null;
create index clients_business_name_idx on clients (business_id, lower(name));
create index bookings_client_idx on bookings (client_id);

-- Owners write names, contact details and notes; which Hairday account a client is stays server-side.
revoke insert, update on clients from anon, authenticated;
grant insert (business_id, name, email, phone, notes) on clients to authenticated;
grant update (name, email, phone, notes) on clients to authenticated;

create function link_booking_client() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  nm text;
  em text;
begin
  if new.customer_id is null or new.client_id is not null
     or new.status not in ('confirmed', 'completed', 'no_show') then
    return new;
  end if;
  select id into cid from clients where business_id = new.business_id and profile_id = new.customer_id;
  if cid is null then
    select nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), u.email
      into nm, em
      from profiles p left join auth.users u on u.id = p.id
     where p.id = new.customer_id;
    insert into clients (business_id, profile_id, name, email)
    values (new.business_id, new.customer_id, coalesce(nm, split_part(em, '@', 1), 'Client'), em)
    on conflict (business_id, profile_id) where profile_id is not null do update set name = clients.name
    returning id into cid;
  end if;
  new.client_id := cid;
  return new;
end $$;

create trigger bookings_link_client
  before insert or update of status on bookings
  for each row execute function link_booking_client();

-- Existing bookings get their client too.
update bookings set status = status
 where customer_id is not null and client_id is null and status in ('confirmed', 'completed', 'no_show');

-- ─────────────────────────────────────────────────────────── bookings: owner actions only via functions

revoke insert, update on bookings from anon, authenticated;
revoke insert, update, delete on booking_services from anon, authenticated;

-- Calendar → Walk-in (SPEC §9: walk-ins skip online payment). Price and length come from the menu.
create function add_walk_in(
  p_business uuid,
  p_professional uuid,
  p_client uuid,
  p_service_ids uuid[],
  p_starts_at timestamptz
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  minutes int;
  price int;
  ends timestamptz;
  new_id uuid;
begin
  if not is_business_owner(p_business) then
    raise exception 'Only the salon''s owner can add walk-ins.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from professionals where id = p_professional and business_id = p_business and is_active) then
    raise exception 'Pick someone from your team.' using errcode = 'check_violation';
  end if;
  if p_client is not null and not exists (select 1 from clients where id = p_client and business_id = p_business) then
    raise exception 'Pick one of your clients.' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(p_service_ids, 1), 0) = 0
     or (select count(*) from services where id = any (p_service_ids) and business_id = p_business)
        <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'Pick a service from your menu.' using errcode = 'check_violation';
  end if;
  if p_starts_at < now() - interval '12 hours' then
    raise exception 'That time has already passed.' using errcode = 'check_violation';
  end if;

  select sum(duration_min), sum(price_cents) into minutes, price from services where id = any (p_service_ids);
  ends := p_starts_at + make_interval(mins => minutes);

  begin
    insert into bookings (business_id, professional_id, client_id, starts_at, ends_at, status, source, subtotal_cents, total_cents)
    values (p_business, p_professional, p_client, p_starts_at, ends, 'confirmed', 'walk_in', price, price)
    returning id into new_id;
  exception when exclusion_violation then
    raise exception 'That time overlaps another appointment.' using errcode = 'unique_violation';
  end;

  insert into booking_services (booking_id, service_id, professional_id, price_cents, duration_min)
  select new_id, s.id, p_professional, s.price_cents, s.duration_min from services s where s.id = any (p_service_ids);
  return new_id;
end $$;

-- Today → booking → "Completed" / "No-show". Only once the appointment has started; a no-show then
-- lets charge-due take 50% of the services (DECISIONS 2026-11-16).
create function mark_booking(p_booking uuid, p_status booking_status) returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  b bookings;
begin
  if p_status not in ('completed', 'no_show') then
    raise exception 'Mark it completed or no-show.' using errcode = 'check_violation';
  end if;
  select * into b from bookings where id = p_booking;
  if b.id is null or not is_business_owner(b.business_id) then
    raise exception 'Booking not found.' using errcode = 'insufficient_privilege';
  end if;
  if b.status not in ('confirmed', 'completed', 'no_show') or b.payment_status in ('charging', 'charged') then
    raise exception 'This booking can''t be changed any more.' using errcode = 'check_violation';
  end if;
  if b.starts_at > now() then
    raise exception 'You can mark it once the appointment has started.' using errcode = 'check_violation';
  end if;
  update bookings set status = p_status where id = p_booking;
end $$;

revoke all on function link_booking_client() from public, anon, authenticated;
revoke all on function add_walk_in(uuid, uuid, uuid, uuid[], timestamptz) from public, anon;
grant execute on function add_walk_in(uuid, uuid, uuid, uuid[], timestamptz) to authenticated;
revoke all on function mark_booking(uuid, booking_status) from public, anon;
grant execute on function mark_booking(uuid, booking_status) to authenticated;
