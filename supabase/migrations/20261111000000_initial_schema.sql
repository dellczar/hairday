-- Hairday initial schema (docs/SPEC.md §7).
-- Every table has Row Level Security. Secrets and Stripe calls never run here from the app;
-- Edge Functions use the service role, which bypasses RLS by design.

create extension if not exists btree_gist;

-- ─────────────────────────────────────────────────────────── enums
create type booking_status as enum ('pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show');
create type booking_source as enum ('online', 'walk_in', 'phone');
create type device_platform as enum ('ios', 'android');
create type pro_role as enum (
  'hair stylist', 'colorist', 'barber', 'braider', 'cosmetologist',
  'makeup artist', 'nail technician', 'lash artist', 'massage therapist', 'other'
);

-- ─────────────────────────────────────────────────────────── people
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  notify_push boolean not null default true,
  notify_email boolean not null default true,
  notify_sms boolean not null default false,
  created_at timestamptz not null default now()
);

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  expo_token text not null,
  platform device_platform not null,
  updated_at timestamptz not null default now(),
  unique (profile_id, expo_token)
);

-- New sign-ups get a profile row automatically.
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────── businesses
create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  type text,
  description text,
  phone text,
  website text,
  instagram text,
  tiktok text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  zip text,
  lat double precision,
  lng double precision,
  time_zone text not null default 'America/New_York',
  logo_url text,
  amenities text[] not null default '{}',
  health_safety text[] not null default '{}',
  cancellation_hours int not null default 24 check (cancellation_hours between 0 and 168),
  late_cancel_percent int not null default 50 check (late_cancel_percent between 0 and 100),
  stripe_account_id text,
  payouts_enabled boolean not null default false,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  -- SPEC §9: a business can't be published until payouts are enabled.
  constraint publish_requires_payouts check (not is_published or payouts_enabled)
);
create index businesses_owner_idx on businesses (owner_id);

create table business_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  url text not null,
  sort_order int not null default 0
);

create table business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at)
);
create index business_hours_idx on business_hours (business_id, weekday);

-- ─────────────────────────────────────────────────────────── catalog
create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null
);

create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  category_id uuid references categories (id),
  name text not null check (length(trim(name)) > 0),
  description text,
  price_cents int not null check (price_cents >= 0),
  duration_min int not null check (duration_min between 15 and 480 and duration_min % 15 = 0),
  is_visible boolean not null default true,
  sort_order int not null default 0
);
create index services_business_idx on services (business_id);

create table professionals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  role pro_role not null default 'hair stylist',
  first_name text not null,
  last_name text,
  avatar_url text,
  instagram text,
  is_active boolean not null default true
);
create index professionals_business_idx on professionals (business_id);

create table professional_services (
  professional_id uuid not null references professionals (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  primary key (professional_id, service_id)
);

create table professional_photos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  url text not null,
  sort_order int not null default 0
);

-- ─────────────────────────────────────────────────────────── schedules
create table availability (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  check (ends_at > starts_at)
);

create table breaks (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  weekday smallint check (weekday between 0 and 6), -- null = every day
  starts_at time not null,
  ends_at time not null,
  check (ends_at > starts_at)
);

create table time_off (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  check (ends_at > starts_at)
);

-- ─────────────────────────────────────────────────────────── clients & bookings
create table clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  profile_id uuid references profiles (id) on delete set null,
  name text not null,
  email text,
  phone text,
  notes text
);
create index clients_business_idx on clients (business_id);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  professional_id uuid not null references professionals (id),
  customer_id uuid references profiles (id) on delete set null, -- null for walk-ins
  client_id uuid references clients (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status booking_status not null default 'pending_payment',
  source booking_source not null default 'online',
  subtotal_cents int not null default 0 check (subtotal_cents >= 0),
  fee_cents int not null default 0 check (fee_cents >= 0),
  tip_cents int not null default 0 check (tip_cents >= 0),
  total_cents int not null default 0 check (total_cents >= 0),
  stripe_payment_intent_id text unique,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles (id) on delete set null,
  refund_cents int not null default 0 check (refund_cents >= 0),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- SPEC §7: one professional can't have two overlapping live bookings.
  constraint no_double_booking exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('confirmed', 'pending_payment'))
);
create index bookings_business_time_idx on bookings (business_id, starts_at);
create index bookings_customer_idx on bookings (customer_id, starts_at);

create table booking_services (
  booking_id uuid not null references bookings (id) on delete cascade,
  service_id uuid not null references services (id),
  professional_id uuid not null references professionals (id),
  price_cents int not null check (price_cents >= 0),
  duration_min int not null check (duration_min > 0),
  primary key (booking_id, service_id)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references bookings (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  professional_id uuid references professionals (id) on delete set null,
  customer_id uuid not null references profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  body text,
  photo_url text,
  created_at timestamptz not null default now()
);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles (id) on delete cascade,
  business_id uuid references businesses (id) on delete cascade,
  professional_id uuid references professionals (id) on delete cascade,
  check ((business_id is null) <> (professional_id is null)),
  unique (customer_id, business_id),
  unique (customer_id, professional_id)
);

-- ─────────────────────────────────────────────────────────── helper functions
-- security definer so policies can check ownership without recursive RLS lookups.
create function is_business_owner(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = bid and owner_id = auth.uid());
$$;

create function is_business_published(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from businesses where id = bid and is_published);
$$;

create function business_of_professional(pid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from professionals where id = pid;
$$;

-- ─────────────────────────────────────────────────────────── row level security
alter table profiles enable row level security;
alter table push_tokens enable row level security;
alter table businesses enable row level security;
alter table business_photos enable row level security;
alter table business_hours enable row level security;
alter table categories enable row level security;
alter table services enable row level security;
alter table professionals enable row level security;
alter table professional_services enable row level security;
alter table professional_photos enable row level security;
alter table availability enable row level security;
alter table breaks enable row level security;
alter table time_off enable row level security;
alter table clients enable row level security;
alter table bookings enable row level security;
alter table booking_services enable row level security;
alter table reviews enable row level security;
alter table favorites enable row level security;

-- profiles: you see and edit only yourself (rows are created by the trigger).
create policy "profiles: read own" on profiles for select using (id = auth.uid());
create policy "profiles: update own" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- push tokens: only your own.
create policy "push_tokens: own" on push_tokens for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- businesses: anyone sees published ones; owners manage their own.
create policy "businesses: read published" on businesses for select using (is_published);
create policy "businesses: owner read" on businesses for select using (owner_id = auth.uid());
create policy "businesses: owner insert" on businesses for insert with check (owner_id = auth.uid());
create policy "businesses: owner update" on businesses for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "businesses: owner delete" on businesses for delete using (owner_id = auth.uid());

-- categories: public catalog, read-only from the app.
create policy "categories: read all" on categories for select using (true);

-- Business-owned public content: readable when the business is published; owner manages.
create policy "business_photos: read published" on business_photos for select using (is_business_published(business_id));
create policy "business_photos: owner all" on business_photos for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy "business_hours: read published" on business_hours for select using (is_business_published(business_id));
create policy "business_hours: owner all" on business_hours for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy "services: read visible" on services for select using (is_visible and is_business_published(business_id));
create policy "services: owner all" on services for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy "professionals: read active" on professionals for select using (is_active and is_business_published(business_id));
create policy "professionals: owner all" on professionals for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy "professional_services: read published" on professional_services for select
  using (is_business_published(business_of_professional(professional_id)));
create policy "professional_services: owner all" on professional_services for all
  using (is_business_owner(business_of_professional(professional_id)))
  with check (is_business_owner(business_of_professional(professional_id)));

create policy "professional_photos: read published" on professional_photos for select
  using (is_business_published(business_of_professional(professional_id)));
create policy "professional_photos: owner all" on professional_photos for all
  using (is_business_owner(business_of_professional(professional_id)))
  with check (is_business_owner(business_of_professional(professional_id)));

create policy "availability: read published" on availability for select
  using (is_business_published(business_of_professional(professional_id)));
create policy "availability: owner all" on availability for all
  using (is_business_owner(business_of_professional(professional_id)))
  with check (is_business_owner(business_of_professional(professional_id)));

create policy "breaks: read published" on breaks for select
  using (is_business_published(business_of_professional(professional_id)));
create policy "breaks: owner all" on breaks for all
  using (is_business_owner(business_of_professional(professional_id)))
  with check (is_business_owner(business_of_professional(professional_id)));

-- time off notes are private to the salon (slot checks run server-side).
create policy "time_off: owner all" on time_off for all
  using (is_business_owner(business_of_professional(professional_id)))
  with check (is_business_owner(business_of_professional(professional_id)));

-- clients: nobody reads another business's clients.
create policy "clients: owner all" on clients for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

-- bookings: customers read their own; owners manage their business's.
-- Customers never insert/update bookings directly — Edge Functions create holds and handle payment.
create policy "bookings: customer read own" on bookings for select using (customer_id = auth.uid());
create policy "bookings: owner all" on bookings for all using (is_business_owner(business_id)) with check (is_business_owner(business_id));

create policy "booking_services: customer read own" on booking_services for select
  using (exists (select 1 from bookings b where b.id = booking_id and b.customer_id = auth.uid()));
create policy "booking_services: owner all" on booking_services for all
  using (exists (select 1 from bookings b where b.id = booking_id and is_business_owner(b.business_id)))
  with check (exists (select 1 from bookings b where b.id = booking_id and is_business_owner(b.business_id)));

-- reviews: public for published salons; a customer may review their own completed booking once.
create policy "reviews: read published" on reviews for select using (is_business_published(business_id));
create policy "reviews: customer read own" on reviews for select using (customer_id = auth.uid());
create policy "reviews: customer insert own completed" on reviews for insert with check (
  customer_id = auth.uid()
  and exists (
    select 1 from bookings b
    where b.id = booking_id and b.customer_id = auth.uid() and b.status = 'completed' and b.business_id = reviews.business_id
  )
);
create policy "reviews: customer update own" on reviews for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "reviews: customer delete own" on reviews for delete using (customer_id = auth.uid());

-- favorites: only your own.
create policy "favorites: own" on favorites for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ─────────────────────────────────────────────────────────── seed catalog (same in every environment)
insert into categories (slug, name) values
  ('haircut', 'Haircut'),
  ('barber', 'Barber'),
  ('kids-haircut', 'Kids haircut'),
  ('braids', 'Braids'),
  ('color', 'Color'),
  ('hair-treatments', 'Hair treatments'),
  ('eyelashes', 'Lashes'),
  ('brows', 'Brows'),
  ('makeup', 'Makeup'),
  ('nails', 'Nails');
